import type { VercelRequest, VercelResponse } from '@vercel/node'
import { llamarClaude } from '../_claude'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido' })

  const { kpis, vencidos } = req.body ?? {}

  const system = `Eres un gerente de calidad textil. Redactas resúmenes ejecutivos semanales en español.
El resumen debe ser un párrafo de 4-6 oraciones, profesional, con los KPIs clave, alertas y una recomendación.`

  const kpisStr = JSON.stringify(kpis ?? {}, null, 2)
  const vencStr = Array.isArray(vencidos) ? vencidos.slice(0, 10).map((v: Record<string, unknown>) =>
    `• PO ${v.po} | ${v.cliente} | ${v.estilo} | ${v.dias_auditoria_final ?? '?'} días`
  ).join('\n') : 'Ninguno'

  const userMsg = `KPIs de la semana:
${kpisStr}

Ítems vencidos/urgentes:
${vencStr}

Redacta el resumen ejecutivo para gerencia.`

  try {
    const resultado = await llamarClaude(system, userMsg, false)
    return res.status(200).json({ resultado })
  } catch (err) {
    return res.status(500).json({ error: err instanceof Error ? err.message : 'Error interno' })
  }
}
