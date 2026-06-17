/**
 * Convierte varios formatos de fecha (Excel serial, string, Date) a Date|null.
 * SIEMPRE devuelve un Date en hora LOCAL (mediodia) para evitar el desfase UTC.
 */
export function parseExcelDate(value: unknown): Date | null {
  if (value === null || value === undefined || value === '') return null

  // Ya es Date — normalizar a mediodía local
  if (value instanceof Date) {
    if (isNaN(value.getTime())) return null
    return new Date(value.getFullYear(), value.getMonth(), value.getDate(), 12)
  }

  // Número serial de Excel (días desde 1899-12-30 en UTC)
  // new Date(ms) da UTC midnight → convertir a fecha local usando componentes UTC
  if (typeof value === 'number') {
    if (value < 1 || value > 99999) return null
    const utc = new Date((value - 25569) * 86400 * 1000)
    if (isNaN(utc.getTime())) return null
    // Crear fecha LOCAL a mediodía para que format() muestre el día correcto
    return new Date(utc.getUTCFullYear(), utc.getUTCMonth(), utc.getUTCDate(), 12)
  }

  if (typeof value === 'string') {
    const s = value.trim()
    if (!s) return null

    // Formatos DD/MM/YYYY, DD-MM-YYYY, DD.MM.YYYY → constructor local
    const dmY = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})$/)
    if (dmY) {
      const [, d, m, y] = dmY
      const year = y.length === 2 ? 2000 + parseInt(y) : parseInt(y)
      return new Date(year, parseInt(m) - 1, parseInt(d), 12)
    }

    // ISO YYYY-MM-DD: new Date("2024-06-15") = UTC midnight → desfase en UTC-5
    // Solución: agregar T12:00:00 para mediodía local
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
      return new Date(s + 'T12:00:00')
    }

    // ISO completo con hora: usar tal cual
    const date = new Date(s)
    return isNaN(date.getTime()) ? null : date
  }

  return null
}

/** Días restantes desde hoy hasta target. Negativo si ya pasó. */
export function diasRestantes(target: Date | null): number | null {
  if (!target) return null
  const hoy = new Date()
  hoy.setHours(0, 0, 0, 0)
  const t = new Date(target)
  t.setHours(0, 0, 0, 0)
  return Math.round((t.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24))
}

export type Semaforo = 'rojo' | 'ambar' | 'verde' | 'sin-fecha'

export function calcularSemaforo(diasAFinal: number | null): Semaforo {
  if (diasAFinal === null) return 'sin-fecha'
  if (diasAFinal <= 1) return 'rojo'
  if (diasAFinal <= 3) return 'ambar'
  return 'verde'
}
