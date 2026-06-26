import type { ItemCruzado } from '../types'

// Pipeline de áreas en orden de producción
const PIPELINE = [
  { key: 'corte',          label: 'Corte',          field: 'en_corte' },
  { key: 'bordado',        label: 'Bordado',         field: 'en_bordado' },
  { key: 'costura',        label: 'Costura',         field: 'en_costura' },
  { key: 'estampado',      label: 'Estampado',       field: 'en_estampado' },
  { key: 'estampado_ext',  label: 'Estampado Ext',   field: 'en_estampado_ext' },
  { key: 'lavanderia',     label: 'Lavandería',      field: 'en_lavanderia' },
  { key: 'costura_lineas', label: 'Costura Líneas',  field: 'en_costura_lineas' },
  { key: 'acabado',        label: 'Acabado',         field: 'en_acabado' },
  { key: 'apt',            label: 'APT',             field: 'apt' },
] as const

export type EstadoEfectivo =
  | ItemCruzado['estado']
  | 'Exportado'
  | 'Cerrado'
  | 'Por auditar'
  | 'Por Finalizar'
  | 'Finalizando'

export interface UbicacionEtapa {
  key: string
  label: string
  cantidad: number
  ok: boolean
}

export function totalOrden(item: ItemCruzado): number {
  return item.total_requeridas || item.cant_prog || 0
}

/** true cuando todas las prendas están en APT (o producción cerrada). */
export function estaListoParaAuditar(item: ItemCruzado): boolean {
  if (item.produccion_cerrada) return true
  const total = totalOrden(item)
  return total > 0 && item.apt >= total
}

/** Retorna las áreas donde hay prendas ahora mismo, en orden del pipeline. */
export function ubicacionActual(item: ItemCruzado): UbicacionEtapa[] {
  return PIPELINE
    .map(({ key, label, field }) => ({
      key,
      label,
      cantidad: (item[field as keyof ItemCruzado] as number) ?? 0,
      ok: false,
    }))
    .filter((u) => u.cantidad > 0)
}

/**
 * Estado visible en el tablero.
 *
 * Aprobada / Rechazada          → Cerrado
 * Programada / En proceso / ... → se respeta el estado manual
 * Pendiente + apt > 0           → Por auditar
 * Pendiente + en_acabado ≥ total → Por Finalizar
 * Pendiente + en_acabado > 0    → Finalizando
 * Resto                         → Pendiente
 */
export function estadoEfectivo(item: ItemCruzado): EstadoEfectivo {
  if (item.exportado > 0)                                          return 'Exportado'
  if (item.estado === 'Aprobada' || item.estado === 'Rechazada')  return 'Cerrado'
  if (item.estado !== 'Pendiente')                                 return item.estado

  if (item.produccion_cerrada || item.apt > 0)                    return 'Por auditar'

  const total = totalOrden(item)
  if (item.en_acabado > 0 && total > 0 && item.en_acabado >= total) return 'Por Finalizar'
  if (item.en_acabado > 0)                                          return 'Finalizando'

  return 'Pendiente'
}
