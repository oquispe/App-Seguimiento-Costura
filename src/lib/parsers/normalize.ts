/**
 * Normaliza texto para búsqueda robusta de encabezados:
 * quita tildes, pasa a mayúsculas, colapsa espacios.
 */
export function normalize(text: unknown): string {
  if (text === null || text === undefined) return ''
  return String(text)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Normaliza un PO: trim + mayúsculas + sin espacios dobles.
 * Algunos reportes de origen (ej. rptReporteSituacionOrdenesNew1) exportan el
 * PO como texto con un punto final sobrante (ej. "47710." en vez de "47710"),
 * lo que rompe el cruce exacto contra Auditorías. Un punto final no aporta
 * significado en un PO, así que se elimina.
 */
export function normalizePO(po: unknown): string {
  if (po === null || po === undefined) return ''
  return String(po).trim().toUpperCase().replace(/\s+/g, ' ').replace(/\.+$/, '')
}

/** Genera item_key compuesto para upsert */
export function makeItemKey(po: string, estilo: string, color: string, semana: string): string {
  return `${normalizePO(po)}|${normalize(estilo)}|${normalize(color)}|${normalize(semana)}`
}

/**
 * Genera la llave base (PO|Estilo|Color, sin semana) que identifica al ítem
 * de forma persistente a través de las semanas. A diferencia de item_key
 * (que cambia cada semana porque incluye la semana), base_key es la que se
 * usa para el seguimiento/bitácora (estado, compromisos, comentarios) —
 * así, si el mismo PO+Estilo+Color sigue apareciendo en la semana siguiente,
 * no pierde su historial solo porque avanzó de semana.
 */
export function makeBaseKey(po: string, estilo: string, color: string): string {
  return `${normalizePO(po)}|${normalize(estilo)}|${normalize(color)}`
}

/**
 * Normaliza el color para matching flexible:
 * 1. "NAVY - NAVY"         → "NAVY"          (duplicado separado por guión)
 * 2. "0421 - Breaker Blue" → "BREAKER BLUE"  (código numérico al inicio)
 * 3. "NAVY BLUE"           → "NAVY BLUE"     (sin cambio)
 */
export function stripColorCode(color: string): string {
  const norm = normalize(color)
  const parts = norm.split(/\s*[-–]\s*/)
  if (parts.length !== 2) return norm

  const left  = parts[0].trim()
  const right = parts[1].trim()

  // Caso 1: "X - X" (mismo texto a ambos lados) → "X"
  if (left === right) return left

  // Caso 2: código numérico al inicio "0421 - Breaker Blue" → "BREAKER BLUE"
  if (/^\d{3,5}$/.test(left)) return right

  // Caso 3: código alfa-corto sin espacios "MRPNK - MELROSE PINK" → "MELROSE PINK"
  // El código (izq) no tiene espacios, ≤8 chars y es más corto que el nombre (der)
  if (!left.includes(' ') && left.length <= 8 && right.length > left.length) return right

  return norm
}
