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
