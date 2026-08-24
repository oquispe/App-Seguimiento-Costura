import * as XLSX from 'xlsx'
import { normalize, normalizePO } from './normalize'
import type { LineaRow, ParseResult } from '../../types'

function toNum(v: unknown): number {
  if (v === null || v === undefined || v === '') return 0
  const n = Number(v)
  return isNaN(n) ? 0 : n
}

/**
 * El reporte de origen no es consistente entre exportaciones: a veces trae
 * "Linea_Costura" (con guión bajo) y otras "LINEA COSTURA" (con espacio).
 * Se normaliza el guión bajo como si fuera espacio para tolerar ambas.
 */
function normalizeHeader(text: unknown): string {
  return normalize(text).replace(/_/g, ' ').replace(/\s+/g, ' ').trim()
}

// Columnas del reporte "status.xlsm" (hoja StatusCorte)
const COL_ALIAS: Record<string, string> = {
  'PO':             'po',
  'OP':             'op',
  'ESTILO CLIENTE': 'estilo',
  'COLOR PRENDA':   'color',
  'LINEA COSTURA':  'linea',
  'EN ESTANTERIA':  'en_estanteria',
  'EN PROCESO':     'en_proceso',
}

export function parseLineas(buffer: ArrayBuffer): ParseResult<LineaRow> {
  const wb = XLSX.read(buffer, { type: 'array', cellDates: false })

  const sheetName = wb.SheetNames[0]
  const ws = wb.Sheets[sheetName]
  const data: unknown[][] = XLSX.utils.sheet_to_json(ws, {
    header: 1,
    defval: null,
    raw: true,
  }) as unknown[][]

  let leidas = 0
  let omitidas = 0
  const errores: string[] = []
  const columnasFaltantes: string[] = []

  if (data.length === 0) {
    errores.push('La hoja está vacía')
    return { rows: [], leidas, validas: 0, omitidas, errores, columnasFaltantes }
  }

  // Auto-detectar fila de encabezados: buscar en las primeras 15 filas la que tenga "PO"
  let headerRowIdx = -1
  const colIdx: Record<string, number> = {}

  for (let r = 0; r < Math.min(15, data.length); r++) {
    const row = data[r] ?? []
    const tempIdx: Record<string, number> = {}
    for (let c = 0; c < row.length; c++) {
      const norm = normalizeHeader(row[c])
      if (COL_ALIAS[norm] && !(COL_ALIAS[norm] in tempIdx)) tempIdx[COL_ALIAS[norm]] = c
    }
    if ('po' in tempIdx) {
      headerRowIdx = r
      Object.assign(colIdx, tempIdx)
      break
    }
  }

  if (headerRowIdx === -1) {
    errores.push(`Hoja "${sheetName}": no se encontró columna PO en las primeras 15 filas`)
    return { rows: [], leidas, validas: 0, omitidas, errores, columnasFaltantes }
  }

  for (const campo of ['op', 'linea', 'en_estanteria', 'en_proceso']) {
    if (!(campo in colIdx)) columnasFaltantes.push(campo)
  }

  // Acumular por PO+OP+Línea (una línea puede repetirse en varias "partidas")
  const acum = new Map<string, LineaRow>()

  for (let r = headerRowIdx + 1; r < data.length; r++) {
    const row = data[r] ?? []
    const poRaw = row[colIdx['po']]
    const po = normalizePO(String(poRaw ?? ''))
    if (!po) { omitidas++; continue }

    leidas++

    const op     = String(row[colIdx['op']] ?? '').trim()
    const estilo = 'estilo' in colIdx ? String(row[colIdx['estilo']] ?? '').trim() : ''
    const color  = 'color' in colIdx  ? String(row[colIdx['color']] ?? '').trim()  : ''
    const linea  = 'linea' in colIdx  ? String(row[colIdx['linea']] ?? '').trim()  : ''
    const enEst  = 'en_estanteria' in colIdx ? toNum(row[colIdx['en_estanteria']]) : 0
    const enProc = 'en_proceso'    in colIdx ? toNum(row[colIdx['en_proceso']])    : 0

    if (!linea) { omitidas++; continue }

    const key = `${po}|${op}|${normalize(linea)}`
    const existing = acum.get(key)
    if (existing) {
      existing.en_estanteria += enEst
      existing.en_proceso += enProc
    } else {
      acum.set(key, { po, op, estilo, color, linea, en_estanteria: enEst, en_proceso: enProc })
    }
  }

  const rows = Array.from(acum.values())
  return { rows, leidas, validas: rows.length, omitidas, errores, columnasFaltantes }
}
