import type { ItemCruzado, OpDetalle } from '../types'
import { normalize } from './parsers/normalize'

// Pipeline de áreas en orden de producción
const PIPELINE = [
  { key: 'corte',          label: 'Corte',          field: 'en_corte' },
  { key: 'bordado',        label: 'Bordado',         field: 'en_bordado' },
  { key: 'costura',        label: 'Costura',         field: 'en_costura' },
  { key: 'estampado',      label: 'Estampado',       field: 'en_estampado' },
  { key: 'estampado_ext',  label: 'Estampado Ext',   field: 'en_estampado_ext' },
  { key: 'transfer',       label: 'Transfer',        field: 'en_transfer' },
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
  | 'Sin datos'

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

type CamposPipeline = Pick<ItemCruzado,
  'en_corte' | 'en_bordado' | 'en_costura' | 'en_estampado' | 'en_estampado_ext' |
  'en_transfer' | 'en_lavanderia' | 'en_costura_lineas' | 'en_acabado' | 'apt'>

function ubicacionDeCampos(campos: CamposPipeline): UbicacionEtapa[] {
  return PIPELINE
    .map(({ key, label, field }) => ({
      key,
      label,
      cantidad: campos[field as keyof CamposPipeline] ?? 0,
      ok: false,
    }))
    .filter((u) => u.cantidad > 0)
}

/** Retorna las áreas donde hay prendas ahora mismo, en orden del pipeline. */
export function ubicacionActual(item: ItemCruzado): UbicacionEtapa[] {
  return ubicacionDeCampos(item)
}

/** Igual que ubicacionActual pero para una OP individual dentro del ítem. */
export function ubicacionActualOp(op: OpDetalle): UbicacionEtapa[] {
  return ubicacionDeCampos(op)
}

/**
 * Líneas de costura donde el ítem tiene prendas ahora mismo (Estantería +
 * Proceso). Se usa para: (1) mostrar la columna "Línea (cantidad)" y (2)
 * decidir cuándo mostrar/ocultar el campo "Fecha Jefe de Sector" — al llegar
 * a 0 la línea desaparece de esta lista y el campo se oculta solo.
 */
export function ubicacionLineas(item: ItemCruzado): UbicacionEtapa[] {
  return (item.lineas ?? [])
    .filter((l) => l.cantidad > 0)
    .map((l) => ({ key: normalize(l.linea), label: l.linea, cantidad: l.cantidad, ok: false }))
}

/** true cuando una OP individual ya tiene todas sus prendas en APT. */
export function opListo(op: OpDetalle): boolean {
  return op.total_requeridas > 0 && op.apt >= op.total_requeridas
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

  // Sin match en el Status: no se sabe dónde están las prendas
  if (item.produccion_cerrada)                                     return 'Sin datos'

  if (item.apt > 0)                                                return 'Por auditar'

  const total = totalOrden(item)
  if (item.en_acabado > 0 && total > 0 && item.en_acabado >= total) return 'Por Finalizar'
  if (item.en_acabado > 0)                                          return 'Finalizando'

  return 'Pendiente'
}
