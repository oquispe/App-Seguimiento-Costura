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

export interface UbicacionEtapa {
  key: string
  label: string
  /** piezas que están en esta área ahora mismo */
  cantidad: number
  ok: boolean
}

export function totalOrden(item: ItemCruzado): number {
  return item.total_requeridas || item.cant_prog || 0
}

/** Producción 100% terminada: cerrada (sin fila en reporte) o todas las prendas en APT. */
export function estaListoParaAuditar(item: ItemCruzado): boolean {
  if (item.produccion_cerrada) return true
  const total = totalOrden(item)
  return total > 0 && item.apt >= total
}

/**
 * Retorna las áreas donde hay prendas ahora mismo, en orden del pipeline.
 * Cada área con cantidad > 0 aparece en el resultado.
 */
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
 * Estado efectivo: si sigue en "Pendiente" pero producción terminada → "Por auditar".
 */
export function estadoEfectivo(item: ItemCruzado): ItemCruzado['estado'] | 'Por auditar' {
  if (item.estado === 'Pendiente' && estaListoParaAuditar(item)) return 'Por auditar'
  return item.estado
}
