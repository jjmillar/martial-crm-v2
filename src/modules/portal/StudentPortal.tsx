import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../../lib/auth'
import { useSchool } from '../../lib/school'
import { supabase } from '../../lib/supabase'
import { formatDate, longDate, todayIso } from '../../lib/dates'
import { formatCLP } from '../../lib/money'
import { hhmm, isoWeekday } from '../../lib/weekdays'
import { Icon } from '../../ui/Icon'
import { classesKey, listClasses } from '../clases/api'
import {
  checkIn, levelOf, myAttendance, myAttendanceKey, myEnrollments, myPendingPayments, progressKey, studentProgress, undoCheckIn,
  XP_PER_CLASS, XP_PER_LEVEL, type MyAttendance,
} from './api'
import '../inicio/inicio.css'
import './portal.css'

function useMe() {
  const { activeSchool, myStudent } = useSchool()
  return { schoolId: activeSchool?.id, school: activeSchool, studentId: myStudent?.id, name: myStudent?.full_name ?? '' }
}

/** Today's classes with a self check-in button (student). Staff confirm it from Asistencia. */
export function TodayCheckIn() {
  const { schoolId, studentId } = useMe()
  const qc = useQueryClient()
  const today = todayIso()
  const classes = useQuery({ queryKey: classesKey(schoolId), queryFn: () => listClasses(schoolId!), enabled: Boolean(schoolId) })
  const att = useQuery({ queryKey: myAttendanceKey(studentId), queryFn: () => myAttendance(studentId!), enabled: Boolean(studentId) })
  const [error, setError] = useState<string | null>(null)

  const wd = isoWeekday(today)
  const todays = useMemo(
    () => (classes.data ?? [])
      .filter((c) => c.active)
      .flatMap((c) => c.schedules.filter((s) => s.weekday === wd).map((s) => ({ c, s })))
      .sort((a, b) => a.s.start_time.localeCompare(b.s.start_time)),
    [classes.data, wd],
  )
  const mine = useMemo(() => new Map((att.data ?? []).filter((a) => a.date === today).map((a) => [a.class_id, a])), [att.data, today])

  const refresh = () => Promise.all([
    qc.invalidateQueries({ queryKey: myAttendanceKey(studentId) }),
    qc.invalidateQueries({ queryKey: progressKey(studentId) }),
  ])
  const mark = useMutation({ mutationFn: checkIn, onMutate: () => setError(null), onSuccess: refresh, onError: (e: Error) => setError(e.message) })
  const undo = useMutation({ mutationFn: undoCheckIn, onMutate: () => setError(null), onSuccess: refresh, onError: (e: Error) => setError(e.message) })

  if (classes.isSuccess && todays.length === 0) return <p className="hint">Hoy no tienes clases programadas.</p>
  return (
    <>
      {error && <p className="alert" role="alert">{error}</p>}
      <ul className="checkin-list">
        {todays.map(({ c, s }) => {
          const a = mine.get(c.id)
          return (
            <li key={s.id} style={{ ['--class-color' as string]: c.color }}>
              <span className="today-list__time">{hhmm(s.start_time)}</span>
              <span className="today-list__name"><strong>{c.name}</strong><span className="hint">{hhmm(s.start_time)}–{hhmm(s.end_time)}{c.room ? ` · ${c.room}` : ''}</span></span>
              {!a && (
                <button type="button" className="btn" disabled={mark.isPending} onClick={() => mark.mutate(c.id)}>
                  <Icon name="check" size={16} /> Marcar
                </button>
              )}
              {a && !a.confirmed_at && (
                <span className="checkin-state">
                  <span className="tag tag--wait">Por confirmar</span>
                  <button type="button" className="link-btn" disabled={undo.isPending} onClick={() => undo.mutate(c.id)}>Deshacer</button>
                </span>
              )}
              {a?.confirmed_at && <span className="tag tag--ok"><Icon name="check" size={14} /> +{XP_PER_CLASS} XP</span>}
            </li>
          )
        })}
      </ul>
    </>
  )
}

function AttendanceHistory({ rows }: { rows: MyAttendance[] }) {
  if (rows.length === 0) return <p className="hint">Todavía no tienes asistencias registradas.</p>
  return (
    <ul className="today-list">
      {rows.map((a) => (
        <li key={a.id} style={{ ['--class-color' as string]: a.class?.color }}>
          <span className="today-list__time">{formatDate(a.date).slice(0, 5)}</span>
          <span className="today-list__name"><strong>{a.class?.name ?? 'Clase'}</strong><span className="hint">{a.self_marked ? 'Marcada por ti' : 'Marcada por tu profesor'}</span></span>
          {a.confirmed_at ? <span className="tag tag--ok">+{XP_PER_CLASS} XP</span> : <span className="tag tag--wait">Por confirmar</span>}
        </li>
      ))}
    </ul>
  )
}

/** Inicio for students: level, XP, skills, today's check-in, plan and pending payments. */
export function StudentHome() {
  const { profile } = useAuth()
  const { school, studentId, name } = useMe()
  const today = todayIso()
  const progress = useQuery({ queryKey: progressKey(studentId), queryFn: () => studentProgress(studentId!), enabled: Boolean(studentId) })
  const att = useQuery({ queryKey: myAttendanceKey(studentId), queryFn: () => myAttendance(studentId!), enabled: Boolean(studentId) })
  const enr = useQuery({ queryKey: ['my-enrollments', studentId], queryFn: () => myEnrollments(studentId!), enabled: Boolean(studentId) })
  const pay = useQuery({ queryKey: ['my-payments', studentId], queryFn: () => myPendingPayments(studentId!), enabled: Boolean(studentId) })
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
  const firstName = (profile?.full_name || name).split(' ')[0]
  const pct = p ? Math.round((p.level_xp / p.next_level_xp) * 100) : 0
  const topSkill = p?.skills[0]?.xp ?? 0
  const current = (enr.data ?? []).find((e) => e.status === 'activa')

  return (
    <div className="bento">
      <section className="tile tile--hero rise">
        <span className="eyebrow">Alumno · {school?.name}</span>
        <h1>Hola{firstName ? `, ${firstName}` : ''}.</h1>
        <p className="tile__lead">{longDate(today)}</p>
      </section>

      {incomplete.data && (
        <Link className="tile tile--wide tile--link tile--alert rise" to="/app/ajustes#ficha">
          <span className="eyebrow">Tu ficha</span>
          <p className="tile__big tile__big--sm">Completa tus datos</p>
          <p className="hint">Teléfono, fecha de nacimiento y contacto de emergencia para tu escuela.</p>
        </Link>
      )}

      <section className="tile level-card rise" style={{ animationDelay: '40ms' }} aria-label="Tu nivel">
        <div className="level-badge" style={{ ['--pct' as string]: `${pct}%` }}>
          <span className="level-badge__inner">
            <span className="level-badge__label">Nivel</span>
            <strong>{p?.level ?? '—'}</strong>
          </span>
        </div>
        <div className="xp">
          <div className="xp__bar" role="progressbar" aria-valuemin={0} aria-valuemax={XP_PER_LEVEL} aria-valuenow={p?.level_xp ?? 0} aria-label="Experiencia para el siguiente nivel">
            <span style={{ width: `${pct}%` }} />
          </div>
          <p className="hint">
            {p ? <><b>{p.level_xp}</b> / {XP_PER_LEVEL} XP · faltan {XP_PER_LEVEL - p.level_xp} para el nivel {p.level + 1}</> : 'Cargando…'}
          </p>
          {p && <p className="hint">{p.xp} XP en total · {p.attended} {p.attended === 1 ? 'clase' : 'clases'}{p.pending ? ` · ${p.pending} por confirmar` : ''}</p>}
        </div>
      </section>

      <section className="tile tile--wide rise" style={{ animationDelay: '80ms' }}>
        <div className="tile__head">
          <span className="eyebrow">Hoy · marca tu asistencia</span>
          <Link className="link-btn" to="/app/asistencia">Historial</Link>
        </div>
        <TodayCheckIn />
        <p className="hint">Tu profesor confirma la asistencia; cada clase confirmada suma {XP_PER_CLASS} XP.</p>
      </section>

      <section className="tile tile--wide rise" style={{ animationDelay: '120ms' }} aria-label="Skills">
        <div className="tile__head"><span className="eyebrow">Skills</span></div>
        {p && p.skills.length === 0 && <p className="hint">Tus skills aparecen cuando asistas a clases con etiquetas (por ejemplo Guardia o Derribos).</p>}
        <ul className="skills">
          {p?.skills.map((s) => (
            <li key={s.tag_id}>
              <span className="skills__name">{s.icon ? `${s.icon} ` : ''}{s.label}</span>
              <span className="skills__lvl">Nv {levelOf(s.xp)}</span>
              <span className="skills__bar"><span style={{ width: `${topSkill ? Math.max(6, Math.round((s.xp / topSkill) * 100)) : 0}%` }} /></span>
              <span className="skills__xp">{s.xp} XP</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="tile rise" style={{ animationDelay: '160ms' }}>
        <span className="eyebrow">Mi plan</span>
        {current ? (
          <>
            <p className="tile__big tile__big--sm">{current.plan?.name}</p>
            <p className="hint">{current.ends_at ? `Vigente hasta el ${formatDate(current.ends_at)}` : 'Sin fecha de vencimiento'}</p>
          </>
        ) : <p className="hint">No tienes una inscripción activa.</p>}
      </section>

      <section className="tile rise" style={{ animationDelay: '200ms' }}>
        <span className="eyebrow">Pagos pendientes</span>
        {(pay.data ?? []).length === 0 ? <p className="hint">Estás al día.</p> : (
          <ul className="mini-list">
            {pay.data!.map((x) => <li key={x.id}><span>{x.concept}</span><b>{formatCLP(x.amount)}</b></li>)}
          </ul>
        )}
      </section>

      <section className="tile rise" style={{ animationDelay: '240ms' }}>
        <div className="tile__head"><span className="eyebrow">Últimas clases</span></div>
        <AttendanceHistory rows={(att.data ?? []).slice(0, 4)} />
      </section>
    </div>
  )
}

/** Asistencia for students: today's check-in and full history. */
export function StudentAttendance() {
  const { school, studentId } = useMe()
  const att = useQuery({ queryKey: myAttendanceKey(studentId), queryFn: () => myAttendance(studentId!), enabled: Boolean(studentId) })
  return (
    <div className="asistencia portal-att">
      <header className="page-head">
        <span className="eyebrow">{school?.name}</span>
        <h1>Mi asistencia</h1>
        <p className="hint">Marca las clases de hoy. Tu profesor la confirma y suma {XP_PER_CLASS} XP.</p>
      </header>
      <section className="card form-section">
        <h2>Hoy</h2>
        <TodayCheckIn />
      </section>
      <section className="card form-section">
        <h2>Historial</h2>
        <AttendanceHistory rows={att.data ?? []} />
      </section>
    </div>
  )
}
