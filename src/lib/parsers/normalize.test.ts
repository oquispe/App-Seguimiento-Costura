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
    const key = makeItemKey('PO-001', 'Est1', 'Rojo', 'Semana 23')
    expect(key).toBe('PO-001|EST1|ROJO|SEMANA 23')
  })
  it('distingue estilos diferentes con mismo PO+color+semana', () => {
    const key1 = makeItemKey('1684302', '30488', 'NAVY - NAVY', 'Proyeccion Sem 28')
    const key2 = makeItemKey('1684302', '33300', 'NAVY - NAVY', 'Proyeccion Sem 28')
    expect(key1).not.toBe(key2)
  })
})
