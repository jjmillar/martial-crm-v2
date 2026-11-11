import { describe, expect, it } from 'vitest'
import { formatDate, todayIso, yearsSince } from './dates'

describe('dates', () => {
  it('formats ISO as dd-mm-aaaa', () => {
    expect(formatDate('2026-03-09')).toBe('09-03-2026')
    expect(formatDate(null)).toBe('')
  })
  it('computes full years, birthday-aware', () => {
    expect(yearsSince('2000-11-12', '2026-11-11')).toBe(25)
    expect(yearsSince('2000-11-11', '2026-11-11')).toBe(26)
    expect(yearsSince(null)).toBeNull()
  })
  it('today uses the Santiago date', () => {
    // 02:00 UTC on Nov 12 is still Nov 11 in Santiago (UTC-3)
    expect(todayIso(new Date('2026-11-12T02:00:00Z'))).toBe('2026-11-11')
  })
})
