import * as XLSX from 'xlsx'
import { normalize, normalizePO } from './normalize'
import type { AuditoriaRow, ParseResult } from '../../types'

// Columnas requeridas en cada banda
const COLS_REQUERIDAS = ['CLIENTE', 'ESTILO', 'PO', 'COLOR', 'CANT. PROG.', 'EXTERNA'] as const
type ColKey = 'CLIENTE' | 'ESTILO' | 'PO' | 'COLOR' | 'CANT. PROG.' | 'EXTERNA'

const ALIAS: Record<string, ColKey> = {
  'CLIENTE': 'CLIENTE',
  'ESTILO': 'ESTILO',
  'PO': 'PO',
  'COLOR': 'COLOR',
  'CANT. PROG.': 'CANT. PROG.',
  'CANT PROG': 'CANT. PROG.',
  'CANTPROG': 'CANT. PROG.',
  'CANTIDAD PROGRAMADA': 'CANT. PROG.',
  'CANT.PROG.': 'CANT. PROG.',
  'EXTERNA': 'EXTERNA',
  'EXT': 'EXTERNA',
}

function matchCol(header: string): ColKey | null {
  const n = normalize(header)
  return ALIAS[n] ?? null
}

/**
 * Detecta las columnas de una banda dado el array de valores en la fila cabecera.
 * Devuelve un mapa de { ColKey → índice de columna } o null si la banda está incompleta.
 */
function detectarBanda(
  headerRow: unknown[],
  startCol: number,
  endCol: number
): Partial<Record<ColKey, number>> {
  const mapa: Partial<Record<ColKey, number>> = {}
  for (let c = startCol; c <= endCol && c < headerRow.length; c++) {
    const key = matchCol(String(headerRow[c] ?? ''))
    if (key && !(key in mapa)) mapa[key] = c
  }
  return mapa
}

function extraerValor(row: unknown[], col: number | undefined): unknown {
  if (col === undefined) return null
  return row[col] ?? null
}

export function parseAuditorias(
  buffer: ArrayBuffer,
  mapaManual?: Record<string, string>
): ParseResult<AuditoriaRow> {
  const wb = XLSX.read(buffer, { type: 'array', cellDates: false })
  const rows: AuditoriaRow[] = []
  let leidas = 0
  let omitidas = 0
  const errores: string[] = []
  const columnasFaltantes: string[] = []

  for (const sheetName of wb.SheetNames) {
    const ws = wb.Sheets[sheetName]
    if (!ws) continue

    const data: unknown[][] = XLSX.utils.sheet_to_json(ws, {
      header: 1,
      defval: null,
      raw: true,
    }) as unknown[][]

    if (data.length === 0) continue

    // Buscar la fila de cabecera en las primeras 8 filas
    let headerRowIdx = -1
    let headerRow: unknown[] = []

    for (let r = 0; r < Math.min(8, data.length); r++) {
      const row = data[r] ?? []
      const hasCliente = row.some(
        (v) => normalize(String(v ?? '')) === 'CLIENTE'
      )
      if (hasCliente) {
        headerRowIdx = r
        headerRow = row
        break
      }
    }

    if (headerRowIdx === -1) {
      errores.push(`Hoja "${sheetName}": no se encontró fila de cabecera con CLIENTE en las primeras 8 filas`)
      continue
    }

    // Detectar hasta 3 bandas buscando todas las ocurrencias de CLIENTE
    const bandaStarts: number[] = []
    for (let c = 0; c < headerRow.length; c++) {
      if (normalize(String(headerRow[c] ?? '')) === 'CLIENTE') {
        bandaStarts.push(c)
      }
    }

    if (bandaStarts.length === 0) {
      errores.push(`Hoja "${sheetName}": no se detectaron bandas`)
      continue
    }

    // Para cada banda definir rango de columnas
    const bandas = bandaStarts.map((start, i) => {
      const end = bandaStarts[i + 1] !== undefined ? bandaStarts[i + 1] - 1 : start + 10
      return detectarBanda(headerRow, start, end)
    })

    // Validar columnas faltantes (solo de la primera banda)
    const faltantes = COLS_REQUERIDAS.filter((c) => !(c in bandas[0]))
    if (faltantes.length > 0) {
      columnasFaltantes.push(...faltantes.map((f) => `${sheetName}:${f}`))
    }

    // Fill-down por banda: el reporte solo escribe CLIENTE/ESTILO/PO en la primera fila
    // de cada grupo; las filas siguientes (más colores del mismo PO, o el mismo estilo
    // con varios PO) dejan esas celdas en blanco y hay que heredar el último valor visto.
    const lastCliente: string[] = new Array(bandas.length).fill('')
    const lastEstilo: string[] = new Array(bandas.length).fill('')
    const lastPo: string[] = new Array(bandas.length).fill('')

    // Iterar filas de datos
    for (let r = headerRowIdx + 1; r < data.length; r++) {
      const row = data[r] ?? []

      for (let bi = 0; bi < bandas.length; bi++) {
        const banda = bandas[bi]
        const clienteRaw = extraerValor(row, banda['CLIENTE'])
        const clienteStr = normalize(String(clienteRaw ?? ''))

        // Repetición de cabecera → resetear fill-down de esta banda
        if (clienteStr === 'CLIENTE') {
          lastCliente[bi] = ''
          lastEstilo[bi] = ''
          lastPo[bi] = ''
          continue
        }

        // Fila de gran total por cliente (ej. "TOTAL VINEYARDS VINES", CLIENTE = "TOTAL ...",
        // ESTILO/PO en blanco) → cierra el bloque del cliente: saltar y resetear fill-down.
        if (clienteStr.startsWith('TOTAL')) {
          lastCliente[bi] = ''
          lastEstilo[bi] = ''
          lastPo[bi] = ''
          omitidas++
          continue
        }

        // Subtotal en ESTILO (ej: "Total 1V024855")
        const estiloRawVal = extraerValor(row, banda['ESTILO'])
        const estiloStr = normalize(String(estiloRawVal ?? ''))
        const esSubtotal = estiloStr.startsWith('TOTAL')

        const poRawVal = extraerValor(row, banda['PO'])
        const estiloBlank = estiloRawVal === null || String(estiloRawVal).trim() === ''
        const poBlank = poRawVal === null || String(poRawVal).trim() === ''

        // El reporte parte nombres de cliente largos en 2 líneas (ej. "VINEYARD" en la
        // fila de datos y "VINES" en la fila siguiente). Esa 2da línea puede caer en el
        // subtotal del estilo (ESTILO = "Total ...") o en una fila de continuación de
        // colores del mismo PO (ESTILO y PO en blanco) — en ambos casos NO es un cliente
        // nuevo, es la continuación del nombre: se concatena en vez de reemplazar.
        if (clienteStr) {
          const esContinuacionNombre = esSubtotal || (estiloBlank && poBlank)
          if (esContinuacionNombre) {
            const continuacion = String(clienteRaw ?? '').trim()
            if (lastCliente[bi] && !lastCliente[bi].toUpperCase().endsWith(continuacion.toUpperCase())) {
              lastCliente[bi] = `${lastCliente[bi]} ${continuacion}`
            } else if (!lastCliente[bi]) {
              lastCliente[bi] = continuacion
            }
          } else {
            let nombre = String(clienteRaw ?? '').trim()
            // Esta fila arranca un cliente nuevo. Si la fila siguiente es continuación
            // del nombre envuelto (subtotal de este estilo, o más colores sin estilo/PO
            // propio) y trae texto en CLIENTE, fusionarlo ya — si no, esta primera fila
            // quedaría grabada con el nombre truncado (ej. "VINEYARD" sin "VINES").
            const filaSig = data[r + 1] ?? []
            const estiloSigVal = extraerValor(filaSig, banda['ESTILO'])
            const poSigVal = extraerValor(filaSig, banda['PO'])
            const estiloSigStr = normalize(String(estiloSigVal ?? ''))
            const estiloSigBlank = estiloSigVal === null || String(estiloSigVal).trim() === ''
            const poSigBlank = poSigVal === null || String(poSigVal).trim() === ''
            const esContinuacionSig = estiloSigStr.startsWith('TOTAL') || (estiloSigBlank && poSigBlank)
            if (esContinuacionSig) {
              const clienteSigRaw = extraerValor(filaSig, banda['CLIENTE'])
              const clienteSigStr = normalize(String(clienteSigRaw ?? ''))
              if (clienteSigStr && !clienteSigStr.startsWith('TOTAL')) {
                nombre = `${nombre} ${String(clienteSigRaw ?? '').trim()}`
              }
            }
            lastCliente[bi] = nombre
          }
        }

        const clienteEfectivo = lastCliente[bi]

        // Sin cliente ni fill-down → fila vacía, saltar
        if (!clienteEfectivo) continue

        if (esSubtotal) {
          // Fin de grupo: limpiar fill-down de estilo/PO para no arrastrarlo a un
          // grupo que, por algún motivo, no traiga su propio PO.
          lastEstilo[bi] = ''
          lastPo[bi] = ''
          omitidas++
          continue
        }

        // ESTILO y PO solo se repiten en la primera fila de cada grupo de colores
        if (!estiloBlank) lastEstilo[bi] = String(estiloRawVal ?? '').trim()
        const poRaw = normalizePO(String(poRawVal ?? ''))
        if (poRaw) lastPo[bi] = poRaw

        const po = lastPo[bi]
        if (!po) { omitidas++; continue }

        leidas++
        const cantRaw = extraerValor(row, banda['CANT. PROG.'])
        const cantNum = cantRaw !== null && cantRaw !== '' ? Number(cantRaw) : null

        rows.push({
          semana: sheetName,
          cliente: clienteEfectivo,
          estilo: lastEstilo[bi],
          po,
          color: String(extraerValor(row, banda['COLOR']) ?? '').trim(),
          cant_prog: cantNum !== null && !isNaN(cantNum) ? cantNum : null,
          externa: String(extraerValor(row, banda['EXTERNA']) ?? '').trim() || null,
        })
      }
    }
  }

  return {
    rows,
    leidas,
    validas: rows.length,
    omitidas,
    errores,
    columnasFaltantes,
  }
}
