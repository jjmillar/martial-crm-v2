import { useMemo, useState } from 'react'
import { Link, useSearchParams } from '../../lib/nav'
import { useQuery } from '@tanstack/react-query'
import { useSchool } from '../../lib/school'
import { addDays, dayMonth, longDate, monthTitle, startOfWeek, todayIso } from '../../lib/dates'
import { hhmm, isoWeekday } from '../../lib/weekdays'
import { Icon } from '../../ui/Icon'
import { classesKey, listClasses } from '../clases/api'
import { StudentAttendance } from '../portal/StudentPortal'
import { SchoolFilter } from '../../ui/SchoolFilter'
import { attendanceCounts, trialBookings, type Session, type TrialBooking } from './api'
import { SessionDialog } from './SessionDialog'

type View = 'day' | 'week' | 'month'
const views: { id: View; label: string }[] = [
  { id: 'day', label: 'Día' },
  { id: 'week', label: 'Semana' },
  { id: 'month', label: 'Mes' },
]

const nowHHMM = () => new Intl.DateTimeFormat('en-GB', { timeZone: 'America/Santiago', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date())

function monthRange(iso: string): [string, string] {
  const [y, m] = iso.split('-').map(Number)
  const first = `${iso.slice(0, 7)}-01`
  const last = new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10)
  return [first, last]
}
function shiftMonth(iso: string, delta: number): string {
  const [y, m] = iso.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1 + delta, 1)).toISOString().slice(0, 10)
}
function datesBetween(from: string, to: string): string[] {
  const out: string[] = []
  for (let d = from; d <= to; d = addDays(d, 1)) out.push(d)
  return out
}

export function AsistenciaPage() {
  const { role } = useSchool()
  return role === 'alumno' ? <StudentAttendance /> : <StaffAttendance />
}

// Asistencia (staff): a stack of class cards for a day, week or month. Each card opens the class on that date:
// trial classes booked from the landing page, the attendance list, and the class's skills and description.
function StaffAttendance() {
  const { activeSchool } = useSchool()
  const schoolId = activeSchool?.id
  const [params, setParams] = useSearchParams()
  const view = (params.get('vista') as View | null) ?? 'day'
  const date = params.get('fecha') ?? todayIso()
  const go = (next: { vista?: View; fecha?: string }) => {
    const p = new URLSearchParams(params)
    if (next.vista) p.set('vista', next.vista)
    if (next.fecha) p.set('fecha', next.fecha)
    setParams(p, { replace: true })
  }
  const today = todayIso()

  const [from, to] = view === 'day' ? [date, date] : view === 'week' ? [startOfWeek(date), addDays(startOfWeek(date), 6)] : monthRange(date)
  const classes = useQuery({ queryKey: classesKey(schoolId), queryFn: () => listClasses(schoolId!), enabled: Boolean(schoolId) })
  const counts = useQuery({ queryKey: ['attendance-range', schoolId, from, to], queryFn: () => attendanceCounts(schoolId!, from, to), enabled: Boolean(schoolId) })
  const trials = useQuery({ queryKey: ['trial-range', schoolId, from, to], queryFn: () => trialBookings(schoolId!, from, to), enabled: Boolean(schoolId) })

  // Every block of every active class on each date of the range, by date then time.
  const days = useMemo(() => {
    const active = (classes.data ?? []).filter((c) => c.active)
    return datesBetween(from, to).map((d) => ({
      date: d,
      sessions: active
        .flatMap((cls) => cls.schedules.filter((b) => b.weekday === isoWeekday(d)).map((block): Session => ({ cls, block, date: d })))
        .sort((a, b) => a.block.start_time.localeCompare(b.block.start_time) || a.cls.name.localeCompare(b.cls.name)),
    }))
  }, [classes.data, from, to])

  const trialsBy = useMemo(() => {
    const m = new Map<string, TrialBooking[]>()
    for (const t of trials.data ?? []) {
      const k = t.schedule_id ? `s:${t.schedule_id}|${t.date}` : `c:${t.class_id}|${t.date}|${t.start_time}`
      m.set(k, [...(m.get(k) ?? []), t])
    }
    return m
  }, [trials.data])
  const trialsOf = (s: Session) => [...(trialsBy.get(`s:${s.block.id}|${s.date}`) ?? []), ...(trialsBy.get(`c:${s.cls.id}|${s.date}|${s.block.start_time}`) ?? [])]

  const [openKey, setOpenKey] = useState<string | null>(null)
  const [last, setLast] = useState<Session | null>(null) // stays while the pop-up closes
  const keyOf = (s: Session) => `${s.block.id}|${s.date}`
  const current = days.flatMap((d) => d.sessions).find((s) => keyOf(s) === openKey) ?? last

  const step = view === 'day' ? 1 : view === 'week' ? 7 : 0
  const prev = () => go({ fecha: step ? addDays(date, -step) : shiftMonth(date, -1) })
  const next = () => go({ fecha: step ? addDays(date, step) : shiftMonth(date, 1) })
  const title = view === 'day' ? longDate(date) : view === 'week' ? `${dayMonth(from)} – ${dayMonth(to)}` : monthTitle(date)
  const shownDays = view === 'day' ? days : days.filter((d) => d.sessions.length > 0)
  const noClasses = classes.isSuccess && !(classes.data ?? []).some((c) => c.active && c.schedules.length)

  if (!activeSchool) return <p className="page-note">Selecciona una escuela.</p>

  return (
    <div className="asistencia">
      <header className="page-head">
        <SchoolFilter />
        <h1>Asistencia</h1>
      </header>

      <div className="cal-bar">
        <div className="cal-nav">
          <button type="button" className="icon-btn" onClick={prev} aria-label="Anterior"><Icon name="back" size={16} /></button>
          <button type="button" className="btn btn--ghost cal-today" onClick={() => go({ fecha: today })}>Hoy</button>
          <button type="button" className="icon-btn cal-next" onClick={next} aria-label="Siguiente"><Icon name="back" size={16} /></button>
          <h2 className="cal-title">{title}</h2>
        </div>
        <div className="segmented" role="group" aria-label="Vista">
          {views.map((v) => <button key={v.id} type="button" aria-pressed={view === v.id} onClick={() => go({ vista: v.id })}>{v.label}</button>)}
        </div>
      </div>

      {classes.isLoading && <p className="hint">Cargando…</p>}
      {noClasses && (
        <div className="card empty">
          <h2>Sin clases</h2>
          <p className="hint">Las tarjetas se arman con los horarios de tus clases activas.</p>
          <Link className="btn" to="/app/clases">Ir a Clases</Link>
        </div>
      )}

      {!noClasses && classes.isSuccess && (
        <div className="att-days" data-motion>
          {shownDays.map((d) => (
            <section key={d.date} className="att-day" aria-label={longDate(d.date)}>
              {view !== 'day' && <h3 className={`att-day__title${d.date === today ? ' is-today' : ''}`}>{longDate(d.date)}{d.date === today && <span className="tag tag--accent">Hoy</span>}</h3>}
              {d.sessions.length === 0 && <p className="hint">No hay clases este día.</p>}
              <ul className="att-stack">
                {d.sessions.map((s) => {
                  const n = counts.data?.get(`${s.cls.id}|${s.date}`) ?? 0
                  const t = trialsOf(s).length
                  const live = s.date === today && hhmm(s.block.start_time) <= nowHHMM() && nowHHMM() < hhmm(s.block.end_time)
                  return (
                    <li key={keyOf(s)}>
                      <button type="button" className={`att-card${live ? ' is-live' : ''}`} style={{ ['--class-color' as string]: s.cls.color }}
                        onClick={() => { setLast(s); setOpenKey(keyOf(s)) }}
                        aria-label={`${s.cls.name}, ${hhmm(s.block.start_time)}. ${n} presentes${t ? `, ${t} ${t === 1 ? 'clase de prueba' : 'clases de prueba'}` : ''}. Abrir`}>
                        <span className="att-card__time">{hhmm(s.block.start_time)}<small>{hhmm(s.block.end_time)}</small></span>
                        <span className="att-card__main">
                          <strong>{s.cls.name}</strong>
                          <span className="hint">{[s.cls.teacher?.full_name, s.cls.room].filter(Boolean).join(' · ') || 'Sin profesor'}</span>
                          <span className="att-card__tags">
                            {live && <span className="tag tag--ok">En curso</span>}
                            {s.date <= today && <span className="tag">{n} {n === 1 ? 'presente' : 'presentes'}</span>}
                            {t > 0 && <span className="tag tag--accent">{t === 1 ? '1 clase de prueba' : `${t} clases de prueba`}</span>}
                          </span>
                        </span>
                        <Icon name="arrow" size={16} />
                      </button>
                    </li>
                  )
                })}
              </ul>
            </section>
          ))}
          {view !== 'day' && shownDays.length === 0 && <p className="hint">No hay clases en este período.</p>}
        </div>
      )}

      <SessionDialog session={current} open={openKey !== null} onClose={() => setOpenKey(null)} trials={current ? trialsOf(current) : []} />
    </div>
  )
}
