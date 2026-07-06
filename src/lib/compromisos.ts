import type { ItemCruzado } from '../types'

const AREA_LABELS: Record<string, string> = {
  corte: 'Corte',
  bordado: 'Bordado',
  costura: 'Costura',
  estampado: 'Estampado',
  estampado_ext: 'Estampado Ext',
  transfer: 'Transfer',
  lavanderia: 'Lavandería',
  costura_lineas: 'Costura Líneas',
  acabado: 'Acabado',
  apt: 'APT',
}

export interface CompromisoRow {
  item_key: string
  cliente: string
  estilo: string
  po: string
  color: string
  semana: string
  area: string
  areaLabel: string
  comprometidos: number | null
  fecha_compromiso: string | null
  proxima_reunion: string | null
  notas: string
  vencido: boolean
}

/** Aplana los compromisos por área de todos los ítems en filas individuales. */
export function extraerCompromisos(items: ItemCruzado[]): CompromisoRow[] {
  const hoy = new Date()
  hoy.setHours(0, 0, 0, 0)

  const filas: CompromisoRow[] = []
  for (const it of items) {
    for (const [area, c] of Object.entries(it.compromisos ?? {})) {
      if (!c.fecha_compromiso && !c.notas && c.comprometidos == null) continue
      const vencido = c.fecha_compromiso
        ? new Date(c.fecha_compromiso + 'T12:00:00') < hoy
        : false

      filas.push({
        item_key: it.item_key,
        cliente: it.cliente,
        estilo: it.estilo,
        po: it.po,
        color: it.color,
        semana: it.semana,
        area,
        areaLabel: AREA_LABELS[area] ?? area,
        comprometidos: c.comprometidos,
        fecha_compromiso: c.fecha_compromiso,
        proxima_reunion: c.proxima_reunion,
        notas: c.notas,
        vencido,
      })
    }
  }

  return filas.sort((a, b) => (a.fecha_compromiso ?? '').localeCompare(b.fecha_compromiso ?? ''))
}
