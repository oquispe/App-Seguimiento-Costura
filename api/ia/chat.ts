import type { VercelRequest, VercelResponse } from '@vercel/node'

const CLAUDE_URL = 'https://api.anthropic.com/v1/messages'
const CLAUDE_VERSION = '2023-06-01'
const MODEL = 'claude-haiku-4-5-20251001'

interface MensajeHistorial {
  rol: 'user' | 'assistant'
  texto: string
}

interface ItemCompacto {
  semana: string
  cliente: string
  estilo: string
  po: string
  op: string
  color: string
  cant_prog: number | null
  externa: string | null
  semaforo: string
  dias_auditoria_final: number | null
  auditoria_final: string | null
  fin_entrega: string | null
  en_corte: number
  en_bordado: number
  en_costura: number
  en_estampado: number
  en_estampado_ext: number
  en_transfer: number
  en_lavanderia: number
  en_costura_lineas: number
  en_acabado: number
  apt: number
  exportado: number
  porc_exp: number
  total_requeridas: number
  estado: string
}

function prioridad(s: string): number {
  return s === 'rojo' ? 0 : s === 'ambar' ? 1 : s === 'verde' ? 2 : 3
}

function formatearItem(it: ItemCompacto): string {
  const ico = it.semaforo === 'rojo' ? '🔴' : it.semaforo === 'ambar' ? '🟡' : it.semaforo === 'verde' ? '🟢' : '⚪'
  const dias = it.dias_auditoria_final !== null ? `${it.dias_auditoria_final}d` : '?d'
  const etapas: string[] = []
  if (it.en_corte > 0)           etapas.push(`corte:${it.en_corte}`)
  if (it.en_bordado > 0)         etapas.push(`bordado:${it.en_bordado}`)
  if (it.en_costura > 0)         etapas.push(`costura:${it.en_costura}`)
  if (it.en_estampado > 0)       etapas.push(`estampado:${it.en_estampado}`)
  if (it.en_estampado_ext > 0)   etapas.push(`estampExt:${it.en_estampado_ext}`)
  if (it.en_transfer > 0)        etapas.push(`transfer:${it.en_transfer}`)
  if (it.en_lavanderia > 0)      etapas.push(`lavand:${it.en_lavanderia}`)
  if (it.en_costura_lineas > 0)  etapas.push(`costLineas:${it.en_costura_lineas}`)
  if (it.en_acabado > 0)         etapas.push(`acabado:${it.en_acabado}`)
  if (it.apt > 0)                etapas.push(`APT:${it.apt}`)
  if (it.exportado > 0)          etapas.push(`export:${it.exportado}(${Math.round(it.porc_exp)}%)`)
  const pos = etapas.length > 0 ? etapas.join('|') : 'sin mov'
  const op  = it.op ? ` OP:${it.op}` : ''
  const ext = it.externa ? ` EXT:${it.externa}` : ''
  return `${ico} S${it.semana} ${it.cliente} | ${it.estilo} PO:${it.po}${op} ${it.color} | ${it.cant_prog ?? '?'}pz${ext} | audit:${it.auditoria_final ?? '—'}(${dias}) | ${pos}`
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido' })

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return res.status(500).json({ error: 'ANTHROPIC_API_KEY no configurada' })

  const { mensaje, historial = [], items = [] } = req.body ?? {}

  const ordenados = [...(items as ItemCompacto[])].sort(
    (a, b) => prioridad(a.semaforo) - prioridad(b.semaforo)
  )
  const resumen = ordenados.slice(0, 200).map(formatearItem).join('\n')

  const system = `Eres el asistente de producción y auditorías de CMT del Sur.
Conoces el estado en tiempo real de todas las órdenes de confección y respondes preguntas del equipo.

DATOS ACTUALES (${(items as unknown[]).length} ítems, ordenados por urgencia):
${resumen}

LEYENDA: 🔴 vencido/≤3d | 🟡 4-7d | 🟢 >7d | ⚪ sin fecha | corte/bordado/costura/estampado/lavand/acabado/APT/export = piezas en esa etapa | EXT = empresa externa | OP = orden de producción | S = semana

CÓMO RESPONDER:
- Prioridades de un área → lista ítems con piezas ahí, del más urgente al menos (primero 🔴, luego 🟡)
- Consulta por cliente/PO → filtra y muestra esos ítems con su estado
- Resumen general → agrega totales relevantes
- Responde en español, directo y práctico, con listas cuando hay varios ítems
- Si no hay datos para la pregunta, dilo claramente`

  const messages = [
    ...(historial as MensajeHistorial[]).map((h) => ({ role: h.rol, content: h.texto })),
    { role: 'user' as const, content: String(mensaje ?? '') },
  ]

  try {
    const response = await fetch(CLAUDE_URL, {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': CLAUDE_VERSION,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ model: MODEL, max_tokens: 1024, system, messages }),
    })

    const data = await response.json() as { content?: { text?: string }[]; error?: { message?: string } }

    if (!response.ok) {
      return res.status(500).json({ error: data?.error?.message ?? `Claude error ${response.status}` })
    }

    return res.status(200).json({ respuesta: data.content?.[0]?.text ?? '' })
  } catch (err) {
    return res.status(500).json({ error: err instanceof Error ? err.message : 'Error interno' })
  }
}
