import * as XLSX from 'xlsx'
import type { ParseResult } from '../../../types'
import type { BalanceReport, OperacionBalance, OperarioBalance } from '../types'

/**
 * Puerto TS de `parse_balance_excel` (Proyecto_Balance/Balance/app.py:959-1141).
 * Replica la máquina de estados fila a fila (no una detección de columnas por
 * nombre): columna 0 numérica = nuevo operario, columna 2 presente = operación
 * adicional del operario actual, columna 9 presente con 0 y 2 vacías = fila de
 * totales del operario. El orden if/elif de las etiquetas de metadata también
 * se replica tal cual (incluye una rama "varia_tarifado" que en el original
 * nunca se alcanza porque "TARIFADO" siempre matchea primero — se mantiene por
 * fidelidad con el archivo real usado como referencia de verdad).
 */

function isEmptyCell(v: unknown): boolean {
  if (v === null || v === undefined) return true
  const s = String(v).trim()
  return s === '' || s.toLowerCase() === 'nan'
}

function cleanValue(v: unknown): string {
  if (isEmptyCell(v)) return ''
  return String(v).trim().replace(/\s+/g, ' ')
}

function isItemNumber(v: unknown): boolean {
  if (typeof v === 'number') return Number.isInteger(v)
  if (typeof v === 'string') return /^\d+$/.test(v.trim())
  return false
}

function scanForward(rowList: string[], fromIdx: number): string | null {
  for (let k = fromIdx; k < rowList.length; k++) {
    const v = rowList[k].trim()
    if (v && v.toLowerCase() !== 'nan') return v
  }
  return null
}

export function parseBalanceExcel(buffer: ArrayBuffer, fileName = 'archivo.xlsx'): ParseResult<BalanceReport> {
  const rows: BalanceReport[] = []
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

  leidas = 1
  const ws = wb.Sheets[wb.SheetNames[0]]
  const data: unknown[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null, raw: true }) as unknown[][]

  const metadata: Record<string, string> = {}

  for (let i = 0; i < Math.min(20, data.length); i++) {
    const row = data[i] ?? []
    const rowList = row.map((v) => (isEmptyCell(v) ? '' : String(v)))

    for (let j = 0; j < rowList.length; j++) {
      const val = rowList[j]
      const valUpper = val.trim().toUpperCase()
      if (!valUpper) continue

      if (valUpper.includes('ESTILO CLIENTE')) {
        metadata.estilo_cliente = cleanValue(rowList[2])
      } else if (valUpper.includes('CLIENTE') && !valUpper.includes('ESTILO')) {
        metadata.cliente = cleanValue(rowList[2])
      } else if (valUpper.includes('TARIFADO')) {
        metadata.tarifado = cleanValue(rowList[2])
      } else if (valUpper.includes('VARIA') && valUpper.includes('TARIFADO')) {
        metadata.varia_tarifado = cleanValue(rowList[2])
      } else if (valUpper.includes('D. DE PRENDA') || valUpper.includes('D.DE PRENDA')) {
        metadata.d_prenda = cleanValue(rowList[2])
      } else if (valUpper.includes('OP') && valUpper.includes('USAN')) {
        metadata.op = cleanValue(rowList[2])
      } else if (valUpper.includes('USUARIO DE PRENDA')) {
        metadata.usuario_prenda = cleanValue(rowList[2])
      } else if (val.trim() === 'Tela' && j === 0) {
        metadata.tela = cleanValue(rowList[2])
      } else if ((valUpper.includes('LINEA:') || valUpper.includes('LÍNEA:')) && !valUpper.includes('BALANCE')) {
        const v = scanForward(rowList, j + 1)
        if (v) metadata.linea = v
      } else if (valUpper.includes('NRO OPERARIOS')) {
        const v = scanForward(rowList, j + 1)
        if (v) metadata.nro_operarios = v
      } else if (valUpper.includes('TIEMPO STD')) {
        const v = scanForward(rowList, j + 1)
        if (v) metadata.tiempo_std = v
      } else if (valUpper.includes('EFICIENCIA') && valUpper.includes('%')) {
        const v = scanForward(rowList, j + 1)
        if (v) metadata.eficiencia = v
      } else if (valUpper.includes('CUOTA DIARIA') && valUpper.includes('PRENDA')) {
        const v = scanForward(rowList, j + 1)
        if (v) metadata.cuota_diaria = v
      } else if (valUpper.includes('CUOTA DIARIA') && valUpper.includes('MINUTO')) {
        const v = scanForward(rowList, j + 1)
        if (v) metadata.cuota_diaria_minuto = v
      } else if (valUpper.includes('MINUTOS DISPONIBLES') && !valUpper.includes('TOTAL')) {
        const v = scanForward(rowList, j + 1)
        if (v) metadata.minutos_disponibles = v
      } else if (valUpper.includes('MINUTOS DISPONIBLES') && valUpper.includes('TOTAL')) {
        const v = scanForward(rowList, j + 1)
        if (v) metadata.minutos_disponibles_total = v
      } else if (valUpper.includes('MINUTOS LIBRES') && valUpper.includes('TOTAL')) {
        const v = scanForward(rowList, j + 1)
        if (v) metadata.minutos_libres_total = v
      }
    }
  }

  let headerRow = -1
  for (let i = 0; i < data.length; i++) {
    const row = data[i] ?? []
    if (row.some((v) => !isEmptyCell(v) && String(v).toUpperCase().includes('NOMBRE Y APELLIDO'))) {
      headerRow = i
      break
    }
  }

  const operarios: OperarioBalance[] = []

  if (headerRow === -1) {
    columnasFaltantes.push('NOMBRE Y APELLIDO (fila de cabecera de operarios)')
  } else {
    let current: OperarioBalance | null = null

    for (let i = headerRow + 1; i < data.length; i++) {
      const row = data[i] ?? []
      const itemVal = row[0]
      const col1 = row[1]
      const col2 = row[2]
      const col9 = row[9]

      if (!isEmptyCell(itemVal) && isItemNumber(itemVal)) {
        current = {
          item: Math.trunc(Number(itemVal)),
          nombre: cleanValue(col1),
          operaciones: [],
          total_minutos: null,
          minutos_libres: null,
          indice_desocup: null,
          efc_indiv: null,
        }
        const op = buildOperacion(row)
        if (op.codigo) current.operaciones.push(op)
        operarios.push(current)
      } else if (current !== null && isEmptyCell(itemVal) && !isEmptyCell(col2)) {
        const op = buildOperacion(row)
        if (op.codigo) current.operaciones.push(op)
      } else if (current !== null && isEmptyCell(itemVal) && isEmptyCell(col2) && !isEmptyCell(col9)) {
        current.total_minutos = cleanValue(col9)
        current.minutos_libres = cleanValue(row[10])
        current.indice_desocup = cleanValue(row[11])
        current.efc_indiv = cleanValue(row[12])
      }
    }
  }

  if (operarios.length === 0) {
    errores.push(`"${fileName}": no se encontraron operarios en el archivo`)
    return { rows, leidas, validas: 0, omitidas: 1, errores, columnasFaltantes }
  }

  const report: BalanceReport = {
    report_key: fileName,
    archivo_original: fileName,
    estilo_cliente: metadata.estilo_cliente ?? null,
    cliente: metadata.cliente ?? null,
    tarifado: metadata.tarifado ?? null,
    varia_tarifado: metadata.varia_tarifado ?? null,
    d_prenda: metadata.d_prenda ?? null,
    op: metadata.op ?? null,
    usuario_prenda: metadata.usuario_prenda ?? null,
    tela: metadata.tela ?? null,
    linea: metadata.linea ?? null,
    nro_operarios: metadata.nro_operarios ?? null,
    tiempo_std: metadata.tiempo_std ?? null,
    eficiencia: metadata.eficiencia ?? null,
    cuota_diaria: metadata.cuota_diaria ?? null,
    cuota_diaria_minuto: metadata.cuota_diaria_minuto ?? null,
    minutos_disponibles: metadata.minutos_disponibles ?? null,
    minutos_disponibles_total: metadata.minutos_disponibles_total ?? null,
    minutos_libres_total: metadata.minutos_libres_total ?? null,
    operarios,
    estado: 'NO CONSOLIDADO',
  }

  rows.push(report)
  return { rows, leidas, validas: 1, omitidas, errores, columnasFaltantes }
}

function buildOperacion(row: unknown[]): OperacionBalance {
  return {
    codigo: cleanValue(row[2]),
    descripcion: cleanValue(row[3]),
    maquina: cleanValue(row[4]),
    t_std: cleanValue(row[5]),
    cantidad: cleanValue(row[6]),
    potencial: cleanValue(row[7]),
    minutos_req: cleanValue(row[8]),
  }
}
