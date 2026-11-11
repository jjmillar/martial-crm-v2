import { describe, expect, it } from 'vitest'
import { formatCLP, parseCLP } from './money'

describe('money', () => {
  it('formats CLP with dots and no decimals', () => {
    expect(formatCLP(35000)).toBe('$35.000')
    expect(formatCLP(0)).toBe('$0')
    expect(formatCLP(1250000)).toBe('$1.250.000')
    expect(formatCLP(null)).toBe('')
  })
  it('parses what people type', () => {
    expect(parseCLP('35.000')).toBe(35000)
    expect(parseCLP('$ 35000')).toBe(35000)
    expect(parseCLP('')).toBeNull()
    expect(parseCLP('35,5')).toBeNaN()
    expect(parseCLP('-100')).toBeNaN()
  })
})
