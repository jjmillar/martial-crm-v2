import { describe, expect, it } from 'vitest'
import { classOpen, opensAt } from './api'

describe('check-in opens 1 hour before the class', () => {
  it('opensAt', () => {
    expect(opensAt('19:00:00')).toBe('18:00')
    expect(opensAt('07:30')).toBe('06:30')
    expect(opensAt('00:30')).toBe('00:00')
  })
  it('classOpen (Chile time)', () => {
    const at = (iso: string) => new Date(iso) // 2026-11-26 is UTC−3 in Santiago (summer time)
    expect(classOpen('2026-11-26', '19:00:00', at('2026-11-26T21:59:00Z'))).toBe(true) // 18:59
    expect(classOpen('2026-11-26', '19:00:00', at('2026-11-26T22:00:00Z'))).toBe(true) // 19:00
    expect(classOpen('2026-11-26', '19:00:00', at('2026-11-26T21:00:00Z'))).toBe(true) // 18:00 exactly
    expect(classOpen('2026-11-26', '19:00:00', at('2026-11-26T20:59:00Z'))).toBe(false) // 17:59
    expect(classOpen('2026-11-25', '19:00:00', at('2026-11-26T12:00:00Z'))).toBe(true) // yesterday
  })
})
