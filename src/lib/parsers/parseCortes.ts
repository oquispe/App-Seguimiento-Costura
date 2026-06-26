import * as XLSX from 'xlsx'
import { normalize, normalizePO } from './normalize'
import type { CortesRow, ParseResult } from '../../types'

function toNum(v: unknown): number {
  if (v === null || v === undefined || v === '') return 0
  const n = Number(v)
  return isNaN(n) ? 0 : n
}

// Columnas de identificación en Hoja1
const ID_ALIAS: Record<string, string> = {
  'PO':             'po',
  'OP':             'op',
  'CLIENTE':        'cliente',
  'COLOR CLIENTE':  'color',
  'RUTA_GENERAL':   'ruta',
  'RUTA GENERAL':   'ruta',
  'REQUERIDA':      'total_requeridas',
}

// Mapeo Hoja2: field → [col1 normalizada, col2 normalizada]
// col1 vacío = solo col2 contribuye
const AREA_MAP: { field: keyof Pick<CortesRow,
  'en_corte'|'en_bordado'|'en_costura'|'en_estampado'|'en_estampado_ext'|
  'en_lavanderia'|'en_costura_lineas'|'en_acabado'|'apt'>
  col1: string; col2: string }[] = [
  { field: 'en_corte',          col1: 'POR CORTAR',            col2: 'EN CORTE' },
  { field: 'en_bordado',        col1: 'BORDADO PZA',           col2: 'BORDADO PDA' },
  { field: 'en_costura',        col1: 'ESTANTERIA',            col2: 'COSTURA PROCESO' },
  { field: 'en_estampado',      col1: 'ESTAMPADO PZA CHINCHA', col2: 'ESTAMPADO PDA CHINCHA' },
  { field: 'en_estampado_ext',  col1: 'ESTAMPADO PZA EXT',     col2: 'ESTAMPADO PDA EXT' },
  { field: 'en_lavanderia',     col1: '',                      col2: 'LAVANDERIA_PDA' },
  { field: 'en_costura_lineas', col1: '',                      col2: 'COSTURA LINEAS' },
  { field: 'en_acabado',        col1: '',                      col2: 'ACABADO' },
  { field: 'apt',               col1: '',                      col2: 'APT' },
]

export function parseCortes(
  buffer: ArrayBuffer,
  _mapaManual?: Record<string, string>
): ParseResult<CortesRow> {
  const wb = XLSX.read(buffer, { type: 'array', cellDates: false })

  // Usar Hoja1 (primera hoja)
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
    errores.push('Hoja1 está vacía')
    return { rows: [], leidas, validas: 0, omitidas, errores, columnasFaltantes }
  }

  // Leer cabecera (fila 0)
  const headerRow = data[0] ?? []
  const colIdx: Record<string, number> = {}

  for (let c = 0; c < headerRow.length; c++) {
    const norm = normalize(String(headerRow[c] ?? ''))
    // Mapear identificadores
    if (ID_ALIAS[norm] && !(ID_ALIAS[norm] in colIdx)) {
      colIdx[ID_ALIAS[norm]] = c
    }
    // Mapear columnas de área por nombre normalizado
    for (const area of AREA_MAP) {
      if (area.col1 && norm === area.col1 && !(`${area.field}_c1` in colIdx)) {
        colIdx[`${area.field}_c1`] = c
      }
      if (area.col2 && norm === area.col2 && !(`${area.field}_c2` in colIdx)) {
        colIdx[`${area.field}_c2`] = c
      }
    }
  }

  if (!('po' in colIdx)) {
    errores.push(`Hoja "${sheetName}": no se encontró columna PO`)
    return { rows: [], leidas, validas: 0, omitidas, errores, columnasFaltantes }
  }

  // Verificar columnas faltantes
  for (const area of AREA_MAP) {
    if (area.col1 && !(`${area.field}_c1` in colIdx)) columnasFaltantes.push(`${area.field}:col1`)
    if (area.col2 && !(`${area.field}_c2` in colIdx)) columnasFaltantes.push(`${area.field}:col2`)
  }

  // Acumular por PO+COLOR
  const acum = new Map<string, CortesRow>()

  for (let r = 1; r < data.length; r++) {
    const row = data[r] ?? []
    const poRaw = row[colIdx['po']]
    const po = normalizePO(String(poRaw ?? ''))
    if (!po) { omitidas++; continue }

    leidas++

    const op      = String(row[colIdx['op']] ?? '').trim()
    const cliente = 'cliente' in colIdx ? String(row[colIdx['cliente']] ?? '').trim() : ''
    const color   = 'color' in colIdx   ? String(row[colIdx['color']] ?? '').trim() : ''
    const ruta    = 'ruta' in colIdx    ? String(row[colIdx['ruta']] ?? '').trim() : ''
    const totReq  = 'total_requeridas' in colIdx ? toNum(row[colIdx['total_requeridas']]) : 0

    const key = `${po}|${normalize(color)}`
    const existing = acum.get(key)

    const areaVals: Record<string, number> = {}
    for (const area of AREA_MAP) {
      const v1 = area.col1 && `${area.field}_c1` in colIdx ? toNum(row[colIdx[`${area.field}_c1`]]) : 0
      const v2 = `${area.field}_c2` in colIdx ? toNum(row[colIdx[`${area.field}_c2`]]) : 0
      areaVals[area.field] = v1 + v2
    }

    if (existing) {
      for (const area of AREA_MAP) existing[area.field] += areaVals[area.field]
      if (totReq > existing.total_requeridas) existing.total_requeridas = totReq
      if (!existing.ruta && ruta) existing.ruta = ruta
    } else {
      acum.set(key, {
        po,
        op,
        cliente,
        color,
        ruta,
        en_corte:          areaVals['en_corte'],
        en_bordado:        areaVals['en_bordado'],
        en_costura:        areaVals['en_costura'],
        en_estampado:      areaVals['en_estampado'],
        en_estampado_ext:  areaVals['en_estampado_ext'],
        en_lavanderia:     areaVals['en_lavanderia'],
        en_costura_lineas: areaVals['en_costura_lineas'],
        en_acabado:        areaVals['en_acabado'],
        apt:               areaVals['apt'],
        total_requeridas:  totReq,
      })
    }
  }

  const rows = Array.from(acum.values())
  return { rows, leidas, validas: rows.length, omitidas, errores, columnasFaltantes }
}
