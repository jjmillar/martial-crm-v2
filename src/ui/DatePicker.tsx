import { useEffect, useRef, useState } from 'react'
import { addDays, monthGrid, startOfWeek, todayIso } from '../lib/dates'
import { weekdayShort } from '../lib/weekdays'
import { Icon } from './Icon'
import type { DateView } from './DateNav'

// Small calendar that drops under the DateNav title: Día picks a day, Semana a week (whole rows), Mes a month
// (twelve per year). It browses on its own (‹ ›) and only changes the page when something is picked.
const utc = (iso: string) => new Date(`${iso.slice(0, 10)}T00:00:00Z`)
const fmt = (o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat('es-CL', { timeZone: 'UTC', ...o })
const monthYearF = fmt({ month: 'long', year: 'numeric' })
const monthShortF = fmt({ month: 'short' })
const longF = fmt({ weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
const dayMonthF = fmt({ day: 'numeric', month: 'long' })
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

function shiftMonth(iso: string, delta: number): string {
  const [y, m] = iso.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1 + delta, 1)).toISOString().slice(0, 10)
}

/** ISO week number (weeks start on Monday; week 1 holds the year's first Thursday). */
function isoWeek(iso: string): number {
  const thursday = utc(addDays(startOfWeek(iso), 3))
  const jan1 = Date.UTC(thursday.getUTCFullYear(), 0, 1)
  return Math.floor((thursday.getTime() - jan1) / 86_400_000 / 7) + 1
}

export function DatePicker({ view, date, onPick, onClose }: { view: DateView; date: string; onPick: (iso: string) => void; onClose: () => void }) {
  const today = todayIso()
  // What the picker shows: a month (day/week) or a year (month), starting at the current date.
  const [cursor, setCursor] = useState(`${date.slice(0, 7)}-01`)
  const box = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const down = (e: PointerEvent) => {
      const nav = box.current?.closest('.date-nav__pick')
      if (nav && !nav.contains(e.target as Node)) onClose()
    }
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); onClose() } }
    document.addEventListener('pointerdown', down)
    document.addEventListener('keydown', key)
    // Focus the selected item so the keyboard starts where you are.
    box.current?.querySelector<HTMLButtonElement>('[aria-pressed="true"]')?.focus()
    return () => { document.removeEventListener('pointerdown', down); document.removeEventListener('keydown', key) }
  }, [onClose])

  const yearly = view === 'month'
  const year = Number(cursor.slice(0, 4))
  const title = yearly ? String(year) : cap(monthYearF.format(utc(cursor)))
  const step = (dir: 1 | -1) => setCursor(shiftMonth(cursor, yearly ? dir * 12 : dir))

  return (
    <div ref={box} className={`date-pick m-pop date-pick--${view}`} role="dialog" aria-label={view === 'day' ? 'Elegir día' : view === 'week' ? 'Elegir semana' : 'Elegir mes'}>
      <div className="date-pick__head">
        <button type="button" className="date-nav__arrow" onClick={() => step(-1)} aria-label={yearly ? 'Año anterior' : 'Mes anterior'}><Icon name="back" size={16} /></button>
        <strong aria-live="polite">{title}</strong>
        <button type="button" className="date-nav__arrow date-nav__arrow--next" onClick={() => step(1)} aria-label={yearly ? 'Año siguiente' : 'Mes siguiente'}><Icon name="back" size={16} /></button>
      </div>

      {yearly && (
        <div className="date-pick__months">
          {Array.from({ length: 12 }, (_, i) => {
            const m = `${year}-${String(i + 1).padStart(2, '0')}`
            const first = `${m}-01`
            const on = date.slice(0, 7) === m
            const now = today.slice(0, 7) === m
            return (
              <button key={m} type="button" className={`date-pick__month${now ? ' is-today' : ''}`} aria-pressed={on}
                aria-label={cap(monthYearF.format(utc(first)))} onClick={() => onPick(now ? today : first)}>
                {cap(monthShortF.format(utc(first)).replace('.', ''))}
              </button>
            )
          })}
        </div>
      )}

      {!yearly && (
        <div className={`date-pick__grid${view === 'week' ? ' is-weeks' : ''}`}>
          <div className="date-pick__row date-pick__row--head" aria-hidden="true">
            {view === 'week' && <span className="date-pick__wk">Sem</span>}
            {[1, 2, 3, 4, 5, 6, 7].map((w) => <span key={w}>{weekdayShort(w).slice(0, 2)}</span>)}
          </div>
          {Array.from({ length: 6 }, (_, r) => monthGrid(cursor).slice(r * 7, r * 7 + 7)).filter((days) => days.some((d) => d.slice(0, 7) === cursor.slice(0, 7))).map((days) => {
            const mon = days[0]
            if (view === 'week') {
              const on = startOfWeek(date) === mon
              const now = startOfWeek(today) === mon
              return (
                <button key={mon} type="button" className={`date-pick__row date-pick__week${now ? ' is-today' : ''}`} aria-pressed={on}
                  aria-label={`Semana ${isoWeek(mon)}: ${dayMonthF.format(utc(mon))} al ${dayMonthF.format(utc(days[6]))}`}
                  onClick={() => onPick(now ? today : mon)}>
                  <span className="date-pick__wk">{isoWeek(mon)}</span>
                  {days.map((d) => (
                    <span key={d} className={`date-pick__day${d.slice(0, 7) !== cursor.slice(0, 7) ? ' is-out' : ''}${d === today ? ' is-now' : ''}`}>{Number(d.slice(8, 10))}</span>
                  ))}
                </button>
              )
            }
            return (
              <div key={mon} className="date-pick__row">
                {days.map((d) => (
                  <button key={d} type="button" aria-pressed={d === date} aria-current={d === today ? 'date' : undefined}
                    className={`date-pick__day${d.slice(0, 7) !== cursor.slice(0, 7) ? ' is-out' : ''}${d === today ? ' is-now' : ''}`}
                    aria-label={cap(longF.format(utc(d)))} onClick={() => onPick(d)}>
                    {Number(d.slice(8, 10))}
                  </button>
                ))}
              </div>
            )
          })}
        </div>
      )}

      {cursor.slice(0, yearly ? 4 : 7) !== today.slice(0, yearly ? 4 : 7) && (
        <button type="button" className="link-btn date-pick__today" onClick={() => setCursor(`${today.slice(0, 7)}-01`)}>
          {yearly ? 'Ir a este año' : 'Ir a este mes'}
        </button>
      )}
    </div>
  )
}
