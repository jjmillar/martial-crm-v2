import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import { readPersisted, writePersisted } from '../../lib/persist'
import { Link, useSearchParams } from '../../lib/nav'
import { useQuery } from '@tanstack/react-query'
import { useSchool } from '../../lib/school'
import { addDays, longDate, monthGrid, monthTitle, startOfWeek, todayIso } from '../../lib/dates'
import { hhmm, isoWeekday, weekdayShort } from '../../lib/weekdays'
import { DateNav } from '../../ui/DateNav'
import { Icon } from '../../ui/Icon'
import { classesKey, listClasses, type ClassFull } from '../clases/api'
import { SchoolFilter } from '../../ui/SchoolFilter'
import { useSessionPopup, type SessionTarget } from '../asistencia/SessionPopup'

type View = 'day' | 'week' | 'month'
type Slot = { id: string; cls: ClassFull; start: string; end: string; weekday: number }
type Open = (t: SessionTarget) => void

const toMin = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5))
const target = (s: Slot, date: string): SessionTarget => ({ cls: s.cls, date, start_time: s.start, end_time: s.end, scheduleId: s.id })
const who = (s: Slot) => [s.cls.teacher?.full_name, s.cls.room].filter(Boolean).join(' · ')

// The hours always shown, even with no classes (the grid never disappears); classes outside widen it.
const DAY_START = 7
const DAY_END = 22
const HOUR_PX = 52

/** Current time in Santiago as minutes, refreshed every minute (for the "now" line). */
function useNowMinutes() {
  const read = () => {
    const hm = new Intl.DateTimeFormat('en-GB', { timeZone: 'America/Santiago', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date())
    return toMin(hm)
  }
  const [now, setNow] = useState(read)
  useEffect(() => { const t = setInterval(() => setNow(read()), 60_000); return () => clearInterval(t) }, [])
  return now
}

/**
 * Calendario: the school's weekly schedule seen by day, week or month. The grid is always there (empty hours, empty
 * days), classes that overlap sit side by side, and tapping a class opens its attendance pop-up right here
 * (docs/ui-standards.md §6).
 */
export function CalendarioPage() {
  const { activeSchool } = useSchool()
  const schoolId = activeSchool?.id
  const [params, setParams] = useSearchParams()
  const classes = useQuery({ queryKey: classesKey(schoolId), queryFn: () => listClasses(schoolId!), enabled: Boolean(schoolId) })
  const popup = useSessionPopup(schoolId)

  // View and date live in the URL so the back button and shared links work.
  // The URL wins; otherwise the last view chosen on this device (else the school's default) and this session's date.
  const view = (params.get('vista') as View | null) ?? readPersisted<View>('calendario.vista', (activeSchool?.default_calendar_view as View | undefined) ?? 'week')
  const date = params.get('fecha') ?? readPersisted('calendario.fecha', todayIso(), 'session')
  const go = (next: { vista?: View; fecha?: string }) => {
    const p = new URLSearchParams(params)
    if (next.vista) { p.set('vista', next.vista); writePersisted('calendario.vista', next.vista) }
    if (next.fecha) { p.set('fecha', next.fecha); writePersisted('calendario.fecha', next.fecha, 'session') }
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
    for (const list of m.values()) list.sort((a, b) => a.start.localeCompare(b.start) || a.end.localeCompare(b.end))
    return m
  }, [classes.data])
  const slotsOn = (iso: string) => slotsByDay.get(isoWeekday(iso)) ?? []

  const weekStart = startOfWeek(date)
  const today = todayIso()
  const week = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))

  if (!activeSchool) return <p className="page-note">Selecciona una escuela para ver su calendario.</p>

  return (
    <div className="calendario">
      <header className="page-head">
        <SchoolFilter />
        <h1>Calendario</h1>
      </header>

      <DateNav view={view} date={date} onChange={go} />

      {classes.isSuccess && slotsByDay.size === 0 && (
        <p className="cal-notice">
          <Icon name="calendar" size={16} />
          <span>Aún no hay clases con horario: el calendario se llena con los horarios semanales de tus clases activas.</span>
          <Link className="link-btn" to="/app/clases">Crear clases en Clases <Icon name="arrow" size={14} /></Link>
        </p>
      )}

      {classes.isLoading ? <p className="hint">Cargando…</p> : (
        <>
          {view === 'day' && <TimeGrid days={[date]} slotsOn={slotsOn} today={today} onOpen={popup.openSession} detailed />}

          {view === 'week' && (
            <>
              <div className="cal-wide"><TimeGrid days={week} slotsOn={slotsOn} today={today} onOpen={popup.openSession} /></div>
              <Agenda days={week} slotsOn={slotsOn} today={today} onOpen={popup.openSession} />
            </>
          )}

          {view === 'month' && <Month date={date} slotsOn={slotsOn} today={today} onPick={(d) => go({ fecha: d })} onDay={(d) => go({ vista: 'day', fecha: d })} onOpen={popup.openSession} />}
        </>
      )}
      {popup.dialog}
    </div>
  )
}

/** Overlapping classes of a day get lanes (side by side), like a calendar app. */
function lanes(slots: Slot[]) {
  const out = new Map<string, { lane: number; of: number }>()
  let cluster: { s: Slot; lane: number }[] = []
  let clusterEnd = -1
  const laneEnds: number[] = []
  const flush = () => {
    const of = Math.max(1, ...cluster.map((c) => c.lane + 1))
    for (const c of cluster) out.set(c.s.id, { lane: c.lane, of })
    cluster = []
    laneEnds.length = 0
  }
  for (const s of slots) {
    const a = toMin(s.start), b = toMin(s.end)
    if (a >= clusterEnd) { flush(); clusterEnd = -1 }
    let lane = laneEnds.findIndex((end) => end <= a)
    if (lane === -1) { lane = laneEnds.length; laneEnds.push(b) } else laneEnds[lane] = b
    cluster.push({ s, lane })
    clusterEnd = Math.max(clusterEnd, b)
  }
  flush()
  return out
}

/**
 * Hour grid for one day (Día) or seven (Semana, desktop). Hours 07–22 always show; classes earlier or later widen it.
 * Each class is a button that opens its attendance pop-up.
 */
function TimeGrid({ days, slotsOn, today, onOpen, detailed = false }: { days: string[]; slotsOn: (d: string) => Slot[]; today: string; onOpen: Open; detailed?: boolean }) {
  const now = useNowMinutes()
  const all = days.flatMap(slotsOn)
  const startH = Math.min(DAY_START, ...all.map((s) => Math.floor(toMin(s.start) / 60)))
  const endH = Math.max(DAY_END, ...all.map((s) => Math.ceil(toMin(s.end) / 60)))
  const hours = Array.from({ length: endH - startH }, (_, i) => startH + i)
  const px = (min: number) => ((min - startH * 60) / 60) * HOUR_PX
  const showNow = days.includes(today) && now >= startH * 60 && now <= endH * 60
  const style = { ['--days' as string]: days.length, ['--hour' as string]: `${HOUR_PX}px`, ['--grid-h' as string]: `${hours.length * HOUR_PX}px` } as CSSProperties

  return (
    <div className={`cal-grid${days.length === 1 ? ' cal-grid--day' : ''}`} style={style} role="grid" aria-label={days.length === 1 ? longDate(days[0]) : `Semana del ${longDate(days[0])}`}>
      <div className="cal-grid__head" role="row">
        <span className="cal-grid__corner" aria-hidden="true" />
        {days.map((d) => (
          <span key={d} role="columnheader" className={`cal-grid__day${d === today ? ' is-today' : ''}`} aria-label={longDate(d)}>
            <small>{weekdayShort(isoWeekday(d))}</small>
            <b>{Number(d.slice(8, 10))}</b>
          </span>
        ))}
      </div>
      <div className="cal-grid__body" role="row">
        <div className="cal-grid__hours" aria-hidden="true">
          {hours.map((h, i) => <span key={h} className={i === 0 ? 'is-first' : undefined} style={{ top: i * HOUR_PX }}>{String(h).padStart(2, '0')}:00</span>)}
        </div>
        {days.map((d) => {
          const list = slotsOn(d)
          const lay = lanes(list)
          return (
            <div key={d} role="gridcell" className={`cal-grid__col${d === today ? ' is-today' : ''}`} aria-label={`${longDate(d)}: ${list.length ? `${list.length} ${list.length === 1 ? 'clase' : 'clases'}` : 'sin clases'}`}>
              {list.map((s) => {
                const top = px(toMin(s.start))
                const height = Math.max(px(toMin(s.end)) - top - 3, 20)
                const { lane, of } = lay.get(s.id) ?? { lane: 0, of: 1 }
                const short = height < 40
                const meta = who(s)
                return (
                  <button
                    key={s.id}
                    type="button"
                    className={`cal-block${short ? ' cal-block--short' : ''}`}
                    style={{ top, height, ['--lane' as string]: lane, ['--lanes' as string]: of, ['--clamp' as string]: height >= 60 ? 2 : 1, ['--class-color' as string]: s.cls.color }}
                    onClick={() => onOpen(target(s, d))}
                    aria-label={`${s.cls.name}, ${longDate(d)}, ${s.start} a ${s.end}${meta ? `, ${meta}` : ''}. Tomar asistencia`}
                  >
                    <strong>{s.cls.name}</strong>
                    <span className="cal-block__time">{short || of > 1 ? s.start : `${s.start}–${s.end}`}</span>
                    {detailed && meta && !short && <span className="cal-block__meta">{meta}</span>}
                  </button>
                )
              })}
              {showNow && d === today && <span className="cal-now" style={{ top: px(now) }} aria-hidden="true" />}
            </div>
          )
        })}
      </div>
    </div>
  )
}

/** Week on phones: one row per day, a date badge and that day's classes (empty days stay, quietly). */
function Agenda({ days, slotsOn, today, onOpen }: { days: string[]; slotsOn: (d: string) => Slot[]; today: string; onOpen: Open }) {
  return (
    <ol className="cal-agenda" aria-label="Clases de la semana">
      {days.map((d) => {
        const list = slotsOn(d)
        return (
          <li key={d} className={`cal-agenda__day${d === today ? ' is-today' : ''}${list.length ? '' : ' is-empty'}`}>
            <span className="cal-agenda__date" aria-label={longDate(d)}>
              <small>{weekdayShort(isoWeekday(d))}</small>
              <b>{Number(d.slice(8, 10))}</b>
            </span>
            {list.length ? <SlotList date={d} slots={list} onOpen={onOpen} /> : <span className="cal-agenda__none">Sin clases</span>}
          </li>
        )
      })}
    </ol>
  )
}

/**
 * Month: each day shows its classes as chips (time + name, in the class color), "+N" when there are more. Tapping a
 * day selects it and its classes are listed below the grid; tapping a chip opens that class's pop-up.
 */
function Month({ date, slotsOn, today, onPick, onDay, onOpen }: { date: string; slotsOn: (d: string) => Slot[]; today: string; onPick: (d: string) => void; onDay: (d: string) => void; onOpen: Open }) {
  const MAX = 3
  const picked = slotsOn(date)
  return (
    <>
      <div className="cal-month" role="grid" aria-label={monthTitle(date)}>
        <div className="cal-month__row cal-month__row--head" role="row">
          {[1, 2, 3, 4, 5, 6, 7].map((w) => <span key={w} className="cal-month__head" role="columnheader">{weekdayShort(w)}</span>)}
        </div>
        <div className="cal-month__cells">
          {monthGrid(date).map((d) => {
            const list = slotsOn(d)
            const out = d.slice(0, 7) !== date.slice(0, 7)
            const more = list.length - MAX
            return (
              <div
                key={d}
                role="gridcell"
                aria-selected={d === date}
                className={`cal-month__cell${out ? ' is-out' : ''}${d === today ? ' is-today' : ''}${d === date ? ' is-picked' : ''}`}
                onClick={() => onPick(d)}
              >
                <button type="button" className="cal-month__num" onClick={(e) => { e.stopPropagation(); onPick(d) }} aria-label={`${longDate(d)}: ${list.length ? `${list.length} ${list.length === 1 ? 'clase' : 'clases'}` : 'sin clases'}`}>
                  {Number(d.slice(8, 10))}
                </button>
                {list.slice(0, MAX).map((s) => (
                  <button key={s.id} type="button" className="cal-chip" style={{ ['--class-color' as string]: s.cls.color }}
                    onClick={(e) => { e.stopPropagation(); onOpen(target(s, d)) }}
                    aria-label={`${s.cls.name}, ${longDate(d)}, ${s.start}. Tomar asistencia`}>
                    <span className="cal-chip__time">{s.start}</span>
                    <span className="cal-chip__name">{s.cls.name}</span>
                  </button>
                ))}
                {more > 0 && <span className="cal-chip__more">+{more} más</span>}
              </div>
            )
          })}
        </div>
      </div>

      <section className="cal-picked" aria-labelledby="cal-picked-h">
        <div className="cal-picked__head">
          <h2 id="cal-picked-h">{longDate(date)}{date === today && <span className="tag tag--accent">Hoy</span>}</h2>
          <button type="button" className="link-btn" onClick={() => onDay(date)}>Ver por horas</button>
        </div>
        {picked.length ? <SlotList date={date} slots={picked} onOpen={onOpen} /> : <p className="hint">Sin clases este día.</p>}
      </section>
    </>
  )
}

function SlotList({ date, slots, onOpen }: { date: string; slots: Slot[]; onOpen: Open }) {
  return (
    <ul className="cal-slots">
      {slots.map((s) => (
        <li key={s.id} style={{ ['--class-color' as string]: s.cls.color }}>
          <button type="button" className="cal-slot" onClick={() => onOpen(target(s, date))} aria-label={`${s.cls.name}, ${s.start} a ${s.end}. Tomar asistencia`}>
            <span className="cal-slots__time">{s.start}<small>{s.end}</small></span>
            <span className="cal-slots__main">
              <strong>{s.cls.name}</strong>
              <span className="hint">{who(s) || 'Sin profesor'}</span>
            </span>
            <span className="cal-slots__go">Asistencia <Icon name="arrow" size={14} /></span>
          </button>
        </li>
      ))}
    </ul>
  )
}
