import type { VercelRequest, VercelResponse } from '@vercel/node'
import { llamarClaude } from '../_claude'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido' })

  const { compromisos } = req.body ?? {}
  const lista: Record<string, unknown>[] = Array.isArray(compromisos) ? compromisos : []

  const system = `Eres un gerente de calidad textil. Redactas resúmenes ejecutivos de seguimiento de compromisos en español.
El resumen debe ser un párrafo de 4-6 oraciones, profesional, enfocado en: cuántos compromisos hay activos, cuántos están vencidos, qué áreas concentran más riesgo, y una recomendación concreta de seguimiento.`

  const total = lista.length
  const vencidos = lista.filter((c) => c.vencido).length
  const detalle = lista
    .slice(0, 40)
    .map((c) =>
      `• ${c.cliente} | ${c.estilo} | PO ${c.po} | ${c.color} | Área: ${c.areaLabel} | Comprometidos: ${c.comprometidos ?? '?'} | Fecha compromiso: ${c.fecha_compromiso ?? 'sin fecha'} | ${c.vencido ? 'VENCIDO' : 'vigente'} | Notas: ${c.notas || '-'}`
    )
    .join('\n')

  const userMsg = `Total de compromisos activos: ${total}
Compromisos vencidos: ${vencidos}

Detalle:
${detalle || 'Sin compromisos registrados'}

Redacta el resumen ejecutivo de seguimiento de compromisos para gerencia.`

  try {
    const resultado = await llamarClaude(system, userMsg, false)
    return res.status(200).json({ resultado })
  } catch (err) {
    return res.status(500).json({ error: err instanceof Error ? err.message : 'Error interno' })
  }
}
