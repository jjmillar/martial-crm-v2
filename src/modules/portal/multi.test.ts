import { describe, expect, it } from 'vitest'
import { mergeProgress } from './multi'

const P = (xp: number, skills: [string, number][], attended = xp / 10) => ({ xp, level: 0, level_xp: 0, next_level_xp: 0, attended, pending: 0, skills: skills.map(([label, x], i) => ({ tag_id: label + i, label, icon: null, xp: x })) })

describe('todas mis escuelas', () => {
  it('suma XP y clases y calcula el nivel del total', () => {
    const m = mergeProgress([P(150, []), P(80, [])])
    expect(m.xp).toBe(230)
    expect(m.attended).toBe(23)
    expect([m.level, m.level_xp, m.next_level_xp]).toEqual([3, 20, 120])
  })
  it('junta la misma skill de dos escuelas', () => {
    const m = mergeProgress([P(100, [['Gi', 60], ['Guardia', 40]]), P(50, [['GI', 30], ['Derribos', 20]])])
    expect(m.skills.map((s) => [s.label, s.xp])).toEqual([['Gi', 90], ['Guardia', 40], ['Derribos', 20]])
  })
  it('sin escuelas es nivel 1', () => {
    expect(mergeProgress([]).level).toBe(1)
  })
})
