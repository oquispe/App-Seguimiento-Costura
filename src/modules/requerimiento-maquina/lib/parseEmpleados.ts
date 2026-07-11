import * as XLSX from 'xlsx'
import type { ParseResult } from '../../../types'
import type { EmpleadoRow } from '../types'

/**
 * Puerto TS del loader de `registros.xlsx` (Proyecto_Balance/Balance/server.py:1118-1179,
 * endpoint /api/empleados). La hoja "registro" tiene encabezados reales en la fila 1;
 * se busca la hoja por nombre y se cae a la primera hoja si no existe.
 */

const COL_DNI = 'DNI'
const COL_NOMBRE = 'Nombres Completos'
const COL_OCUPACION = 'Ocupación'
const COL_CENTRO = 'Centro de Costo'
const COL_CODIGO = 'CODIGO'

function cell(row: Record<string, unknown>, key: string): string {
  const v = row[key]
  if (v === null || v === undefined) return ''
  return String(v).trim()
}

export function parseEmpleados(buffer: ArrayBuffer, fileName = 'registros.xlsx'): ParseResult<EmpleadoRow> {
  const rows: EmpleadoRow[] = []
  let leidas = 0
  let omitidas = 0
  const errores: string[] = []
  const columnasFaltantes: string[] = []

  let wb: XLSX.WorkBook
  try {
    wb = XLSX.read(buffer, { type: 'array' })
  } catch (err) {
    errores.push(`No se pudo leer "${fileName}": ${err instanceof Error ? err.message : String(err)}`)
    return { rows, leidas, validas: 0, omitidas: 1, errores, columnasFaltantes }
  }

  const sheetName = wb.SheetNames.find((n) => n.toLowerCase() === 'registro') ?? wb.SheetNames[0]
  const ws = wb.Sheets[sheetName]
  const data = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: null, raw: true })

  if (data.length === 0) {
    errores.push(`"${fileName}": la hoja "${sheetName}" está vacía`)
    return { rows, leidas: 0, validas: 0, omitidas: 0, errores, columnasFaltantes }
  }

  const columnas = Object.keys(data[0])
  ;[COL_DNI, COL_NOMBRE, COL_OCUPACION, COL_CENTRO, COL_CODIGO].forEach((c) => {
    if (!columnas.includes(c)) columnasFaltantes.push(c)
  })

  for (const row of data) {
    leidas++
    const dni = cell(row, COL_DNI)
    if (!dni || dni.toUpperCase() === 'DNI' || dni.toLowerCase() === 'nan') {
      omitidas++
      continue
    }
    const codigo = cell(row, COL_CODIGO)
    if (!codigo || codigo.toLowerCase() === 'nan') {
      omitidas++
      continue
    }

    rows.push({
      dni,
      nombre_completo: cell(row, COL_NOMBRE),
      ocupacion: cell(row, COL_OCUPACION).toUpperCase(),
      centro_costo: cell(row, COL_CENTRO),
      codigo,
    })
  }

  return { rows, leidas, validas: rows.length, omitidas, errores, columnasFaltantes }
}
