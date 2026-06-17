import * as XLSX from 'xlsx'
import { normalize, normalizePO } from './normalize'
import type { CortesRow, ParseResult } from '../../types'

const ALIAS: Record<string, string> = {
  // Identificadores
  'PO': 'po',
  'CLIENTE': 'cliente',
  'COLOR': 'color',
  'COLOR PRENDA': 'color',
  'COLOR CLIENTE': 'color',
  // Ruta
  'RUTA PRENDA': 'ruta',
  'RUTA': 'ruta',
  // Costura (EN ESTANTERIA = piezas habilitadas esperando costura)
  'EN ESTANTERIA': 'en_estanteria',
  'EN ESTANTERÍA': 'en_estanteria',
  'ESTANTERIA': 'en_estanteria',
  'EN PROCESO': 'en_proceso',
  'CONFECCIONADAS': 'confeccionadas',
  'CONFEC': 'confeccionadas',
  // Bordado
  'PRENDAS EN BORDADO': 'en_bordado',
  'EN BORDADO': 'en_bordado',
  'BORDADO': 'en_bordado',
  'EN BORDADO EXTERNO': 'en_bordado',
  'BORDADO EXTERNO': 'en_bordado',
  'BORDADAS': 'bordadas',
  // Estampado
  'PRENDAS EN ESTAMPADO': 'en_estampado',
  'EN ESTAMPADO': 'en_estampado',
  'ESTAMPADO': 'en_estampado',
  'EN ESTAMPADO EXTERNO': 'en_estampado',
  'ESTAMPADO EXTERNO': 'en_estampado',
  'ESTAMPADAS': 'estampadas',
  // Corte (antes de costura → estantería)
  'EN CORTE': 'en_estanteria',
  'CORTE': 'en_estanteria',
  // Transfer (post-costura, "EN PRENDA")
  'EN TRANSFER': 'en_transfer',
  'TRANSFER TERMINADAS': 'transfer_terminadas',
  // Lavandería
  'EN LAVANDERIA': 'en_lavanderia',
  'EN LAVANDERÍA': 'en_lavanderia',
  'LAVADAS': 'lavadas',
  // Acabados: ingreso real a la etapa final, separado por calidad
  'INGRESOS ACABADOS 1RA': 'ingresos_acabados_1ra',
  'INGRESOS ACABADOS 2DA': 'ingresos_acabados_2da',
  // Total requerido (es el mismo para todas las partidas del OP; usamos MAX)
  'PRENDAS REQUERIDAS OP': 'total_requeridas',
  'PRENDAS REQUERIDAS': 'total_requeridas',
  'CANT TOTAL': 'total_requeridas',
  // Línea de costura: texto (nombre del taller/línea), NO es un número
  'LINEA COSTURA': 'linea_costura',
  'LÍNEA COSTURA': 'linea_costura',
  'LINEA': 'linea_costura',
  'L. COSTURA': 'linea_costura',
}

function toNum(v: unknown): number {
  if (v === null || v === undefined || v === '') return 0
  const n = Number(v)
  return isNaN(n) ? 0 : n
}

export function parseCortes(
  buffer: ArrayBuffer,
  _mapaManual?: Record<string, string>
): ParseResult<CortesRow> {
  const wb = XLSX.read(buffer, { type: 'array', cellDates: false })

  const sheetName =
    wb.SheetNames.find((n) => normalize(n).includes('STATUSCORTE') || normalize(n).includes('STATUS CORTE')) ??
    wb.SheetNames[0]

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

  // Buscar cabecera en las primeras 10 filas
  let headerRowIdx = -1
  let colMap: Record<string, number> = {}

  for (let r = 0; r < Math.min(10, data.length); r++) {
    const row = data[r] ?? []
    const tmp: Record<string, number> = {}
    for (let c = 0; c < row.length; c++) {
      const norm = normalize(String(row[c] ?? ''))
      const mapped = ALIAS[norm]
      if (mapped && !(mapped in tmp)) tmp[mapped] = c
    }
    if ('po' in tmp) {
      headerRowIdx = r
      colMap = tmp
      break
    }
  }

  if (headerRowIdx === -1) {
    errores.push(`Hoja "${sheetName}": no se encontró columna PO`)
    return { rows: [], leidas, validas: 0, omitidas, errores, columnasFaltantes }
  }


  const requeridas = ['po', 'en_estanteria', 'en_proceso', 'confeccionadas']
  requeridas.forEach((r) => {
    if (!(r in colMap)) columnasFaltantes.push(`Cortes:${r}`)
  })

  // Acumulador por PO+COLOR (agregamos todas las partidas del mismo PO y color)
  const acum = new Map<string, CortesRow>()

  for (let r = headerRowIdx + 1; r < data.length; r++) {
    const row = data[r] ?? []
    const poRaw = row[colMap['po']]
    const po = normalizePO(String(poRaw ?? ''))
    if (!po) { omitidas++; continue }

    leidas++
    const colorRaw = colMap['color'] !== undefined ? String(row[colMap['color']] ?? '').trim() : ''
    const key = `${po}|${normalize(colorRaw)}`

    const existing = acum.get(key)

    const cliente = colMap['cliente'] !== undefined ? String(row[colMap['cliente']] ?? '').trim() : ''
    const rutaStr = colMap['ruta'] !== undefined ? String(row[colMap['ruta']] ?? '').trim() : ''
    const est     = toNum(colMap['en_estanteria'] !== undefined ? row[colMap['en_estanteria']] : 0)
    const proc    = toNum(colMap['en_proceso'] !== undefined ? row[colMap['en_proceso']] : 0)
    const conf    = toNum(colMap['confeccionadas'] !== undefined ? row[colMap['confeccionadas']] : 0)
    const enBord  = toNum(colMap['en_bordado'] !== undefined ? row[colMap['en_bordado']] : 0)
    const bord    = toNum(colMap['bordadas'] !== undefined ? row[colMap['bordadas']] : 0)
    const enEst   = toNum(colMap['en_estampado'] !== undefined ? row[colMap['en_estampado']] : 0)
    const estMp   = toNum(colMap['estampadas'] !== undefined ? row[colMap['estampadas']] : 0)
    const enTrans = toNum(colMap['en_transfer'] !== undefined ? row[colMap['en_transfer']] : 0)
    const transTerm = toNum(colMap['transfer_terminadas'] !== undefined ? row[colMap['transfer_terminadas']] : 0)
    const enLav   = toNum(colMap['en_lavanderia'] !== undefined ? row[colMap['en_lavanderia']] : 0)
    const lav     = toNum(colMap['lavadas'] !== undefined ? row[colMap['lavadas']] : 0)
    const ing1ra  = toNum(colMap['ingresos_acabados_1ra'] !== undefined ? row[colMap['ingresos_acabados_1ra']] : 0)
    const ing2da  = toNum(colMap['ingresos_acabados_2da'] !== undefined ? row[colMap['ingresos_acabados_2da']] : 0)
    // PRENDAS REQUERIDAS OP es la misma para todas las partidas del OP → tomamos MAX
    const totReq  = toNum(colMap['total_requeridas'] !== undefined ? row[colMap['total_requeridas']] : 0)
    const linTxt  = colMap['linea_costura'] !== undefined ? String(row[colMap['linea_costura']] ?? '').trim() : ''

    if (existing) {
      existing.en_estanteria += est
      existing.en_proceso += proc
      existing.confeccionadas += conf
      existing.en_bordado += enBord
      existing.bordadas += bord
      existing.en_estampado += enEst
      existing.estampadas += estMp
      existing.en_transfer += enTrans
      existing.transfer_terminadas += transTerm
      existing.en_lavanderia += enLav
      existing.lavadas += lav
      existing.ingresos_acabados_1ra += ing1ra
      existing.ingresos_acabados_2da += ing2da
      existing.en_acabados = existing.ingresos_acabados_1ra + existing.ingresos_acabados_2da
      existing.piezas_acabadas = existing.en_acabados
      // PRENDAS REQUERIDAS OP: tomar el máximo (es el total del OP, mismo para todas las partidas)
      if (totReq > existing.total_requeridas) existing.total_requeridas = totReq
      // RUTA: tomar el primero no vacío
      if (!existing.ruta && rutaStr) existing.ruta = rutaStr
      // Línea costura: concatenar distintos talleres
      if (linTxt && !existing.linea_costura.includes(linTxt)) {
        existing.linea_costura = existing.linea_costura
          ? `${existing.linea_costura} / ${linTxt}`
          : linTxt
      }
    } else {
      acum.set(key, {
        po,
        cliente,
        color: colorRaw,
        ruta: rutaStr,
        en_estanteria: est,
        en_proceso: proc,
        confeccionadas: conf,
        en_bordado: enBord,
        bordadas: bord,
        en_estampado: enEst,
        estampadas: estMp,
        en_transfer: enTrans,
        transfer_terminadas: transTerm,
        en_lavanderia: enLav,
        lavadas: lav,
        ingresos_acabados_1ra: ing1ra,
        ingresos_acabados_2da: ing2da,
        en_acabados: ing1ra + ing2da,
        piezas_acabadas: ing1ra + ing2da,
        total_requeridas: totReq,
        linea_costura: linTxt,
      })
    }
  }

  const rows = Array.from(acum.values())

  return { rows, leidas, validas: rows.length, omitidas, errores, columnasFaltantes }
}
