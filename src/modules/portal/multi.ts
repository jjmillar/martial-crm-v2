import { levelInfo } from './xp'
import type { Progress, Skill } from './api'

// "Todas mis escuelas": a student who trains in several schools of the platform sees all their progress together.

const key = (label: string) => label.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().replace(/[^a-z0-9]/g, '')

/** Adds up XP, classes and skills (the same skill in two schools counts once, with both XP); level from the total. */
export function mergeProgress(list: Progress[]): Progress {
  const skills = new Map<string, Skill>()
  let xp = 0, attended = 0, pending = 0
  for (const p of list) {
    xp += p.xp; attended += p.attended; pending += p.pending
    for (const s of p.skills) {
      const k = key(s.label)
      const had = skills.get(k)
      skills.set(k, had ? { ...had, xp: had.xp + s.xp, icon: had.icon ?? s.icon } : { ...s })
    }
  }
  return { ...levelInfo(xp), xp, attended, pending, skills: [...skills.values()].sort((a, b) => b.xp - a.xp) }
}
