import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { useSchool } from '../../lib/school'
import { useAuth } from '../../lib/auth'
import { addDays, longDate, todayIso } from '../../lib/dates'
import { hhmm, isoWeekday } from '../../lib/weekdays'
import { Icon } from '../../ui/Icon'
import { Toggle } from '../../ui/Toggle'
import { listStudents, studentsKey } from '../alumnos/api'
import { classesKey, listClasses } from '../clases/api'
import { enrollmentsKey, listEnrollments, phaseOf } from '../matriculas/api'
import { StudentAttendance } from '../portal/StudentPortal'
import './asistencia.css'

const normalize = (s: string) => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()

type Mark = { student_id: string; confirmed: boolean }
async function listAttendance(classId: string, date: string): Promise<Mark[]> {
  const { data, error } = await supabase.from('attendance').select('student_id, confirmed_at').eq('class_id', classId).eq('date', date)
  if (error) throw error
  return data.map((r) => ({ student_id: r.student_id, confirmed: Boolean(r.confirmed_at) }))
}

// The teacher record linked to the signed-in staff member, if any (to preselect their class).
async function myTeacherId(schoolId: string, userId: string): Promise<string | null> {
  const { data } = await supabase.from('teachers').select('id').eq('school_id', schoolId).eq('user_id', userId).maybeSingle()
  return data?.id ?? null
}

const nowHHMM = () => new Intl.DateTimeFormat('en-GB', { timeZone: 'America/Santiago', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date())

export function AsistenciaPage() {
  const { role } = useSchool()
  return role === 'alumno' ? <StudentAttendance /> : <StaffAttendance />
}

function StaffAttendance() {
  const { activeSchool } = useSchool()
  const { user } = useAuth()
  const schoolId = activeSchool?.id
  const qc = useQueryClient()
  const [params, setParams] = useSearchParams()
  const date = params.get('fecha') ?? todayIso()
  const pickedClass = params.get('clase') ?? ''
  const teacher = useQuery({ queryKey: ['my-teacher', schoolId, user?.id], queryFn: () => myTeacherId(schoolId!, user!.id), enabled: Boolean(schoolId && user) })
  const setParam = (k: string, v: string) => {
    const p = new URLSearchParams(params)
    if (v) p.set(k, v)
    else p.delete(k)
    setParams(p, { replace: true })
  }

  const classes = useQuery({ queryKey: classesKey(schoolId), queryFn: () => listClasses(schoolId!), enabled: Boolean(schoolId) })
  const students = useQuery({ queryKey: studentsKey(schoolId), queryFn: () => listStudents(schoolId!), enabled: Boolean(schoolId) })
  const enrollments = useQuery({ queryKey: enrollmentsKey(schoolId), queryFn: () => listEnrollments(schoolId!), enabled: Boolean(schoolId) })
  const [search, setSearch] = useState('')
  const [showAll, setShowAll] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const wd = isoWeekday(date)
  const activeClasses = useMemo(() => (classes.data ?? []).filter((c) => c.active), [classes.data])
  const todays = useMemo(
    () => activeClasses
      .flatMap((c) => c.schedules.filter((s) => s.weekday === wd).map((s) => ({ c, s })))
      .sort((a, b) => a.s.start_time.localeCompare(b.s.start_time)),
    [activeClasses, wd],
  )

  // No class picked: today, open the class in progress (or the next one), preferring the signed-in teacher's own.
  const autoClass = useMemo(() => {
    if (date !== todayIso() || todays.length === 0) return ''
    const own = teacher.data ? todays.filter((t) => t.c.teacher_id === teacher.data) : []
    const pool = own.length ? own : todays
    const now = nowHHMM()
    return (pool.find((t) => hhmm(t.s.end_time) >= now) ?? pool[pool.length - 1]).c.id
  }, [date, todays, teacher.data])
  const classId = pickedClass || autoClass

  const attKey = ['attendance', classId, date]
  const present = useQuery({ queryKey: attKey, queryFn: () => listAttendance(classId, date), enabled: Boolean(classId) })
  const cls = activeClasses.find((c) => c.id === classId) ?? (classes.data ?? []).find((c) => c.id === classId)

  // Students with a current enrollment come first; the rest are one tap away.
  const enrolledIds = useMemo(() => new Set((enrollments.data ?? []).filter((e) => ['activa', 'por_vencer'].includes(phaseOf(e))).map((e) => e.student_id)), [enrollments.data])
  const marks = useMemo(() => new Map((present.data ?? []).map((m) => [m.student_id, m])), [present.data])
  const presentSet = useMemo(() => new Set(marks.keys()), [marks])
  const pendingIds = useMemo(() => (present.data ?? []).filter((m) => !m.confirmed).map((m) => m.student_id), [present.data])
  const roster = useMemo(() => {
    const needle = normalize(search.trim())
    return (students.data ?? [])
      .filter((s) => s.active || presentSet.has(s.id))
      .filter((s) => showAll || needle || enrolledIds.has(s.id) || presentSet.has(s.id))
      .filter((s) => !needle || normalize(s.full_name ?? '').includes(needle))
  }, [students.data, enrolledIds, presentSet, search, showAll])

  // Tap cycle: absent → present (confirmed) → absent. A student's own check-in shows as "por confirmar";
  // tapping it confirms it (that's what gives the student XP).
  type Action = 'mark' | 'confirm' | 'unmark'
  const toggle = useMutation({
    mutationFn: async ({ studentIds, action }: { studentIds: string[]; action: Action }) => {
      const base = () => supabase.from('attendance')
      const q = action === 'mark'
        ? base().insert(studentIds.map((student_id) => ({ school_id: schoolId!, class_id: classId, student_id, date })))
        : action === 'confirm'
          ? base().update({ confirmed_at: new Date().toISOString() }).eq('class_id', classId).eq('date', date).in('student_id', studentIds)
          : base().delete().eq('class_id', classId).eq('date', date).in('student_id', studentIds)
      const { error } = await q
      if (error && !error.message.includes('duplicate key')) throw error
    },
    // Optimistic: flip immediately, roll back on error.
    onMutate: async ({ studentIds, action }) => {
      setError(null)
      await qc.cancelQueries({ queryKey: attKey })
      const prev = qc.getQueryData<Mark[]>(attKey) ?? []
      const ids = new Set(studentIds)
      const next = action === 'unmark'
        ? prev.filter((m) => !ids.has(m.student_id))
        : action === 'confirm'
          ? prev.map((m) => (ids.has(m.student_id) ? { ...m, confirmed: true } : m))
          : [...prev, ...studentIds.map((student_id) => ({ student_id, confirmed: true }))]
      qc.setQueryData<Mark[]>(attKey, next)
      return { prev }
    },
    onError: (_e, _v, ctx) => {
      if (ctx) qc.setQueryData(attKey, ctx.prev)
      setError('No se pudo guardar la asistencia. Revisa tu conexión e intenta de nuevo.')
    },
    onSettled: () => qc.invalidateQueries({ queryKey: attKey }),
  })

  if (!activeSchool) return <p className="page-note">Selecciona una escuela.</p>
  const count = presentSet.size
  const over = cls?.capacity ? count > cls.capacity : false

  return (
    <div className="asistencia">
      <header className="page-head">
        <span className="eyebrow">{activeSchool.name}</span>
        <h1>Asistencia</h1>
      </header>

      <div className="cal-bar">
        <div className="cal-nav">
          <button type="button" className="icon-btn" onClick={() => setParam('fecha', addDays(date, -1))} aria-label="Día anterior"><Icon name="back" size={16} /></button>
          <input className="input att-date" type="date" value={date} max={addDays(todayIso(), 1)} onChange={(e) => e.target.value && setParam('fecha', e.target.value)} aria-label="Fecha" />
          <button type="button" className="icon-btn cal-next" onClick={() => setParam('fecha', addDays(date, 1))} aria-label="Día siguiente" disabled={date >= todayIso()}><Icon name="back" size={16} /></button>
          {date !== todayIso() && <button type="button" className="btn btn--ghost cal-today" onClick={() => setParam('fecha', todayIso())}>Hoy</button>}
        </div>
        <p className="hint">{longDate(date)}</p>
      </div>

      <section className="att-classes" aria-label="Clases del día">
        {classes.isSuccess && todays.length === 0 && <p className="hint">No hay clases programadas este día.</p>}
        {todays.map(({ c, s }) => (
          <button key={s.id} type="button" className="att-class" aria-pressed={classId === c.id} onClick={() => setParam('clase', c.id)} style={{ ['--class-color' as string]: c.color }}>
            <strong>{c.name}</strong>
            <span>{hhmm(s.start_time)}–{hhmm(s.end_time)}</span>
          </button>
        ))}
        {activeClasses.length > 0 && (
          <select className="input att-other" aria-label="Otra clase" value={todays.some((t) => t.c.id === classId) ? '' : classId} onChange={(e) => setParam('clase', e.target.value)}>
            <option value="">Otra clase…</option>
            {activeClasses.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        )}
        {classes.isSuccess && activeClasses.length === 0 && <p className="hint">Aún no hay clases. <Link to="/app/clases">Créalas en Clases</Link>.</p>}
      </section>

      {cls && (
        <section className="card att-roster">
          <div className="att-roster__head">
            <div>
              <h2>{cls.name}</h2>
              <p className="hint">{cls.teacher?.full_name ?? 'Sin profesor'}{cls.room ? ` · ${cls.room}` : ''}</p>
            </div>
            <p className={`att-count${over ? ' is-over' : ''}`} aria-live="polite">
              <b>{count}</b> {count === 1 ? 'presente' : 'presentes'}{cls.capacity ? ` / ${cls.capacity}` : ''}
            </p>
          </div>
          <div className="toolbar">
            <label className="search">
              <Icon name="search" size={16} />
              <span className="sr-only">Buscar alumno</span>
              <input className="input" type="search" placeholder="Buscar alumno" value={search} onChange={(e) => setSearch(e.target.value)} />
            </label>
            <Toggle inline checked={showAll} onChange={setShowAll} label="Todos los alumnos" />
          </div>
          {error && <p className="alert" role="alert">{error}</p>}
          {over && <p className="alert">Se superó el cupo de la clase.</p>}
          {pendingIds.length > 0 && (
            <div className="att-pending">
              <span>{pendingIds.length === 1 ? '1 alumno se marcó solo' : `${pendingIds.length} alumnos se marcaron solos`}. Confirma que vinieron.</span>
              <button type="button" className="btn" onClick={() => toggle.mutate({ studentIds: pendingIds, action: 'confirm' })}>Confirmar {pendingIds.length > 1 ? 'todos' : ''}</button>
            </div>
          )}
          {roster.length === 0 && (
            <p className="hint">
              {enrolledIds.size === 0 && !showAll ? 'No hay alumnos con inscripción vigente. Activa "Todos los alumnos" para marcar a cualquiera.' : 'Sin resultados.'}
            </p>
          )}
          <ul className="att-list">
            {roster.map((s) => {
              const m = marks.get(s.id)
              const pending = Boolean(m && !m.confirmed)
              const action: Action = !m ? 'mark' : pending ? 'confirm' : 'unmark'
              return (
                <li key={s.id}>
                  <button type="button" className={`att-student${pending ? ' is-pending' : ''}`} aria-pressed={Boolean(m)} onClick={() => toggle.mutate({ studentIds: [s.id], action })}>
                    <span className="att-check" aria-hidden="true">{m && <Icon name="check" size={16} />}</span>
                    <span className="att-student__name">{s.full_name}</span>
                    {pending && <span className="tag tag--wait">Se marcó · toca para confirmar</span>}
                    {!enrolledIds.has(s.id) && <span className="tag">Sin inscripción</span>}
                  </button>
                </li>
              )
            })}
          </ul>
        </section>
      )}
      {!cls && todays.length > 0 && <p className="hint">Elige una clase para tomar asistencia.</p>}
    </div>
  )
}
