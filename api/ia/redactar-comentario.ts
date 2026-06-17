import type { VercelRequest, VercelResponse } from '@vercel/node'
import { llamarClaude } from '../_claude'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido' })

  const { hallazgo, estado, contexto } = req.body ?? {}

  const system = `Eres un auditor de calidad en confección textil.
Redactas comentarios de bitácora profesionales en español, concisos (máx 3 oraciones), en primera persona.
Solo devuelve el texto del comentario, sin explicaciones adicionales.`

  const userMsg = `Contexto: ${contexto ?? ''}
Estado: ${estado ?? ''}
Hallazgo/resultado: ${hallazgo ?? 'Sin hallazgo especificado'}

Redacta el comentario de bitácora.`

  try {
    const resultado = await llamarClaude(system, userMsg, false)
    return res.status(200).json({ resultado })
  } catch (err) {
    return res.status(500).json({ error: err instanceof Error ? err.message : 'Error interno' })
  }
}
