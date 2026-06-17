// Helpers compartidos para llamar a la API de Claude

export const CLAUDE_URL = 'https://api.anthropic.com/v1/messages'
export const CLAUDE_VERSION = '2023-06-01'

export function getModel(cheap = false): string {
  if (cheap) {
    return process.env.ANTHROPIC_MODEL_BARATO ?? 'claude-haiku-4-5-20251001'
  }
  return process.env.ANTHROPIC_MODEL ?? 'claude-sonnet-4-6'
}

export async function llamarClaude(
  system: string,
  userMsg: string,
  cheap = false
): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY no configurada')

  const res = await fetch(CLAUDE_URL, {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': CLAUDE_VERSION,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: getModel(cheap),
      max_tokens: 1024,
      system,
      messages: [{ role: 'user', content: userMsg }],
    }),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Claude API error ${res.status}: ${err}`)
  }

  const data = await res.json() as { content?: { text?: string }[] }
  return data.content?.[0]?.text ?? ''
}
