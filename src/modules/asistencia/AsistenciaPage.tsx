import { useMemo, useState } from 'react'
import { readPersisted, writePersisted } from '../../lib/persist'
import { Link, useSearchParams } from '../../lib/nav'
import { useQuery } from '@tanstack/react-query'
import { useSchool } from '../../lib/school'
import { addDays, longDate, startOfWeek, todayIso } from '../../lib/dates'
import { hhmm, isoWeekday } from '../../lib/weekdays'
import { Icon } from '../../ui/Icon'
import { DateNav } from '../../ui/DateNav'
import { classesKey, listClasses } from '../clases/api'
import { StudentAttendance } from '../portal/StudentPortal'
import { SchoolFilter } from '../../ui/SchoolFilter'
import { attendanceCounts, listSessions, sessionKey, syncSessions, trialBookings, view as cardView, type Session, type TrialBooking } from './api'
import { SessionDialog } from './SessionDialog'

type View = 'day' | 'week' | 'month'

const nowHHMM = () => new Intl.DateTimeFormat('en-GB', { timeZone: 'America/Santiago', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date())

function monthRange(iso: string): [string, string] {
  const [y, m] = iso.split('-').map(Number)
  const first = `${iso.slice(0, 7)}-01`
  const last = new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10)
  return [first, last]
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

// Asistencia (staff): a stack of class cards for a day, week or month. Each card is one class on one date, stored as
// a numbered record (class_sessions) and opens it: trial bookings, the attendance list, and that session's skills and
// description.
function StaffAttendance() {
  const { activeSchool } = useSchool()
  const schoolId = activeSchool?.id
  const [params, setParams] = useSearchParams()
  // The URL wins (links, back button); otherwise the last view (device) and date (this session) come back.
  const view = (params.get('vista') as View | null) ?? readPersisted<View>('asistencia.vista', 'day')
  const date = params.get('fecha') ?? readPersisted('asistencia.fecha', todayIso(), 'session')
  const go = (next: { vista?: View; fecha?: string }) => {
    const p = new URLSearchParams(params)
    if (next.vista) { p.set('vista', next.vista); writePersisted('asistencia.vista', next.vista) }
    if (next.fecha) { p.set('fecha', next.fecha); writePersisted('asistencia.fecha', next.fecha, 'session') }
    setParams(p, { replace: true })
  }
  const today = todayIso()

  const [from, to] = view === 'day' ? [date, date] : view === 'week' ? [startOfWeek(date), addDays(startOfWeek(date), 6)] : monthRange(date)
  const classes = useQuery({ queryKey: classesKey(schoolId), queryFn: () => listClasses(schoolId!), enabled: Boolean(schoolId) })
  const counts = useQuery({ queryKey: ['attendance-range', schoolId, from, to], queryFn: () => attendanceCounts(schoolId!, from, to), enabled: Boolean(schoolId) })
  const trials = useQuery({ queryKey: ['trial-range', schoolId, from, to], queryFn: () => trialBookings(schoolId!, from, to), enabled: Boolean(schoolId) })
  // Make sure every class up to today is stored and numbered, then read the records of the range.
  const synced = useQuery({ queryKey: ['sessions-sync', schoolId], queryFn: () => syncSessions(schoolId!), enabled: Boolean(schoolId), staleTime: 5 * 60_000 })
  const rows = useQuery({ queryKey: ['class-sessions', schoolId, from, to], queryFn: () => listSessions(schoolId!, from, to), enabled: Boolean(schoolId) && synced.isFetched })

  // Each date of the range: its stored sessions plus the blocks of active classes not stored yet (future), by time.
  const days = useMemo(() => {
    const all = new Map((classes.data ?? []).map((c) => [c.id, c]))
    const active = (classes.data ?? []).filter((c) => c.active)
    const stored = new Map((rows.data ?? []).map((r) => [sessionKey(r.class_id, r.date, r.start_time), r]))
    return datesBetween(from, to).map((d) => {
      const list = new Map<string, Session>()
      for (const cls of active) {
        for (const b of cls.schedules.filter((x) => x.weekday === isoWeekday(d))) {
          const key = sessionKey(cls.id, d, b.start_time)
          list.set(key, { key, cls, date: d, start_time: b.start_time, end_time: b.end_time, scheduleId: b.id, row: stored.get(key) ?? null })
        }
      }
      for (const r of rows.data ?? []) {
        const key = sessionKey(r.class_id, r.date, r.start_time)
        const cls = all.get(r.class_id)
        if (r.date !== d || list.has(key) || !cls) continue
        list.set(key, { key, cls, date: d, start_time: r.start_time, end_time: r.end_time, scheduleId: r.schedule_id, row: r })
      }
      return { date: d, sessions: [...list.values()].sort((a, b) => a.start_time.localeCompare(b.start_time) || a.cls.name.localeCompare(b.cls.name)) }
    })
  }, [classes.data, rows.data, from, to])

  const trialsBy = useMemo(() => {
    const m = new Map<string, TrialBooking[]>()
    for (const t of trials.data ?? []) {
      const k = t.schedule_id ? `s:${t.schedule_id}|${t.date}` : `c:${t.class_id}|${t.date}|${t.start_time}`
      m.set(k, [...(m.get(k) ?? []), t])
    }
    return m
  }, [trials.data])
  const trialsOf = (s: Session) => [...(s.scheduleId ? trialsBy.get(`s:${s.scheduleId}|${s.date}`) ?? [] : []), ...(trialsBy.get(`c:${s.cls.id}|${s.date}|${s.start_time}`) ?? [])]

  const [openKey, setOpenKey] = useState<string | null>(null)
  const [last, setLast] = useState<Session | null>(null) // stays while the pop-up closes
  const keyOf = (s: Session) => s.key
  const current = days.flatMap((d) => d.sessions).find((s) => keyOf(s) === openKey) ?? last

  const shownDays = view === 'day' ? days : days.filter((d) => d.sessions.length > 0)
  const noClasses = classes.isSuccess && !(classes.data ?? []).some((c) => c.active && c.schedules.length) && !(rows.data ?? []).length

  if (!activeSchool) return <p className="page-note">Selecciona una escuela.</p>

  return (
    <div className="asistencia">
      <header className="page-head">
        <SchoolFilter />
        <h1>Asistencia</h1>
      </header>

      <DateNav view={view} date={date} onChange={go} />

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
                  const cnt = counts.data?.get(`${s.cls.id}|${s.date}`)
                  const n = cnt?.present ?? 0
                  const waiting = cnt?.pending ?? 0
                  const t = trialsOf(s).length
                  const v = cardView(s)
                  const live = s.date === today && hhmm(s.start_time) <= nowHHMM() && nowHHMM() < hhmm(s.end_time)
                  return (
                    <li key={keyOf(s)}>
                      <button type="button" className={`att-card${live ? ' is-live' : ''}`} style={{ ['--class-color' as string]: v.color }}
                        onClick={() => { setLast(s); setOpenKey(keyOf(s)) }}
                        aria-label={`${v.number ? `Clase N° ${v.number}, ` : ''}${v.name}, ${hhmm(s.start_time)}. ${n} presentes${t ? `, ${t} ${t === 1 ? 'clase de prueba' : 'clases de prueba'}` : ''}. Abrir`}>
                        <span className="att-card__time">{hhmm(s.start_time)}<small>{hhmm(s.end_time)}</small></span>
                        <span className="att-card__main">
                          <span className="att-card__no">{v.number ? `N° ${v.number}` : 'Programada'}</span>
                          <strong>{v.name}</strong>
                          <span className="hint">{[v.teacher, v.room].filter(Boolean).join(' · ') || 'Sin profesor'}</span>
                          <span className="att-card__tags">
                            {live && <span className="tag tag--ok">En curso</span>}
                            {s.date <= today && <span className="tag">{n} {n === 1 ? 'presente' : 'presentes'}</span>}
                            {waiting > 0 && <span className="tag tag--wait">{waiting} por aprobar</span>}
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
