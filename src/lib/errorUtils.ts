/**
 * Extrae un mensaje legible de cualquier error lanzado o rechazado.
 * Supabase, en fallas de red (CORS, timeout, sin conexión), no lanza una
 * instancia de Error sino un objeto plano { message, details, hint, code },
 * por lo que `err instanceof Error` no basta.
 */
export function getErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message
  if (err && typeof err === 'object' && 'message' in err) {
    const msg = (err as { message?: unknown }).message
    if (typeof msg === 'string' && msg) return msg
  }
  try {
    return JSON.stringify(err)
  } catch {
    return String(err)
  }
}
