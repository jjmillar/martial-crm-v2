import { useMemo, useState } from 'react'
import { Link } from '../../lib/nav'
import { useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query'
import { usePersisted } from '../../lib/persist'
import { Avatar } from '../../ui/Avatar'
import { mergeProgress } from './multi'
import { useAuth } from '../../lib/auth'
import { useSchool } from '../../lib/school'
import { supabase } from '../../lib/supabase'
import { addDays, formatDate, longDate, todayIso } from '../../lib/dates'
import { formatCLP } from '../../lib/money'
import { hhmm, isoWeekday } from '../../lib/weekdays'
import { Icon } from '../../ui/Icon'
import { latestSubmissions, submissionsKey } from '../pagar/api'
import { PayDialog } from '../pagar/Checkout'
import { ShowMore } from '../../ui/ShowMore'
import { useShowMore } from '../../ui/useShowMore'
import { classOpen, opensAt } from '../asistencia/api'
import { classesKey, listClasses, type ClassFull } from '../clases/api'
import { MisCinturones, MisLogros } from '../artes/Logros'
import { SkillsBreakdown } from './SkillsBreakdown'
import {
  checkIn, myAttendance, myAttendanceKey, myEnrollments, myPendingPayments, progressKey, studentProgress, undoCheckIn,
  XP_PER_CLASS, type MyAttendance,
} from './api'

function useMe() {
  const { activeSchool, student, myStudent } = useSchool()
  // The guardian may be looking at a child's portal: everything below acts for that child.
  const child = Boolean(student && student.id !== myStudent?.id)
  return { schoolId: activeSchool?.id, school: activeSchool, studentId: student?.id, name: student?.full_name ?? '', child }
}

/** Days back a student can still mark a class they forgot (the database enforces the same window). */
const PAST_DAYS = 7

/**
 * "Marcar asistencia" for students: today's classes (enabled from 1 hour before each starts) and the classes of the last
 * 7 days not yet approved, so a forgotten one (e.g. yesterday's) can still be marked. Each mark is a request the
 * school's team approves.
 */
export function TodayCheckIn() {
  const { schoolId, studentId } = useMe()
  const qc = useQueryClient()
  const today = todayIso()
  const classes = useQuery({ queryKey: classesKey(schoolId), queryFn: () => listClasses(schoolId!), enabled: Boolean(schoolId) })
  const att = useQuery({ queryKey: myAttendanceKey(studentId), queryFn: () => myAttendance(studentId!), enabled: Boolean(studentId) })
  const [error, setError] = useState<string | null>(null)
  const pastMore = useShowMore('portal.pasadas')

  const blocksOn = (date: string) => {
    const wd = isoWeekday(date)
    return (classes.data ?? [])
      .filter((c) => c.active && (!c.created_at || c.created_at.slice(0, 10) <= date))
      .flatMap((c) => c.schedules.filter((s) => s.weekday === wd).map((s) => ({ c, s, date })))
      .sort((a, b) => a.s.start_time.localeCompare(b.s.start_time))
  }
  const mine = useMemo(() => new Map((att.data ?? []).map((a) => [`${a.class_id}|${a.date}`, a])), [att.data])
  const todays = useMemo(() => blocksOn(today), [classes.data, today]) // eslint-disable-line react-hooks/exhaustive-deps
  // Earlier days: only what is still to do (not marked, or waiting for approval). Approved ones live in Historial.
  const past = useMemo(() => {
    const out: ReturnType<typeof blocksOn> = []
    for (let i = 1; i <= PAST_DAYS; i++) {
      for (const b of blocksOn(addDays(today, -i))) {
        const a = mine.get(`${b.c.id}|${b.date}`)
        if (!a?.confirmed_at) out.push(b)
      }
    }
    return out
  }, [classes.data, mine, today]) // eslint-disable-line react-hooks/exhaustive-deps

  const refresh = () => Promise.all([
    qc.invalidateQueries({ queryKey: myAttendanceKey(studentId) }),
    qc.invalidateQueries({ queryKey: progressKey(studentId) }),
  ])
  const mark = useMutation({ mutationFn: (v: { classId: string; date: string }) => checkIn(studentId!, v.classId, v.date), onMutate: () => setError(null), onSuccess: refresh, onError: (e: Error) => setError(e.message) })
  const undo = useMutation({ mutationFn: (v: { classId: string; date: string }) => undoCheckIn(studentId!, v.classId, v.date), onMutate: () => setError(null), onSuccess: refresh, onError: (e: Error) => setError(e.message) })

  const row = ({ c, s, date }: { c: ClassFull; s: ClassFull['schedules'][number]; date: string }) => {
    const a = mine.get(`${c.id}|${date}`)
    const isToday = date === today
    return (
      <li key={`${s.id}|${date}`} style={{ ['--class-color' as string]: c.color }}>
        <span className="today-list__time">{hhmm(s.start_time)}</span>
        <span className="today-list__name">
          <strong>{c.name}</strong>
          <span className="hint">{isToday ? `${hhmm(s.start_time)}–${hhmm(s.end_time)}` : dayLabel(date, today)}{c.room ? ` · ${c.room}` : ''}</span>
        </span>
        {!a && (classOpen(date, s.start_time) ? (
          <button type="button" className="btn" disabled={mark.isPending} onClick={() => mark.mutate({ classId: c.id, date })}>
            <Icon name="check" size={16} /> Marcar asistencia
          </button>
        ) : (
          <span className="tag" title="Puedes marcar tu asistencia desde 1 hora antes de la clase">Desde las {opensAt(s.start_time)}</span>
        ))}
        {a && !a.confirmed_at && (
          <span className="checkin-state">
            <span className="tag tag--wait">Por aprobar</span>
            <button type="button" className="link-btn" disabled={undo.isPending} onClick={() => undo.mutate({ classId: c.id, date })}>Deshacer</button>
          </span>
        )}
        {a?.confirmed_at && <span className="tag tag--ok"><Icon name="check" size={14} /> +{XP_PER_CLASS} XP</span>}
      </li>
    )
  }

  if (!classes.isSuccess) return <p className="hint">Cargando…</p>
  return (
    <div className="checkin">
      {error && <p className="alert" role="alert">{error}</p>}
      {todays.length > 0
        ? <ul className="checkin-list">{todays.map(row)}</ul>
        : <NextClass classes={classes.data} today={today} />}
      {past.length > 0 && (
        <>
          <p className="checkin-sub">¿Se te pasó marcar? Clases de los últimos {PAST_DAYS} días</p>
          <ul className="checkin-list">{past.slice(0, pastMore.shown).map(row)}</ul>
          <ShowMore shown={pastMore.shown} total={past.length} onMore={pastMore.more} />
        </>
      )}
    </div>
  )
}

/** "Ayer" / "Lunes 16 de noviembre" for the earlier days list. */
function dayLabel(date: string, today: string): string {
  if (date === addDays(today, -1)) return `Ayer, ${longDate(date).replace(/^[^,]+, /, '')}`
  return longDate(date)
}


function AttendanceHistory({ rows, child = false }: { rows: MyAttendance[]; child?: boolean }) {
  if (rows.length === 0) return <p className="hint">{child ? 'Todavía no tiene asistencias registradas.' : 'Todavía no tienes asistencias registradas.'}</p>
  return (
    <ul className="today-list">
      {rows.map((a) => (
        <li key={a.id} style={{ ['--class-color' as string]: a.class?.color }}>
          <span className="today-list__time">{formatDate(a.date).slice(0, 5)}</span>
          <span className="today-list__name"><strong>{a.class?.name ?? 'Clase'}</strong><span className="hint">{a.self_marked ? (child ? 'Marcada por ti (apoderado)' : 'Marcada por ti') : child ? 'Marcada por su profesor' : 'Marcada por tu profesor'}</span></span>
          {a.confirmed_at ? <span className="tag tag--ok">+{XP_PER_CLASS} XP</span> : <span className="tag tag--wait">Por aprobar</span>}
        </li>
      ))}
    </ul>
  )
}

/**
 * The school line over the greeting. A student in several schools of the platform picks one there, or "Todas mis
 * escuelas" to see all their XP, skills, belts and achievements together.
 */
function SchoolLine({ all, setAll }: { all: boolean; setAll: (v: boolean) => void }) {
  const { schools, studentLinks, activeSchool, setActiveSchool } = useSchool()
  const mine = studentLinks.map((l) => ({ id: l.school_id, name: schools.find((s) => s.id === l.school_id)?.name ?? 'Escuela' }))
  const today = longDate(todayIso())
  if (mine.length < 2) return <p className="st-hero__meta">{activeSchool?.name ?? ''} · {today}</p>
  return (
    <p className="st-hero__meta">
      <label className="school-switch st-hero__school">
        <span className="sr-only">Escuela que ves</span>
        <span className="school-switch__name" aria-hidden="true">{all ? 'Todas mis escuelas' : activeSchool?.name}</span>
        <select value={all ? 'all' : activeSchool?.id ?? ''} onChange={(e) => {
          if (e.target.value === 'all') { setAll(true); return }
          setAll(false); setActiveSchool(e.target.value)
        }}>
          {mine.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
          <option value="all">Todas mis escuelas</option>
        </select>
        <Icon name="down" size={14} />
      </label>
      <span>· {today}</span>
    </p>
  )
}

/** Inicio for students: one school (level, XP, skills, check-in, plan, payments) or all of them added up. */
export function StudentHome() {
  const { studentLinks } = useSchool()
  const { child } = useMe()
  const [allPref, setAll] = usePersisted('portal.todas', false)
  const all = allPref && !child && studentLinks.length > 1
  return all ? <AllSchoolsHome setAll={setAll} /> : <SchoolHome setAll={setAll} />
}

function SchoolHome({ setAll }: { setAll: (v: boolean) => void }) {
  const { profile } = useAuth()
  const { student } = useSchool()
  const { school, studentId, name, child } = useMe()
  const progress = useQuery({ queryKey: progressKey(studentId), queryFn: () => studentProgress(studentId!), enabled: Boolean(studentId) })
  const att = useQuery({ queryKey: myAttendanceKey(studentId), queryFn: () => myAttendance(studentId!), enabled: Boolean(studentId) })
  const enr = useQuery({ queryKey: ['my-enrollments', studentId], queryFn: () => myEnrollments(studentId!), enabled: Boolean(studentId) })
  const pay = useQuery({ queryKey: ['my-payments', studentId], queryFn: () => myPendingPayments(studentId!), enabled: Boolean(studentId) })
  const subs = useQuery({ queryKey: submissionsKey(studentId), queryFn: () => latestSubmissions({ studentId }), enabled: Boolean(studentId) })
  const [paying, setPaying] = useState<string | null>(null)
  const [payOpen, setPayOpen] = useState(false)
  // Freshly approved accounts: nudge to complete contact and emergency data.
  const incomplete = useQuery({
    queryKey: ['my-student-incomplete', studentId],
    queryFn: async () => {
      const { data } = await supabase.from('students').select('phone, birth_date, emergency_contact, emergency_phone').eq('id', studentId!).single()
      return !data?.phone || !data?.birth_date || !data?.emergency_contact || !data?.emergency_phone
    },
    enabled: Boolean(studentId),
  })

  const p = progress.data
  const firstName = (child ? name : profile?.full_name || name).split(' ')[0]
  const pct = p ? Math.round((p.level_xp / p.next_level_xp) * 100) : 0
  const current = (enr.data ?? []).find((e) => e.status === 'activa')

  return (
    <div className="bento bento--student">
      <header className="st-hero rise">
        <Avatar path={student?.avatar_url} name={name} size={64} className="st-hero__photo" />
        <div className="st-hero__text">
          {child ? <p className="st-hero__meta">Perfil de tu hijo · {school?.name ?? ''}</p> : <SchoolLine all={false} setAll={setAll} />}
          <h1>{child ? firstName : <>Hola{firstName ? `, ${firstName}` : ''}</>}</h1>
          {child && <p className="hint">Como apoderado ves su nivel, su plan y sus pagos, y marcas su asistencia.</p>}
        </div>
      </header>


      <section className="tile level-card rise" style={{ animationDelay: '40ms' }} aria-label="Tu nivel">
        <div className="lvl">
          <span>Nivel</span>
          <strong>{p?.level ?? '—'}</strong>
        </div>
        <div className="xp">
          <div className="xp__bar" role="progressbar" aria-valuemin={0} aria-valuemax={p?.next_level_xp ?? 100} aria-valuenow={p?.level_xp ?? 0} aria-label="Experiencia para el siguiente nivel">
            <span style={{ width: `${pct}%` }} />
          </div>
          <p className="xp__text">{p ? <><b>{p.level_xp}</b> / {p.next_level_xp} XP</> : 'Cargando…'}</p>
        </div>
      </section>

      <section className="tile tile--wide rise" style={{ animationDelay: '60ms' }} id="marcar-asistencia">
        <div className="tile__head">
          <h2 className="tile__title">Marcar asistencia</h2>
          <Link className="link-btn" to="/app/asistencia">Historial</Link>
        </div>
        <TodayCheckIn />
        <p className="hint">{child ? `Marca la asistencia de ${firstName}` : 'Marca tu asistencia'} desde 1 hora antes de que empiece la clase (o hasta {PAST_DAYS} días después si se te pasó).</p>
      </section>

      {incomplete.data && !child && (
        <Link className="tile tile--wide tile--link tile--alert rise" to="/app/ajustes#ficha">
          <h2 className="tile__title">Completa tu ficha</h2>
          <p className="hint">Teléfono, fecha de nacimiento y contacto de emergencia para tu escuela.</p>
        </Link>
      )}


      <section className="tile tile--wide rise" style={{ animationDelay: '120ms' }} aria-label="Skills">
        {p ? <SkillsBreakdown skills={p.skills} own emptyText="Tus skills aparecen cuando asistas a clases con skills (por ejemplo Gi, NoGi o Guardia)." /> : <p className="hint">Cargando…</p>}
      </section>

      <section className="tile tile--wide rise" style={{ animationDelay: '130ms' }} aria-label="Cinturones">
        <h2 className="tile__title">{child ? 'Sus cinturones' : 'Mis cinturones'}</h2>
        {studentId && <MisCinturones studentId={studentId} child={child} />}
      </section>

      <section className="tile tile--wide rise" style={{ animationDelay: '140ms' }} aria-label="Logros" id="logros">
        {studentId && school && <MisLogros studentId={studentId} schoolId={school.id} child={child} />}
      </section>

      <section className="tile rise" style={{ animationDelay: '160ms' }}>
        <h2 className="tile__title">{child ? 'Su plan' : 'Mi plan'}</h2>
        {current ? (
          <>
            <p className="st-plan">{current.plan?.name}</p>
            <p className="hint">{current.ends_at ? `Vigente hasta el ${formatDate(current.ends_at)}` : 'Sin fecha de vencimiento'}</p>
          </>
        ) : <p className="hint">{child ? 'No tiene una inscripción activa.' : 'No tienes una inscripción activa.'}</p>}
      </section>

      <section className="tile tile--span2 rise" style={{ animationDelay: '200ms' }}>
        <div className="tile__head"><h2 className="tile__title">Pagos pendientes</h2><Link className="link-btn" to="/app/pagos">{child ? 'Sus pagos' : 'Mis pagos'}</Link></div>
        {(pay.data ?? []).length === 0 ? <p className="hint">Estás al día.</p> : (
          <ul className="mini-list">
            {pay.data!.map((x) => (
              <li key={x.id}>
                <span>{x.concept}</span><b>{formatCLP(x.amount)}</b>
                {subs.data?.get(x.id)?.status === 'pendiente'
                  ? <span className="tag tag--review">Por confirmar</span>
                  : <button type="button" className="link-btn" onClick={() => { setPaying(x.id); setPayOpen(true) }}>Pagar</button>}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="tile tile--wide tile--history rise" style={{ animationDelay: '240ms' }}>
        <div className="tile__head"><h2 className="tile__title">Últimas clases</h2><Link className="link-btn" to="/app/asistencia">Ver todas</Link></div>
        <AttendanceHistory rows={(att.data ?? []).slice(0, 3)} child={child} />
      </section>
      <PayDialog paymentId={paying} open={payOpen} onClose={() => setPayOpen(false)} />
    </div>
  )
}

/** "Todas mis escuelas": level, XP and skills added up, and each school's belts and achievements. */
function AllSchoolsHome({ setAll }: { setAll: (v: boolean) => void }) {
  const { profile } = useAuth()
  const { studentLinks, schools, myStudent } = useSchool()
  const progress = useQueries({ queries: studentLinks.map((l) => ({ queryKey: progressKey(l.id), queryFn: () => studentProgress(l.id) })) })
  const atts = useQueries({ queries: studentLinks.map((l) => ({ queryKey: myAttendanceKey(l.id), queryFn: () => myAttendance(l.id) })) })
  const schoolName = (id: string) => schools.find((s) => s.id === id)?.name ?? 'Escuela'
  const ready = progress.length > 0 && progress.every((q) => q.isSuccess)
  const p = ready ? mergeProgress(progress.map((q) => q.data!)) : null
  const pct = p ? Math.round((p.level_xp / p.next_level_xp) * 100) : 0
  const recent = studentLinks
    .flatMap((l, i) => (atts[i]?.data ?? []).map((a) => ({ ...a, school: schoolName(l.school_id) })))
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 5)
  const firstName = (profile?.full_name || myStudent?.full_name || '').split(' ')[0]

  return (
    <div className="bento bento--student">
      <header className="st-hero rise">
        <Avatar path={myStudent?.avatar_url} name={profile?.full_name || myStudent?.full_name} size={64} className="st-hero__photo" />
        <div className="st-hero__text">
          <SchoolLine all setAll={setAll} />
          <h1>Hola{firstName ? `, ${firstName}` : ''}</h1>
        </div>
      </header>

      <section className="tile level-card rise" aria-label="Tu nivel en todas tus escuelas">
        <div className="lvl"><span>Nivel</span><strong>{p?.level ?? '—'}</strong></div>
        <div className="xp">
          <div className="xp__bar" role="progressbar" aria-valuemin={0} aria-valuemax={p?.next_level_xp ?? 100} aria-valuenow={p?.level_xp ?? 0} aria-label="Experiencia para el siguiente nivel">
            <span style={{ width: `${pct}%` }} />
          </div>
          <p className="xp__text">{p ? <><b>{p.level_xp}</b> / {p.next_level_xp} XP</> : 'Cargando…'}</p>
        </div>
      </section>

      <section className="tile tile--wide rise" aria-label="Tus escuelas">
        <h2 className="tile__title">Tus {studentLinks.length} escuelas, juntas</h2>
        <p className="hint">Aquí se suman tu experiencia, tus skills y tus clases. Para marcar asistencia, ver tu plan o pagar, elige una escuela arriba.</p>
      </section>

      <section className="tile tile--wide rise" aria-label="Skills">
        {p ? <SkillsBreakdown skills={p.skills} own emptyText="Tus skills aparecen cuando asistas a clases con skills (por ejemplo Gi, NoGi o Guardia)." /> : <p className="hint">Cargando…</p>}
      </section>

      <section className="tile tile--wide rise" aria-label="Cinturones">
        <h2 className="tile__title">Mis cinturones</h2>
        {studentLinks.map((l) => (
          <div key={l.id} className="st-school">
            <h3 className="st-school__name">{schoolName(l.school_id)}</h3>
            <MisCinturones studentId={l.id} child={false} />
          </div>
        ))}
      </section>

      {studentLinks.map((l) => (
        <section key={l.id} className="tile tile--wide rise" aria-label={`Logros en ${schoolName(l.school_id)}`}>
          <p className="st-school__name">{schoolName(l.school_id)}</p>
          <MisLogros studentId={l.id} schoolId={l.school_id} child={false} />
        </section>
      ))}

      <section className="tile tile--wide tile--history rise">
        <div className="tile__head"><h2 className="tile__title">Últimas clases</h2></div>
        {recent.length === 0 ? <p className="hint">Todavía no tienes asistencias registradas.</p> : (
          <ul className="today-list">
            {recent.map((a) => (
              <li key={a.id} style={{ ['--class-color' as string]: a.class?.color }}>
                <span className="today-list__time">{formatDate(a.date).slice(0, 5)}</span>
                <span className="today-list__name"><strong>{a.class?.name ?? 'Clase'}</strong><span className="hint">{a.school}</span></span>
                {a.confirmed_at ? <span className="tag tag--ok">+{XP_PER_CLASS} XP</span> : <span className="tag tag--wait">Por aprobar</span>}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}

/** No class today: show the next one, so the student knows when they can mark their attendance. */
function NextClass({ classes, today }: { classes: ClassFull[]; today: string }) {
  const next = useMemo(() => {
    for (let i = 1; i <= 7; i++) {
      const d = addDays(today, i)
      const wd = isoWeekday(d)
      const hit = classes.filter((c) => c.active)
        .flatMap((c) => c.schedules.filter((x) => x.weekday === wd).map((x) => ({ c, x })))
        .sort((a, b) => a.x.start_time.localeCompare(b.x.start_time))[0]
      if (hit) return { ...hit, date: d }
    }
    return null
  }, [classes, today])
  if (!next) return <p className="hint">Tu escuela aún no tiene clases con horario.</p>
  return (
    <div className="checkin-next">
      <p className="hint">Hoy no hay clases. La próxima:</p>
      <ul className="checkin-list">
        <li style={{ ['--class-color' as string]: next.c.color }}>
          <span className="today-list__time">{hhmm(next.x.start_time)}</span>
          <span className="today-list__name"><strong>{next.c.name}</strong><span className="hint">{longDate(next.date)}{next.c.room ? ` · ${next.c.room}` : ''}</span></span>
          <span className="tag">Desde las {opensAt(next.x.start_time)}</span>
        </li>
      </ul>
    </div>
  )
}

/** Asistencia for students: today's check-in and full history. */
export function StudentAttendance() {
  const { studentId, child, name } = useMe()
  const att = useQuery({ queryKey: myAttendanceKey(studentId), queryFn: () => myAttendance(studentId!), enabled: Boolean(studentId) })
  const first = name.split(' ')[0]
  const histMore = useShowMore('portal.historial')
  return (
    <div className="asistencia portal-att">
      <header className="page-head">
        <h1>{child ? `Asistencia de ${first}` : 'Mi asistencia'}</h1>
        <p className="hint">{child ? `Marca la asistencia de ${first}` : 'Marca tu asistencia'} desde 1 hora antes de que empiece la clase (o hasta {PAST_DAYS} días después si se te pasó).</p>
      </header>
      <section className="card form-section checkin-card" aria-labelledby="mark-h">
        <h2 id="mark-h">Marcar asistencia</h2>
        <TodayCheckIn />
      </section>
      <section className="card form-section" aria-labelledby="hist-h">
        <h2 id="hist-h">Historial</h2>
        <AttendanceHistory rows={(att.data ?? []).slice(0, histMore.shown)} child={child} />
        <ShowMore shown={histMore.shown} total={(att.data ?? []).length} onMore={histMore.more} />
      </section>
    </div>
  )
}
