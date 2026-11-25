import { addDays, startOfWeek, todayIso } from '../lib/dates'
import { useCallback, useState } from 'react'
import { Icon } from './Icon'
import { DatePicker } from './DatePicker'

// Date navigation shared by Asistencia and Calendario. Minimal, two lines at most, no card: Día · Semana · Mes on
// top (centered), ‹ date › below, plus a small "Hoy" only when you moved to another period.
export type DateView = 'day' | 'week' | 'month'
const VIEWS: { id: DateView; label: string }[] = [
  { id: 'day', label: 'Día' },
  { id: 'week', label: 'Semana' },
  { id: 'month', label: 'Mes' },
]

const utc = (iso: string) => new Date(`${iso.slice(0, 10)}T00:00:00Z`)
const fmt = (o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat('es-CL', { timeZone: 'UTC', ...o })
const weekdayF = fmt({ weekday: 'long' })
const dayF = fmt({ day: 'numeric' })
const monthF = fmt({ month: 'long' })
const monthShortF = fmt({ month: 'short' })
const yearF = fmt({ year: 'numeric' })
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

function shiftMonth(iso: string, delta: number): string {
  const [y, m] = iso.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1 + delta, 1)).toISOString().slice(0, 10)
}

function label(view: DateView, date: string): string {
  const d = utc(date)
  if (view === 'day') return `${cap(weekdayF.format(d))} ${dayF.format(d)} de ${monthF.format(d)}`
  if (view === 'month') return `${cap(monthF.format(d))} ${yearF.format(d)}`
  const a = utc(startOfWeek(date)), b = utc(addDays(startOfWeek(date), 6))
  return a.getUTCMonth() === b.getUTCMonth()
    ? `${dayF.format(a)} – ${dayF.format(b)} de ${monthF.format(b)}`
    : `${dayF.format(a)} ${monthShortF.format(a).replace('.', '')} – ${dayF.format(b)} ${monthShortF.format(b).replace('.', '')}`
}

function current(view: DateView, date: string, today: string): string | null {
  if (view === 'day') {
    if (date === today) return 'Hoy'
    if (date === addDays(today, 1)) return 'Mañana'
    if (date === addDays(today, -1)) return 'Ayer'
    return null
  }
  if (view === 'week') return startOfWeek(date) === startOfWeek(today) ? 'Esta semana' : null
  return date.slice(0, 7) === today.slice(0, 7) ? 'Este mes' : null
}

export function DateNav({ view, date, onChange }: { view: DateView; date: string; onChange: (next: { vista?: DateView; fecha?: string }) => void }) {
  const today = todayIso()
  const step = view === 'day' ? 1 : view === 'week' ? 7 : 0
  const go = (dir: 1 | -1) => onChange({ fecha: step ? addDays(date, dir * step) : shiftMonth(date, dir) })
  const now = current(view, date, today)
  const [picking, setPicking] = useState(false)
  const close = useCallback(() => setPicking(false), [])
  return (
    <nav className="date-nav" aria-label="Fechas">
      <div className="segmented date-nav__views" role="group" aria-label="Vista">
        {VIEWS.map((v) => <button key={v.id} type="button" aria-pressed={view === v.id} onClick={() => onChange({ vista: v.id })}>{v.label}</button>)}
      </div>
      <div className="date-nav__row">
        <button type="button" className="date-nav__arrow" onClick={() => go(-1)} aria-label="Anterior"><Icon name="back" size={16} /></button>
        {/* Tapping the date opens a small calendar to jump straight to a day, week or month. */}
        <div className="date-nav__pick">
          <h2 className="date-nav__title" aria-live="polite">
            <button type="button" className="date-nav__open" aria-expanded={picking} aria-haspopup="dialog" title={now ?? undefined}
              onClick={() => setPicking((p) => !p)}>
              {label(view, date)} <Icon name="down" size={14} />
            </button>
          </h2>
          {picking && <DatePicker view={view} date={date} onClose={close} onPick={(fecha) => { setPicking(false); onChange({ fecha }) }} />}
        </div>
        <button type="button" className="date-nav__arrow date-nav__arrow--next" onClick={() => go(1)} aria-label="Siguiente"><Icon name="back" size={16} /></button>
        <button type="button" className={`date-nav__today${now ? ' is-hidden' : ''}`} onClick={() => onChange({ fecha: today })} tabIndex={now ? -1 : 0} aria-hidden={now ? true : undefined}>Hoy</button>
      </div>
    </nav>
  )
}
