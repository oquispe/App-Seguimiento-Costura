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

/** Normaliza un PO: trim + mayúsculas + sin espacios dobles */
export function normalizePO(po: unknown): string {
  if (po === null || po === undefined) return ''
  return String(po).trim().toUpperCase().replace(/\s+/g, ' ')
}

/** Genera item_key compuesto para upsert */
export function makeItemKey(po: string, color: string, semana: string): string {
  return `${normalizePO(po)}|${normalize(color)}|${normalize(semana)}`
}
