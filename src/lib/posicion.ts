import type { ItemCruzado } from '../types'

export interface EtapaInfo {
  key: string
  label: string
  rutaKeywords: string[]
  /** piezas físicamente en proceso en esta etapa ahora mismo */
  enCurso: number
  /** piezas que ya salieron de esta etapa (pasaron a la siguiente) */
  terminadas: number
}

export function buildEtapas(item: ItemCruzado): EtapaInfo[] {
  return [
    { key: 'costura', label: 'Costura', rutaKeywords: ['COSTURA'], enCurso: item.en_estanteria + item.en_proceso, terminadas: item.confeccionadas },
    { key: 'bordado', label: 'Bordado', rutaKeywords: ['BORDADO'], enCurso: item.en_bordado, terminadas: item.bordadas },
    { key: 'estampado', label: 'Estampado', rutaKeywords: ['ESTAMPADO'], enCurso: item.en_estampado, terminadas: item.estampadas },
    { key: 'transfer', label: 'Transfer', rutaKeywords: ['TRANSFER'], enCurso: item.en_transfer, terminadas: item.transfer_terminadas },
    { key: 'lavanderia', label: 'Lavandería', rutaKeywords: ['LAVANDERIA', 'LAVANDERÍA'], enCurso: item.en_lavanderia, terminadas: item.lavadas },
    { key: 'acabados', label: 'Acabados', rutaKeywords: ['ACABADO'], enCurso: Math.max(item.en_acabados - item.piezas_acabadas, 0), terminadas: item.piezas_acabadas },
  ]
}

function parseRuta(ruta: string): string[] {
  return ruta.match(/\(([^)]+)\)/g)?.map((s) => s.slice(1, -1).toUpperCase()) ?? []
}

/** Etapas planificadas en la ruta del ítem (aunque aún no tengan piezas), más cualquiera con actividad. */
export function etapasEnRuta(item: ItemCruzado): EtapaInfo[] {
  const rutaSegs = parseRuta(item.ruta)
  return buildEtapas(item).filter((e) => {
    const enRuta = e.rutaKeywords.some((kw) => rutaSegs.some((s) => s.includes(kw)))
    return enRuta || e.enCurso > 0 || e.terminadas > 0
  })
}

export function totalOrden(item: ItemCruzado): number {
  return item.total_requeridas || item.cant_prog || 0
}

/** Producción 100% terminada: ya cerrada (sin fila en Cortes) o todas las piezas acabadas. */
export function estaListoParaAuditar(item: ItemCruzado): boolean {
  if (item.produccion_cerrada) return true
  const total = totalOrden(item)
  return total > 0 && item.piezas_acabadas >= total
}

/**
 * Estado a mostrar/filtrar: si el seguimiento sigue en "Pendiente" pero la producción
 * ya está completa, se considera "Por auditar" en vez de "Pendiente".
 */
export function estadoEfectivo(item: ItemCruzado): ItemCruzado['estado'] | 'Por auditar' {
  if (item.estado === 'Pendiente' && estaListoParaAuditar(item)) return 'Por auditar'
  return item.estado
}

/** Solo las etapas con actividad real: algo en proceso ahí, o que ya pasaron por ahí. */
export function etapasActivas(item: ItemCruzado): EtapaInfo[] {
  return buildEtapas(item).filter((e) => e.enCurso > 0 || e.terminadas > 0)
}

// ─── Ubicación actual (vista compacta: dónde están las prendas AHORA) ─────────

const PIPELINE: { key: string; label: string; rutaKeywords: string[] }[] = [
  { key: 'costura', label: 'Costura', rutaKeywords: ['COSTURA'] },
  { key: 'bordado', label: 'Bordado', rutaKeywords: ['BORDADO'] },
  { key: 'estampado', label: 'Estampado', rutaKeywords: ['ESTAMPADO'] },
  { key: 'transfer', label: 'Transfer', rutaKeywords: ['TRANSFER'] },
  { key: 'lavanderia', label: 'Lavandería', rutaKeywords: ['LAVANDERIA', 'LAVANDERÍA'] },
  { key: 'acabados', label: 'Acabados', rutaKeywords: ['ACABADO'] },
]

function salidaEtapa(item: ItemCruzado, key: string): number {
  switch (key) {
    case 'costura': return item.confeccionadas
    case 'bordado': return item.bordadas
    case 'estampado': return item.estampadas
    case 'transfer': return item.transfer_terminadas
    case 'lavanderia': return item.lavadas
    case 'acabados': return item.en_acabados
    default: return 0
  }
}

/** Piezas físicamente detenidas en la etapa ahora mismo, cuando el reporte sí la rastrea. */
function enProcesoExplicito(item: ItemCruzado, key: string): number | null {
  switch (key) {
    case 'costura':     return item.en_estanteria + item.en_proceso
    case 'transfer':    return item.en_transfer
    case 'lavanderia':  return item.en_lavanderia
    default:             return null // bordado/estampado en prenda: el reporte no trae "en proceso", se infiere por diferencia
  }
}

export interface UbicacionEtapa {
  key: string
  label: string
  /** piezas detenidas ahí ahora mismo (o, si es la última etapa de la ruta, piezas que ya llegaron y esperan auditoría) */
  cantidad: number
  /** true = la etapa ya fue superada por completo, sin piezas pendientes ahí */
  ok: boolean
}

/**
 * Resume en qué etapa(s) están las prendas AHORA, en el orden real del pipeline.
 * Etapas ya superadas → ok=true (sin cantidad). Etapas con piezas detenidas → cantidad > 0.
 * Etapas que aún no arrancan (sin ruta ni actividad) se omiten.
 */
export function ubicacionActual(item: ItemCruzado): UbicacionEtapa[] {
  const rutaSegs = parseRuta(item.ruta)
  let stages = PIPELINE.filter((s) => s.rutaKeywords.some((kw) => rutaSegs.some((seg) => seg.includes(kw))))
  if (!stages.some((s) => s.key === 'costura')) stages = [PIPELINE[0], ...stages]
  if (!stages.some((s) => s.key === 'acabados')) stages = [...stages, PIPELINE[PIPELINE.length - 1]]
  stages = PIPELINE.filter((s) => stages.some((x) => x.key === s.key))

  const resultado: UbicacionEtapa[] = []
  let salidaPrevia = 0

  stages.forEach((s, i) => {
    const esUltima = i === stages.length - 1
    const salida = salidaEtapa(item, s.key)

    if (esUltima) {
      resultado.push({ key: s.key, label: s.label, cantidad: salida, ok: false })
    } else {
      const explicito = enProcesoExplicito(item, s.key)
      const detenidas = explicito !== null ? explicito : Math.max(salidaPrevia - salida, 0)
      resultado.push({ key: s.key, label: s.label, cantidad: detenidas, ok: detenidas === 0 && salida > 0 })
    }
    salidaPrevia = salida
  })

  // Solo mostrar lo relevante: lo que está detenido (cantidad > 0) o ya superado (ok),
  // omitiendo etapas que ni siquiera han arrancado.
  return resultado.filter((r) => r.cantidad > 0 || r.ok)
}
