import * as XLSX from 'xlsx'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import type { ItemCruzado, ComentarioRecord } from '../../types'
import type { CompromisoRow } from '../compromisos'

function fmtDate(d: Date | null | undefined): string {
  if (!d) return ''
  try {
    return format(new Date(d), 'dd/MM/yyyy', { locale: es })
  } catch {
    return ''
  }
}

export function exportarExcel(
  items: ItemCruzado[],
  comentarios: ComentarioRecord[]
): void {
  const comentariosPorKey = new Map<string, string>()
  for (const c of comentarios) {
    const prev = comentariosPorKey.get(c.item_key) ?? ''
    comentariosPorKey.set(c.item_key, prev ? `${prev}\n${c.texto}` : c.texto)
  }

  const wsData = items.map((it) => ({
    'Semana': it.semana,
    'Cliente': it.cliente,
    'Estilo': it.estilo,
    'PO': it.po,
    'Color': it.color,
    'Cant. Prog.': it.cant_prog ?? '',
    'Externa': it.externa ?? '',
    'Fin Entrega': fmtDate(it.fin_entrega),
    'Auditoría Final': fmtDate(it.auditoria_final),
    'Días a Audit. Final': it.dias_auditoria_final ?? '',
    'Semáforo': it.semaforo,
    'Estado': it.estado,
    'Responsable': it.responsable ?? '',
    'Solicitado Por': it.solicitado_por ?? '',
    'Fecha Solicitada': it.fecha_solicitada ?? '',
    'Fecha Auditoría': it.fecha_auditoria ?? '',
    'Resultado/Hallazgos': it.resultado ?? '',
    'OP': it.op,
    'En Corte': it.en_corte,
    'En Bordado': it.en_bordado,
    'En Costura': it.en_costura,
    'En Estampado': it.en_estampado,
    'En Estampado Ext': it.en_estampado_ext,
    'En Transfer': it.en_transfer,
    'En Lavandería': it.en_lavanderia,
    'En Costura Líneas': it.en_costura_lineas,
    'En Acabado': it.en_acabado,
    'APT': it.apt,
    'Comentarios': comentariosPorKey.get(it.item_key) ?? '',
  }))

  const ws = XLSX.utils.json_to_sheet(wsData)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Seguimiento')

  const fecha = format(new Date(), 'yyyyMMdd_HHmm')
  XLSX.writeFile(wb, `Auditorias_Seguimiento_${fecha}.xlsx`)
}

function fmtFecha(s: string | null): string {
  if (!s) return ''
  try {
    return format(new Date(s + 'T12:00:00'), 'dd/MM/yyyy', { locale: es })
  } catch {
    return ''
  }
}

/** Envuelve un texto largo en líneas de ~100 caracteres para que quepan en una celda de Excel */
function envolverTexto(texto: string, ancho = 100): string[] {
  const palabras = texto.split(/\s+/)
  const lineas: string[] = []
  let actual = ''
  for (const palabra of palabras) {
    if ((actual + ' ' + palabra).trim().length > ancho) {
      if (actual) lineas.push(actual.trim())
      actual = palabra
    } else {
      actual = `${actual} ${palabra}`.trim()
    }
  }
  if (actual) lineas.push(actual.trim())
  return lineas
}

export function exportarCompromisos(rows: CompromisoRow[], resumenIA?: string | null): void {
  const wb = XLSX.utils.book_new()

  // ── Hoja 1: Resumen ejecutivo ──────────────────────────────────────────
  const total = rows.length
  const vencidos = rows.filter((r) => r.vencido).length
  const vigentes = total - vencidos
  const fechaGeneracion = format(new Date(), "dd/MM/yyyy HH:mm", { locale: es })

  const resumenAoa: (string | number)[][] = [
    ['Resumen de Compromisos para Seguimiento'],
    [`Generado: ${fechaGeneracion}`],
    [],
    ['Total compromisos', total],
    ['Vencidos', vencidos],
    ['Vigentes', vigentes],
    [],
  ]
  if (resumenIA) {
    resumenAoa.push(['Resumen IA'])
    for (const linea of envolverTexto(resumenIA)) resumenAoa.push([linea])
  }

  const wsResumen = XLSX.utils.aoa_to_sheet(resumenAoa)
  wsResumen['!cols'] = [{ wch: 100 }]
  XLSX.utils.book_append_sheet(wb, wsResumen, 'Resumen')

  // ── Hoja 2: Detalle de compromisos ─────────────────────────────────────
  const wsData = rows.map((r) => ({
    'Cliente': r.cliente,
    'Estilo': r.estilo,
    'PO': r.po,
    'Color': r.color,
    'Semana': r.semana,
    'Área': r.areaLabel,
    'Comprometidos': r.comprometidos ?? '',
    'Fecha Compromiso': fmtFecha(r.fecha_compromiso),
    'Próxima Reunión': fmtFecha(r.proxima_reunion),
    'Estado': r.vencido ? 'Vencido' : 'Vigente',
    'Notas': r.notas ?? '',
  }))

  const ws = XLSX.utils.json_to_sheet(wsData)
  ws['!cols'] = [
    { wch: 22 }, // Cliente
    { wch: 14 }, // Estilo
    { wch: 14 }, // PO
    { wch: 18 }, // Color
    { wch: 10 }, // Semana
    { wch: 16 }, // Área
    { wch: 14 }, // Comprometidos
    { wch: 16 }, // Fecha Compromiso
    { wch: 16 }, // Próxima Reunión
    { wch: 10 }, // Estado
    { wch: 40 }, // Notas
  ]
  XLSX.utils.book_append_sheet(wb, ws, 'Compromisos')

  const fecha = format(new Date(), 'yyyyMMdd_HHmm')
  XLSX.writeFile(wb, `Compromisos_Seguimiento_${fecha}.xlsx`)
}
