// XP rules shared by the portal and the public profile (same as the database: 10 XP per confirmed class).
export const XP_PER_CLASS = 10
export const XP_PER_LEVEL = 100
export const levelOf = (xp: number) => Math.floor(xp / XP_PER_LEVEL) + 1
