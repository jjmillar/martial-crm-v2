import { describe, expect, it } from 'vitest'
import { addDays, daysUntil, formatDate, monthGrid, startOfWeek, todayIso, yearsSince } from './dates'

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


describe('date arithmetic', () => {
  it('adds days across months and leap years', () => {
    expect(addDays('2026-01-31', 30)).toBe('2026-03-02')
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29')
  })
  it('counts days until a date', () => {
    expect(daysUntil('2026-11-18', '2026-11-11')).toBe(7)
    expect(daysUntil('2026-11-01', '2026-11-11')).toBe(-10)
  })
})

describe('calendar helpers', () => {
  it('finds the Monday of the week', () => {
    expect(startOfWeek('2026-11-11')).toBe('2026-11-09') // Wednesday -> Monday
    expect(startOfWeek('2026-11-15')).toBe('2026-11-09') // Sunday belongs to the same ISO week
    expect(startOfWeek('2026-11-09')).toBe('2026-11-09')
  })
  it('builds a Monday-first 6-week month grid', () => {
    const g = monthGrid('2026-11-20')
    expect(g).toHaveLength(42)
    expect(g[0]).toBe('2026-10-26')
    expect(g).toContain('2026-11-30')
  })
})
