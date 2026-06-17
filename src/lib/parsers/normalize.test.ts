import { describe, it, expect } from 'vitest'
import { normalize, normalizePO, makeItemKey } from './normalize'

describe('normalize', () => {
  it('quita tildes y pasa a mayúsculas', () => {
    expect(normalize('Auditoría')).toBe('AUDITORIA')
    expect(normalize('Línea Costura')).toBe('LINEA COSTURA')
  })
  it('colapsa espacios', () => {
    expect(normalize('  CANT.  PROG.  ')).toBe('CANT. PROG.')
  })
  it('maneja null/undefined', () => {
    expect(normalize(null)).toBe('')
    expect(normalize(undefined)).toBe('')
  })
})

describe('normalizePO', () => {
  it('trim y mayúsculas', () => {
    expect(normalizePO('  po-1234  ')).toBe('PO-1234')
  })
  it('sin espacios dobles', () => {
    expect(normalizePO('AB  12')).toBe('AB 12')
  })
})

describe('makeItemKey', () => {
  it('genera clave compuesta sin tildes', () => {
    const key = makeItemKey('PO-001', 'Rojo', 'Semana 23')
    expect(key).toBe('PO-001|ROJO|SEMANA 23')
  })
})
