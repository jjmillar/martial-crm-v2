import { describe, expect, it } from 'vitest'
import { formatRut, normalizeRut } from './rut'

describe('rut', () => {
  it('normalizes valid RUTs in any format', () => {
    expect(normalizeRut('12.345.678-5')).toBe('12345678-5')
    expect(normalizeRut('123456785')).toBe('12345678-5')
    expect(normalizeRut('7.654.321-6')).toBe('7654321-6')
    expect(normalizeRut('10.000.013-k')).toBe('10000013-K')
  })
  it('rejects a wrong check digit or bad length', () => {
    expect(normalizeRut('12.345.678-9')).toBeNull()
    expect(normalizeRut('123')).toBeNull()
    expect(normalizeRut('')).toBeNull()
  })
  it('formats with dots', () => {
    expect(formatRut('12345678-5')).toBe('12.345.678-5')
    expect(formatRut('7654321-6')).toBe('7.654.321-6')
    expect(formatRut(null)).toBe('')
  })
})
