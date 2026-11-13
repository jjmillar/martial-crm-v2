import { useMemo } from 'react'
import { Link, useSearchParams } from '../../lib/nav'
import { useQuery } from '@tanstack/react-query'
import { useSchool } from '../../lib/school'
import { addDays, dayMonth, longDate, monthGrid, monthTitle, startOfWeek, todayIso } from '../../lib/dates'
import { hhmm, isoWeekday, weekdayShort } from '../../lib/weekdays'
import { Icon } from '../../ui/Icon'
import { classesKey, listClasses, type ClassFull } from '../clases/api'

type View = 'day' | 'week' | 'month'
type Slot = { id: string; cls: ClassFull; start: string; end: string; weekday: number }

const views: { id: View; label: string }[] = [
  { id: 'day', label: 'Día' },
  { id: 'week', label: 'Semana' },
  { id: 'month', label: 'Mes' },
]
const toMin = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5))

export function CalendarioPage() {
  const { activeSchool } = useSchool()
  const schoolId = activeSchool?.id
  const [params, setParams] = useSearchParams()
  const classes = useQuery({ queryKey: classesKey(schoolId), queryFn: () => listClasses(schoolId!), enabled: Boolean(schoolId) })

  // View and date live in the URL so the back button and shared links work.
  const view = (params.get('vista') as View | null) ?? ((activeSchool?.default_calendar_view as View | undefined) ?? 'week')
  const date = params.get('fecha') ?? todayIso()
  const go = (next: { vista?: View; fecha?: string }) => {
    const p = new URLSearchParams(params)
    if (next.vista) p.set('vista', next.vista)
    if (next.fecha) p.set('fecha', next.fecha)
    setParams(p, { replace: true })
  }

  const slotsByDay = useMemo(() => {
    const m = new Map<number, Slot[]>()
    for (const c of classes.data ?? []) {
      if (!c.active) continue
      for (const s of c.schedules) {
        const list = m.get(s.weekday) ?? []
        list.push({ id: s.id, cls: c, start: hhmm(s.start_time), end: hhmm(s.end_time), weekday: s.weekday })
        m.set(s.weekday, list)
      }
    }
    for (const list of m.values()) list.sort((a, b) => a.start.localeCompare(b.start))
    return m
  }, [classes.data])
  const slotsOn = (iso: string) => slotsByDay.get(isoWeekday(iso)) ?? []

  const step = view === 'day' ? 1 : view === 'week' ? 7 : 0
  const prev = () => go({ fecha: step ? addDays(date, -step) : shiftMonth(date, -1) })
  const next = () => go({ fecha: step ? addDays(date, step) : shiftMonth(date, 1) })
  const weekStart = startOfWeek(date)
  const title = view === 'day' ? longDate(date) : view === 'week' ? `${dayMonth(weekStart)} – ${dayMonth(addDays(weekStart, 6))}` : monthTitle(date)
  const today = todayIso()

  if (!activeSchool) return <p className="page-note">Selecciona una escuela para ver su calendario.</p>

  return (
    <div className="calendario">
      <header className="page-head">
        <span className="eyebrow">{activeSchool.name}</span>
        <h1>Calendario</h1>
      </header>

      <div className="cal-bar">
        <div className="cal-nav">
          <button type="button" className="icon-btn" onClick={prev} aria-label="Anterior"><Icon name="back" size={16} /></button>
          <button type="button" className="btn btn--ghost cal-today" onClick={() => go({ fecha: todayIso() })}>Hoy</button>
          <button type="button" className="icon-btn cal-next" onClick={next} aria-label="Siguiente"><Icon name="back" size={16} /></button>
          <h2 className="cal-title">{title}</h2>
        </div>
        <div className="segmented" role="group" aria-label="Vista">
          {views.map((v) => <button key={v.id} type="button" aria-pressed={view === v.id} onClick={() => go({ vista: v.id })}>{v.label}</button>)}
        </div>
      </div>

      {classes.isLoading && <p className="hint">Cargando…</p>}
      {classes.isSuccess && slotsByDay.size === 0 && (
        <div className="card empty">
          <h2>Sin horarios</h2>
          <p className="hint">El calendario se arma con los horarios semanales de tus clases activas.</p>
          <Link className="btn" to="/app/clases">Ir a Clases</Link>
        </div>
      )}

      {slotsByDay.size > 0 && view === 'day' && <DayList date={date} slots={slotsOn(date)} />}

      {slotsByDay.size > 0 && view === 'week' && (
        <>
          <WeekGrid weekStart={weekStart} slotsOn={slotsOn} today={today} />
          <div className="cal-agenda">
            {Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)).map((d) => (
              <section key={d} className={`cal-agenda__day${d === today ? ' is-today' : ''}`}>
                <h3>{longDate(d)}</h3>
                {slotsOn(d).length ? <SlotList date={d} slots={slotsOn(d)} /> : <p className="hint">Sin clases</p>}
              </section>
            ))}
          </div>
        </>
      )}

      {slotsByDay.size > 0 && view === 'month' && (
        <div className="cal-month" role="grid" aria-label={monthTitle(date)}>
          {[1, 2, 3, 4, 5, 6, 7].map((w) => <div key={w} className="cal-month__head" role="columnheader">{weekdayShort(w)}</div>)}
          {monthGrid(date).map((d) => {
            const n = slotsOn(d).length
            const out = d.slice(0, 7) !== date.slice(0, 7)
            return (
              <button
                key={d}
                type="button"
                role="gridcell"
                className={`cal-month__cell${out ? ' is-out' : ''}${d === today ? ' is-today' : ''}`}
                onClick={() => go({ vista: 'day', fecha: d })}
                aria-label={`${longDate(d)}: ${n} ${n === 1 ? 'clase' : 'clases'}`}
              >
                <span className="cal-month__num">{Number(d.slice(8, 10))}</span>
                {n > 0 && (
                  <span className="cal-month__dots" aria-hidden="true">
                    {slotsOn(d).slice(0, 4).map((s) => <i key={s.id} style={{ background: s.cls.color }} />)}
                    {n > 4 && <em>+{n - 4}</em>}
                  </span>
                )}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

function shiftMonth(iso: string, delta: number): string {
  const [y, m] = iso.split('-').map(Number)
  const d = new Date(Date.UTC(y, m - 1 + delta, 1))
  return d.toISOString().slice(0, 10)
}

function SlotList({ date, slots }: { date: string; slots: Slot[] }) {
  return (
    <ul className="cal-slots">
      {slots.map((s) => (
        <li key={s.id} style={{ ['--class-color' as string]: s.cls.color }}>
          <span className="cal-slots__time">{s.start}<br />{s.end}</span>
          <span className="cal-slots__main">
            <strong>{s.cls.name}</strong>
            <span className="hint">{[s.cls.teacher?.full_name, s.cls.room].filter(Boolean).join(' · ') || 'Sin profesor'}</span>
          </span>
          <span className="cal-slots__actions">
            <Link className="btn btn--ghost" to={`/app/asistencia?clase=${s.cls.id}&fecha=${date}`}>Asistencia</Link>
          </span>
        </li>
      ))}
    </ul>
  )
}

function DayList({ date, slots }: { date: string; slots: Slot[] }) {
  if (!slots.length) return <p className="card hint">Sin clases este día.</p>
  return <SlotList date={date} slots={slots} />
}

/** Desktop week: hour grid with absolutely positioned blocks. Hidden on phones (agenda is shown instead). */
function WeekGrid({ weekStart, slotsOn, today }: { weekStart: string; slotsOn: (d: string) => Slot[]; today: string }) {
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))
  const all = days.flatMap(slotsOn)
  if (!all.length) return <p className="card hint cal-week-empty">Sin clases esta semana.</p>
  const minH = Math.floor(Math.min(...all.map((s) => toMin(s.start))) / 60)
  const maxH = Math.ceil(Math.max(...all.map((s) => toMin(s.end))) / 60)
  const hours = Array.from({ length: maxH - minH }, (_, i) => minH + i)
  const PX = 56 // px per hour
  return (
    <div className="cal-week" style={{ ['--rows' as string]: hours.length, ['--hour' as string]: `${PX}px` }}>
      <div className="cal-week__corner" />
      {days.map((d) => (
        <div key={d} className={`cal-week__head${d === today ? ' is-today' : ''}`}>
          <span>{weekdayShort(isoWeekday(d))}</span> <b>{Number(d.slice(8, 10))}</b>
        </div>
      ))}
      <div className="cal-week__hours">
        {hours.map((h) => <span key={h} style={{ height: PX }}>{String(h).padStart(2, '0')}:00</span>)}
      </div>
      {days.map((d) => (
        <div key={d} className="cal-week__col" style={{ height: hours.length * PX }}>
          {slotsOn(d).map((s) => {
            const top = ((toMin(s.start) - minH * 60) / 60) * PX
            const height = Math.max(((toMin(s.end) - toMin(s.start)) / 60) * PX - 2, 22)
            return (
              <Link
                key={s.id}
                to={`/app/asistencia?clase=${s.cls.id}&fecha=${d}`}
                className="cal-block"
                style={{ top, height, ['--class-color' as string]: s.cls.color }}
                title={`${s.cls.name} ${s.start}–${s.end} · tomar asistencia`}
              >
                <strong>{s.cls.name}</strong>
                <span>{s.start}–{s.end}</span>
              </Link>
            )
          })}
        </div>
      ))}
    </div>
  )
}
