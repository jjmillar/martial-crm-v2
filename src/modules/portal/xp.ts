// XP rules shared by the portal and the public profile (same as the database, migration 20261126000003):
// 10 XP per approved class; going from level n to n+1 takes 100 + 10·(n−1) XP (100, 110, 120…).
export const XP_PER_CLASS = 10
export const xpForLevel = (level: number) => 100 + 10 * (Math.max(level, 1) - 1)

export function levelInfo(xp: number): { level: number; level_xp: number; next_level_xp: number } {
  let level = 1
  let rest = Math.max(0, Math.floor(xp))
  while (rest >= xpForLevel(level)) { rest -= xpForLevel(level); level++ }
  return { level, level_xp: rest, next_level_xp: xpForLevel(level) }
}
export const levelOf = (xp: number) => levelInfo(xp).level
