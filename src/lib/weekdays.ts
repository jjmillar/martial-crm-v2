// ISO weekdays (1 = lunes ... 7 = domingo), as stored in class_schedules.weekday.
export const weekdays = [
  { n: 1, short: 'Lun', long: 'Lunes' },
  { n: 2, short: 'Mar', long: 'Martes' },
  { n: 3, short: 'Mié', long: 'Miércoles' },
  { n: 4, short: 'Jue', long: 'Jueves' },
  { n: 5, short: 'Vie', long: 'Viernes' },
  { n: 6, short: 'Sáb', long: 'Sábado' },
  { n: 7, short: 'Dom', long: 'Domingo' },
] as const

export const weekdayShort = (n: number) => weekdays[n - 1]?.short ?? ''
export const weekdayLong = (n: number) => weekdays[n - 1]?.long ?? ''

/** 'HH:MM:SS' or 'HH:MM' -> 'HH:MM' */
export const hhmm = (t: string) => t.slice(0, 5)

/** ISO weekday of an ISO date. */
export function isoWeekday(iso: string): number {
  const d = new Date(`${iso.slice(0, 10)}T00:00:00Z`).getUTCDay()
  return d === 0 ? 7 : d
}
