import * as XLSX from 'xlsx'
import { normalize, normalizePO } from './normalize'
import { parseExcelDate } from './dateUtils'
import type { PgoRow, ParseResult } from '../../types'

const ALIAS: Record<string, string> = {
  // PO / OP
  'PO': 'po',
  'OP': 'op',
  // Cliente y estilo (varios nombres posibles)
  'CLIENTE': 'cliente',
  'ESTILO': 'estilo',
  'ESTILO CLIENTE': 'estilo',
  'ESTILO VERSION': 'estilo',
  'ESTILO CLIEN': 'estilo',
  // Color
  'COLOR': 'color',
  'COLOR CLIENTE': 'color',
  // Fin entrega: el PGO usa FEC_EXFACT (fecha ex-factory = fecha de entrega)
  'FIN ENTREGA': 'fin_entrega',
  'FINENTREGA': 'fin_entrega',
  'FIN DE ENTREGA': 'fin_entrega',
  'FEC_EXFACT': 'fin_entrega',
  'FEC EXFACT': 'fin_entrega',
  'FECHA EX FACTORY': 'fin_entrega',
  'EX FACTORY': 'fin_entrega',
  'FECHA EXFACTORY': 'fin_entrega',
  // Auditoría
  'AUDITORIA': 'auditoria',
  'AUDITORIA FINAL': 'auditoria_final',
  'AUDITORIAFINAL': 'auditoria_final',
  'AUDIT FINAL': 'auditoria_final',
}

/**
 * Heurística de respaldo cuando el texto normalizado no coincide EXACTO con ningún
 * alias (ej. el archivo trae "FEC_EXFACT" con espacios/guiones extra, o variantes
 * que no se previeron). Busca por palabras clave contenidas en el encabezado.
 * Se evalúa en orden: la primera coincidencia gana.
 */
function matchAliasFlexible(norm: string): string | null {
  if (!norm) return null
  if (ALIAS[norm]) return ALIAS[norm]
  if (norm.includes('EXFACT') || norm.includes('EX FACT')) return 'fin_entrega'
  if (norm.includes('AUDIT') && norm.includes('FINAL')) return 'auditoria_final'
  if (norm.includes('FIN') && norm.includes('ENTREGA')) return 'fin_entrega'
  if (norm.includes('AUDIT')) return 'auditoria'
  return null
}

export function parsePgo(
  buffer: ArrayBuffer,
  _mapaManual?: Record<string, string>
): ParseResult<PgoRow> {
  const wb = XLSX.read(buffer, { type: 'array', cellDates: false })

  // Buscar hoja que contenga "PGO" en el nombre
  const sheetName =
    wb.SheetNames.find((n) => normalize(n).includes('PGO')) ??
    wb.SheetNames[0]

  const ws = wb.Sheets[sheetName]
  const data: unknown[][] = XLSX.utils.sheet_to_json(ws, {
    header: 1,
    defval: null,
    raw: true,
  }) as unknown[][]

  const rows: PgoRow[] = []
  let leidas = 0
  let omitidas = 0
  const errores: string[] = []
  const columnasFaltantes: string[] = []

  // Buscar cabecera en las primeras 10 filas (puede estar en fila 6-7 con merge)
  let headerRowIdx = -1
  let colMap: Record<string, number> = {}

  for (let r = 0; r < Math.min(10, data.length); r++) {
    const row = data[r] ?? []
    const tmp: Record<string, number> = {}
    for (let c = 0; c < row.length; c++) {
      const norm = normalize(String(row[c] ?? ''))
      const mapped = matchAliasFlexible(norm)
      if (mapped && !(mapped in tmp)) tmp[mapped] = c
    }
    // Necesitamos al menos PO y un campo de fecha
    if ('po' in tmp && ('fin_entrega' in tmp || 'auditoria_final' in tmp)) {
      headerRowIdx = r
      colMap = tmp
      break
    }
  }

  if (headerRowIdx === -1) {
    // Intento con 2 filas de encabezado combinadas (fila 6 + fila 7)
    for (let r = 0; r < Math.min(9, data.length) - 1; r++) {
      const rowA = data[r] ?? []
      const rowB = data[r + 1] ?? []
      const tmp: Record<string, number> = {}
      const combined = rowA.map((v, i) => {
        const a = normalize(String(v ?? ''))
        const b = normalize(String(rowB[i] ?? ''))
        return a || b ? `${a} ${b}`.trim() : ''
      })
      for (let c = 0; c < combined.length; c++) {
        const mapped = matchAliasFlexible(combined[c])
        if (mapped && !(mapped in tmp)) tmp[mapped] = c
      }
      if ('po' in tmp) {
        headerRowIdx = r + 1
        colMap = tmp
        break
      }
    }
  }

  if (headerRowIdx === -1) {
    errores.push(`Hoja "${sheetName}": no se encontró fila de cabecera con PO`)
    return { rows, leidas, validas: 0, omitidas, errores, columnasFaltantes }
  }

  const requeridas = ['po', 'fin_entrega', 'auditoria_final']
  requeridas.forEach((r) => {
    if (!(r in colMap)) columnasFaltantes.push(`PGO:${r}`)
  })

  // Diagnóstico: si fin_entrega/auditoria_final no se mapearon, mostrar los encabezados
  // reales de esa fila para poder ajustar los alias rápidamente.
  if (!('fin_entrega' in colMap) || !('auditoria_final' in colMap)) {
    const headerRow = data[headerRowIdx] ?? []
    const headersTexto = headerRow.map((v) => String(v ?? '').trim()).filter(Boolean).join(' | ')
    errores.push(`PGO: encabezados detectados en fila ${headerRowIdx + 1}: ${headersTexto}`)
  }

  for (let r = headerRowIdx + 1; r < data.length; r++) {
    const row = data[r] ?? []
    const poRaw = row[colMap['po']]
    const po = normalizePO(String(poRaw ?? ''))
    if (!po) { omitidas++; continue }

    leidas++
    rows.push({
      po,
      cliente: String(row[colMap['cliente']] ?? '').trim(),
      estilo: String(row[colMap['estilo']] ?? '').trim(),
      color: String(row[colMap['color']] ?? '').trim(),
      fin_entrega: parseExcelDate(row[colMap['fin_entrega']]),
      auditoria: parseExcelDate(row[colMap['auditoria']]),
      auditoria_final: parseExcelDate(row[colMap['auditoria_final']]),
    })
  }

  return { rows, leidas, validas: rows.length, omitidas, errores, columnasFaltantes }
}
