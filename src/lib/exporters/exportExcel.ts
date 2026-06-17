import * as XLSX from 'xlsx'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import type { ItemCruzado, ComentarioRecord } from '../../types'

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
    'En Estantería': it.en_estanteria,
    'En Proceso': it.en_proceso,
    'Confeccionadas': it.confeccionadas,
    'Línea Costura': it.linea_costura,
    'Comentarios': comentariosPorKey.get(it.item_key) ?? '',
  }))

  const ws = XLSX.utils.json_to_sheet(wsData)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Seguimiento')

  const fecha = format(new Date(), 'yyyyMMdd_HHmm')
  XLSX.writeFile(wb, `Auditorias_Seguimiento_${fecha}.xlsx`)
}
