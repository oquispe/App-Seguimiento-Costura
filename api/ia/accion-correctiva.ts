import type { VercelRequest, VercelResponse } from '@vercel/node'
import { llamarClaude } from '../_claude'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido' })

  const { cliente, estilo, po, hallazgo, defecto } = req.body ?? {}

  if (!hallazgo && !defecto) {
    return res.status(400).json({ error: 'Se requiere hallazgo o defecto' })
  }

  const system = `Eres un experto en calidad textil y confección.
Respondes SIEMPRE en español, de forma breve y accionable.
Estructura tu respuesta así:
1. **Causa raíz (5 Porqués)**
2. **Contención inmediata**
3. **Acción correctiva**`

  const userMsg = `Cliente: ${cliente ?? '-'}
Estilo: ${estilo ?? '-'}
PO: ${po ?? '-'}
Hallazgo/Defecto: ${hallazgo || defecto}

Genera el análisis de causa raíz y la acción correctiva para esta auditoría rechazada.`

  try {
    const resultado = await llamarClaude(system, userMsg, false)
    return res.status(200).json({ resultado })
  } catch (err) {
    return res.status(500).json({ error: err instanceof Error ? err.message : 'Error interno' })
  }
}
