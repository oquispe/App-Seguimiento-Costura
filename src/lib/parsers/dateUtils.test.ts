import { describe, it, expect } from 'vitest'
import { parseExcelDate, diasRestantes, calcularSemaforo } from './dateUtils'

describe('parseExcelDate', () => {
  it('convierte serial Excel a Date', () => {
    // 44927 = 2023-01-01 UTC
    const d = parseExcelDate(44927)
    expect(d).toBeInstanceOf(Date)
    expect(d!.getUTCFullYear()).toBe(2023)
  })
  it('parsea DD/MM/YYYY', () => {
    const d = parseExcelDate('15/06/2026')
    expect(d!.getFullYear()).toBe(2026)
    expect(d!.getMonth()).toBe(5)
    expect(d!.getDate()).toBe(15)
  })
  it('devuelve null para vacío', () => {
    expect(parseExcelDate('')).toBeNull()
    expect(parseExcelDate(null)).toBeNull()
  })
})

describe('calcularSemaforo', () => {
  it('rojo si vencida', () => expect(calcularSemaforo(-1)).toBe('rojo'))
  it('rojo si 0 días', () => expect(calcularSemaforo(0)).toBe('rojo'))
  it('rojo si 1 día', () => expect(calcularSemaforo(1)).toBe('rojo'))
  it('ambar si 2 días', () => expect(calcularSemaforo(2)).toBe('ambar'))
  it('ambar si 3 días', () => expect(calcularSemaforo(3)).toBe('ambar'))
  it('verde si 4+ días', () => expect(calcularSemaforo(4)).toBe('verde'))
  it('sin-fecha si null', () => expect(calcularSemaforo(null)).toBe('sin-fecha'))
})
