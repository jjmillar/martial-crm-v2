import { describe, expect, it } from 'vitest'
import { isGi, isNoGi, percents, splitSkills } from './skills'

const k = (label: string, xp: number) => ({ label, icon: null, xp })

describe('skills split', () => {
  it('recognizes Gi and NoGi however they are written', () => {
    expect(['Gi', 'GI', 'Con gi', 'Kimono'].every(isGi)).toBe(true)
    expect(['NoGi', 'No-Gi', 'no gi', 'Sin gi'].every(isNoGi)).toBe(true)
    expect(isGi('Guardia') || isNoGi('Guardia') || isGi('Gimnasia')).toBe(false)
  })

  it('percentages always add up to 100', () => {
    expect(percents([1, 1, 1])).toEqual([34, 33, 33])
    expect(percents([0, 0])).toEqual([0, 0])
    expect(percents([3, 1])).toEqual([75, 25])
  })

  it('Gi vs NoGi is the share of classes of each', () => {
    const s = splitSkills([k('Gi', 180), k('NoGi', 120), k('Guardia', 50)])
    expect(s.gi?.pct).toBe(60)
    expect(s.nogi?.pct).toBe(40)
    expect(s.gi?.classes).toBe(18)
    expect(s.giTotal).toBe(30)
  })

  it('the other skills share the total of the other skills only, biggest first', () => {
    const s = splitSkills([k('Gi', 500), k('Derribos', 30), k('Guardia', 60), k('Pases', 10), k('Vacía', 0)])
    expect(s.others.map((o) => [o.label, o.pct])).toEqual([['Guardia', 60], ['Derribos', 30], ['Pases', 10]])
    expect(s.othersTotal).toBe(10)
  })

  it('only one of Gi / NoGi trained = 100 % for it', () => {
    const s = splitSkills([k('No gi', 40)])
    expect(s.gi).toBeNull()
    expect(s.nogi?.pct).toBe(100)
    expect(s.others).toEqual([])
  })

  it('two tags for Gi add up', () => {
    const s = splitSkills([k('Gi', 30), k('Kimono', 10), k('NoGi', 40)])
    expect(s.gi?.xp).toBe(40)
    expect(s.gi?.pct).toBe(50)
  })
})
