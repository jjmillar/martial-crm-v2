import { XP_PER_CLASS } from './xp'

// A student's skills split in two: Gi vs NoGi (one bar, the share of training time of each) and every other skill
// as a share of the total of those others. XP = 10 per confirmed class with that skill, so shares of XP = shares of
// classes.

export type SkillLike = { label: string; icon: string | null; xp: number }
export type Share<T> = T & { classes: number; pct: number }
export type SkillSplit<T> = {
  gi: Share<T> | null
  nogi: Share<T> | null
  /** Gi + NoGi classes (0 = the student hasn't trained either yet). */
  giTotal: number
  others: Share<T>[]
  othersTotal: number
}

const norm = (s: string) => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().replace(/[^a-z0-9]/g, '')
const GI = new Set(['gi', 'congi', 'kimono', 'bjjgi'])
const NOGI = new Set(['nogi', 'singi', 'sinkimono', 'bjjnogi'])
export const isGi = (label: string) => GI.has(norm(label))
export const isNoGi = (label: string) => NOGI.has(norm(label))

/** Whole percentages that always add up to 100 (largest remainder). */
export function percents(values: number[]): number[] {
  const total = values.reduce((a, b) => a + b, 0)
  if (!total) return values.map(() => 0)
  const raw = values.map((v) => (v / total) * 100)
  const out = raw.map(Math.floor)
  let left = 100 - out.reduce((a, b) => a + b, 0)
  const order = raw.map((r, i) => [r - Math.floor(r), i] as const).sort((a, b) => b[0] - a[0])
  for (const [, i] of order) { if (left <= 0) break; out[i]++; left-- }
  return out
}

export function splitSkills<T extends SkillLike>(skills: T[]): SkillSplit<T> {
  const share = (s: T, pct: number): Share<T> => ({ ...s, classes: Math.round(s.xp / XP_PER_CLASS), pct })
  // If a school has two tags for the same thing (e.g. "Gi" and "Kimono"), they add up.
  const sum = (list: T[]): T | null => (list.length ? { ...list[0], xp: list.reduce((a, s) => a + s.xp, 0) } : null)
  const gi = sum(skills.filter((s) => isGi(s.label)))
  const nogi = sum(skills.filter((s) => isNoGi(s.label)))
  const [giPct, nogiPct] = percents([gi?.xp ?? 0, nogi?.xp ?? 0])
  const rest = skills.filter((s) => !isGi(s.label) && !isNoGi(s.label) && s.xp > 0).sort((a, b) => b.xp - a.xp)
  const pcts = percents(rest.map((s) => s.xp))
  return {
    gi: gi ? share(gi, giPct) : null,
    nogi: nogi ? share(nogi, nogiPct) : null,
    giTotal: Math.round(((gi?.xp ?? 0) + (nogi?.xp ?? 0)) / XP_PER_CLASS),
    others: rest.map((s, i) => share(s, pcts[i])),
    othersTotal: Math.round(rest.reduce((a, s) => a + s.xp, 0) / XP_PER_CLASS),
  }
}
