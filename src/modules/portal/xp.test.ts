import { describe, expect, it } from 'vitest'
import { levelInfo, xpForLevel } from './xp'

describe('level curve (same as public.xp_level)', () => {
  it('each level needs 10 XP more than the previous one', () => {
    expect([1, 2, 3, 4].map(xpForLevel)).toEqual([100, 110, 120, 130])
  })
  it('matches the database', () => {
    expect(levelInfo(0)).toEqual({ level: 1, level_xp: 0, next_level_xp: 100 })
    expect(levelInfo(100)).toEqual({ level: 2, level_xp: 0, next_level_xp: 110 })
    expect(levelInfo(230)).toEqual({ level: 3, level_xp: 20, next_level_xp: 120 })
    expect(levelInfo(459).level).toBe(4)
    expect(levelInfo(460).level).toBe(5)
  })
})
