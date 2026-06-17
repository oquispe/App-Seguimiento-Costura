import type { VercelRequest, VercelResponse } from '@vercel/node'
import { llamarClaude } from '../_claude'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido' })

  const { items } = req.body ?? {}
  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'Se requiere lista de ítems' })
  }

  const system = `Eres un coordinador de auditorías de confección textil.
Respondes SIEMPRE en español, en formato lista numerada, con justificación corta (1 línea por ítem).
Prioriza por: 1) días restantes para auditoria_final, 2) estado (Pendiente > Programada), 3) cantidad programada.`

  const resumen = items.slice(0, 20).map((it: Record<string, unknown>, i: number) =>
    `${i + 1}. PO ${it.po} | ${it.cliente} | ${it.estilo} | color: ${it.color} | días a audit final: ${it.dias_auditoria_final ?? 'sin fecha'} | estado: ${it.estado}`
  ).join('\n')

  const userMsg = `Prioriza estas auditorías pendientes:\n${resumen}\n\nDevuelve el ranking con justificación breve.`

  try {
    const resultado = await llamarClaude(system, userMsg, true)
    return res.status(200).json({ resultado })
  } catch (err) {
    return res.status(500).json({ error: err instanceof Error ? err.message : 'Error interno' })
  }
}
