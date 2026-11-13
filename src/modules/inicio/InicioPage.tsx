import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/auth'
import { useSchool } from '../../lib/school'
import { roleLabel } from '../../lib/roles'
import { daysUntil, formatDate, longDate, monthTitle, santiagoDate, startOfWeek, todayIso } from '../../lib/dates'
import { formatCLP } from '../../lib/money'
import { hhmm, isoWeekday } from '../../lib/weekdays'
import { listStudents, studentsKey } from '../alumnos/api'
import { classesKey, listClasses } from '../clases/api'
import { enrollmentsKey, listEnrollments, phaseOf } from '../matriculas/api'
import { listPayments, paymentsKey } from '../pagos/api'
import { StudentHome } from '../portal/StudentPortal'
import './inicio.css'

async function weekAttendance(schoolId: string, from: string): Promise<number> {
  const { count, error } = await supabase.from('attendance').select('id', { count: 'exact', head: true }).eq('school_id', schoolId).gte('date', from)
  if (error) throw error
  return count ?? 0
}

// Dashboard (S6, S8 bento). Money tiles only for admins/CEO. Students get their own portal home.
export function InicioPage() {
  const { role } = useSchool()
  return role === 'alumno' ? <StudentHome /> : <StaffHome />
}

function StaffHome() {
  const { profile } = useAuth()
  const { activeSchool, role, schools } = useSchool()
  const schoolId = activeSchool?.id
  const isAdmin = role === 'admin' || role === 'ceo'
  const firstName = profile?.full_name?.split(' ')[0]
  const today = todayIso()
  const weekStart = startOfWeek(today)
  const on = Boolean(schoolId)

  const students = useQuery({ queryKey: studentsKey(schoolId), queryFn: () => listStudents(schoolId!), enabled: on })
  const enrollments = useQuery({ queryKey: enrollmentsKey(schoolId), queryFn: () => listEnrollments(schoolId!), enabled: on })
  const classes = useQuery({ queryKey: classesKey(schoolId), queryFn: () => listClasses(schoolId!), enabled: on })
  const payments = useQuery({ queryKey: paymentsKey(schoolId), queryFn: () => listPayments(schoolId!), enabled: on && isAdmin })
  const attendance = useQuery({ queryKey: ['attendance-week', schoolId, weekStart], queryFn: () => weekAttendance(schoolId!, weekStart), enabled: on })

  const d = useMemo(() => {
    const st = students.data ?? []
    const en = (enrollments.data ?? []).map((e) => ({ ...e, phase: phaseOf(e) }))
    const wd = isoWeekday(today)
    const todays = (classes.data ?? [])
      .filter((c) => c.active)
      .flatMap((c) => c.schedules.filter((s) => s.weekday === wd).map((s) => ({ c, s })))
      .sort((a, b) => a.s.start_time.localeCompare(b.s.start_time))
    const pays = payments.data ?? []
    const month = today.slice(0, 7)
    const paidMonth = pays.filter((p) => p.status === 'pagado' && p.paid_at && santiagoDate(p.paid_at).slice(0, 7) === month)
    const pending = pays.filter((p) => p.status === 'pendiente')
    return {
      activeStudents: st.filter((s) => s.active).length,
      newThisMonth: st.filter((s) => s.enrollment_date.slice(0, 7) === month).length,
      current: en.filter((e) => e.phase === 'activa' || e.phase === 'por_vencer').length,
      expiring: en.filter((e) => e.phase === 'por_vencer').sort((a, b) => (a.ends_at ?? '').localeCompare(b.ends_at ?? '')),
      expired: en.filter((e) => e.phase === 'vencida').length,
      todays,
      collected: paidMonth.reduce((a, p) => a + p.amount, 0),
      pendingAmount: pending.reduce((a, p) => a + p.amount, 0),
      pendingCount: pending.length,
    }
  }, [students.data, enrollments.data, classes.data, payments.data, today])

  return (
    <div className="bento">
      <section className={`tile tile--hero rise${isAdmin ? '' : ' tile--full'}`}>
        <span className="eyebrow">{role ? roleLabel[role] : 'Sin rol'}</span>
        <h1>Hola{firstName ? `, ${firstName}` : ''}.</h1>
        <p className="tile__lead">
          {activeSchool ? <>{longDate(today)} · {activeSchool.name}</> : 'Todavía no tienes una escuela seleccionada.'}
        </p>
        {role === 'ceo' && <Link className="btn btn--ghost tile__cta" to="/app/escuelas">{schools.length} {schools.length === 1 ? 'escuela' : 'escuelas'} · Gestionar</Link>}
      </section>

      {activeSchool && (
        <>
          <Link className="tile tile--link rise" to="/app/alumnos" style={{ animationDelay: '40ms' }}>
            <span className="eyebrow">Alumnos activos</span>
            <p className="tile__big">{d.activeStudents}</p>
            <p className="hint">{d.newThisMonth ? `+${d.newThisMonth} inscritos este mes` : 'Sin inscripciones nuevas este mes'}</p>
          </Link>

          <Link className="tile tile--link rise" to="/app/matriculas" style={{ animationDelay: '80ms' }}>
            <span className="eyebrow">Inscripciones vigentes</span>
            <p className="tile__big">{d.current}</p>
            <p className="hint">{d.expired ? `${d.expired} vencidas por renovar` : 'Ninguna vencida'}</p>
          </Link>

          <Link className="tile tile--link rise" to="/app/asistencia" style={{ animationDelay: '120ms' }}>
            <span className="eyebrow">Asistencias esta semana</span>
            <p className="tile__big">{attendance.data ?? '—'}</p>
            <p className="hint">Desde el lunes {formatDate(weekStart)}</p>
          </Link>

          {isAdmin && (
            <Link className="tile tile--link rise" to="/app/pagos" style={{ animationDelay: '160ms' }}>
              <span className="eyebrow">Recaudado · {monthTitle(today)}</span>
              <p className="tile__big">{formatCLP(d.collected)}</p>
              <p className="hint">{d.pendingCount ? `${formatCLP(d.pendingAmount)} por confirmar (${d.pendingCount})` : 'Sin pagos por confirmar'}</p>
            </Link>
          )}

          <section className="tile tile--wide rise" style={{ animationDelay: '200ms' }}>
            <div className="tile__head">
              <span className="eyebrow">Clases de hoy</span>
              <Link className="link-btn" to="/app/calendario">Calendario</Link>
            </div>
            {d.todays.length === 0 ? (
              <p className="hint">{(classes.data ?? []).length ? 'Hoy no hay clases programadas.' : 'Crea tus clases y horarios para verlas aquí.'}</p>
            ) : (
              <ul className="today-list">
                {d.todays.map(({ c, s }) => (
                  <li key={s.id} style={{ ['--class-color' as string]: c.color }}>
                    <span className="today-list__time">{hhmm(s.start_time)}</span>
                    <span className="today-list__name"><strong>{c.name}</strong><span className="hint">{c.teacher?.full_name ?? 'Sin profesor'}</span></span>
                    <Link className="btn btn--ghost" to={`/app/asistencia?clase=${c.id}&fecha=${today}`}>Asistencia</Link>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="tile tile--wide rise" style={{ animationDelay: '240ms' }}>
            <div className="tile__head">
              <span className="eyebrow">Por vencer (7 días)</span>
              <Link className="link-btn" to="/app/matriculas">Inscripciones</Link>
            </div>
            {d.expiring.length === 0 ? (
              <p className="hint">Ninguna inscripción vence esta semana.</p>
            ) : (
              <ul className="today-list">
                {d.expiring.slice(0, 6).map((e) => {
                  const left = e.ends_at ? daysUntil(e.ends_at) : 0
                  return (
                    <li key={e.id}>
                      <span className="today-list__time">{left === 0 ? 'Hoy' : `${left} d`}</span>
                      <span className="today-list__name"><strong>{e.student?.full_name}</strong><span className="hint">{e.plan?.name} · vence {formatDate(e.ends_at)}</span></span>
                      <Link className="btn btn--ghost" to={`/app/matriculas/${e.id}`}>Renovar</Link>
                    </li>
                  )
                })}
              </ul>
            )}
          </section>
        </>
      )}
    </div>
  )
}
