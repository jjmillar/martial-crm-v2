import type { AppRole } from '../types'

// The first-run guided tour (odd/tasks/tutorial.md S1–S2): the minimum to set up a school, in the user's order.
// A step is done only when the real data exists; the saved state (per user, per tour version) only remembers
// where the person is and whether they skipped or finished it.

export type TourStep = 'intro' | 'escuela' | 'clase' | 'profesor' | 'plan' | 'fin'
export const TOUR_ORDER: TourStep[] = ['intro', 'escuela', 'clase', 'profesor', 'plan', 'fin']
/** The steps that count as "Paso N de 4". */
export const TOUR_TASKS: TourStep[] = ['escuela', 'clase', 'profesor', 'plan']

export type TourStatus = 'active' | 'done' | 'skipped'
export type TourSaved = { status: TourStatus; step: TourStep }
/** null = still loading. */
export type TourCounts = { schools: number; classes: number | null; teachers: number | null; plans: number | null }

export const nextStep = (s: TourStep): TourStep => TOUR_ORDER[Math.min(TOUR_ORDER.indexOf(s) + 1, TOUR_ORDER.length - 1)]

export function stepDone(s: TourStep, c: TourCounts): boolean {
  switch (s) {
    case 'escuela': return c.schools > 0
    case 'clase': return (c.classes ?? 0) > 0
    case 'profesor': return (c.teachers ?? 0) > 0
    case 'plan': return (c.plans ?? 0) > 0
    default: return true
  }
}

/** A brand-new customer: CEO, schools loaded, none yet, and this user never saw the tour. */
export const shouldAutoStart = (a: { role: AppRole | null; loading: boolean; schools: number; saved: TourSaved | null }) =>
  a.role === 'ceo' && !a.loading && a.schools === 0 && a.saved === null

export const tourKey = (userId: string) => `mcrm.tour:v1:${userId}`

const STATUSES: TourStatus[] = ['active', 'done', 'skipped']

export function readTour(userId: string): TourSaved | null {
  try {
    const raw = localStorage.getItem(tourKey(userId))
    if (!raw) return null
    const v = JSON.parse(raw) as Partial<TourSaved>
    return v && STATUSES.includes(v.status as TourStatus) && TOUR_ORDER.includes(v.step as TourStep) ? { status: v.status!, step: v.step! } : null
  } catch {
    return null
  }
}

export function writeTour(userId: string, v: TourSaved): void {
  try { localStorage.setItem(tourKey(userId), JSON.stringify(v)) } catch { /* storage unavailable: the tour just won't be remembered */ }
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('mcrm:tour'))
}

/** Replay from Ajustes → Ayuda. */
export const startTour = (userId: string) => writeTour(userId, { status: 'active', step: 'intro' })
