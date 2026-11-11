// Date helpers (S7): ISO 'aaaa-mm-dd' in the DB, 'dd-mm-aaaa' on screen, America/Santiago.

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return ''
  const [y, m, d] = iso.slice(0, 10).split('-')
  return y && m && d ? `${d}-${m}-${y}` : ''
}

/** Today in Santiago as 'aaaa-mm-dd'. */
export function todayIso(now = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Santiago' }).format(now)
}

/** Full years between an ISO date and today (Santiago). */
export function yearsSince(iso: string | null | undefined, today = todayIso()): number | null {
  if (!iso) return null
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number)
  const [ty, tm, td] = today.split('-').map(Number)
  if (!y || !m || !d) return null
  let years = ty - y
  if (tm < m || (tm === m && td < d)) years--
  return years
}

/** ISO date plus n days (calendar arithmetic in UTC, so no DST surprises). */
export function addDays(iso: string, n: number): string {
  const d = new Date(`${iso.slice(0, 10)}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

/** Whole days from today (Santiago) until an ISO date; negative when past. */
export function daysUntil(iso: string, today = todayIso()): number {
  const a = Date.parse(`${today}T00:00:00Z`)
  const b = Date.parse(`${iso.slice(0, 10)}T00:00:00Z`)
  return Math.round((b - a) / 86_400_000)
}

/** Monday of the ISO week containing the date. */
export function startOfWeek(iso: string): string {
  const d = new Date(`${iso.slice(0, 10)}T00:00:00Z`)
  const wd = d.getUTCDay() === 0 ? 7 : d.getUTCDay()
  return addDays(iso, 1 - wd)
}

/** The 6x7 grid of dates (Monday-first) that covers the month of the date. */
export function monthGrid(iso: string): string[] {
  const first = `${iso.slice(0, 7)}-01`
  const start = startOfWeek(first)
  return Array.from({ length: 42 }, (_, i) => addDays(start, i))
}

const longFmt = new Intl.DateTimeFormat('es-CL', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' })
const monthFmt = new Intl.DateTimeFormat('es-CL', { month: 'long', year: 'numeric', timeZone: 'UTC' })
const dayMonthFmt = new Intl.DateTimeFormat('es-CL', { day: 'numeric', month: 'short', timeZone: 'UTC' })
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)
const asUtc = (iso: string) => new Date(`${iso.slice(0, 10)}T00:00:00Z`)

/** 'miércoles, 11 de noviembre' */
export const longDate = (iso: string) => cap(longFmt.format(asUtc(iso)))
/** 'noviembre de 2026' */
export const monthTitle = (iso: string) => cap(monthFmt.format(asUtc(iso)))
/** '11 nov' */
export const dayMonth = (iso: string) => dayMonthFmt.format(asUtc(iso)).replace('.', '')
