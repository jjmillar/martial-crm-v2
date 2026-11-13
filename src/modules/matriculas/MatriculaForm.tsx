import { useMemo, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from '../../lib/nav'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useSchool } from '../../lib/school'
import { addDays, formatDate, todayIso } from '../../lib/dates'
import { formatCLP, parseCLP } from '../../lib/money'
import type { EnrollmentStatus, Plan } from '../../lib/database.types'
import { Icon } from '../../ui/Icon'
import { listStudents, studentsKey } from '../alumnos/api'
import { listPlans, plansKey } from '../planes/api'
import { cycleInfo } from '../planes/cycles'
import {
  createEnrollment, deleteEnrollment, enrollmentsKey, getEnrollment, phaseLabel, phaseOf, updateEnrollment,
  type EnrollmentRow,
} from './api'

const normalize = (s: string) => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()
const endsFor = (plan: Plan | undefined, start: string) => (plan?.duration_days ? addDays(start, plan.duration_days) : '')

/** /matriculas/nueva (optionally ?alumno=<id>) and /matriculas/:id */
export function MatriculaEditor() {
  const { id } = useParams()
  const isNew = !id || id === 'nueva'
  const q = useQuery({ queryKey: ['enrollment', id], queryFn: () => getEnrollment(id!), enabled: !isNew })
  if (isNew) return <NuevaMatricula />
  if (q.isLoading) return <p className="hint">Cargando…</p>
  if (!q.data) return <p className="alert">No encontramos esa inscripción. <Link to="..">Volver</Link></p>
  return <MatriculaDetalle key={q.data.id} e={q.data} />
}

function NuevaMatricula() {
  const { activeSchool } = useSchool()
  const schoolId = activeSchool?.id
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [params] = useSearchParams()
  const students = useQuery({ queryKey: studentsKey(schoolId), queryFn: () => listStudents(schoolId!), enabled: Boolean(schoolId) })
  const plans = useQuery({ queryKey: plansKey(schoolId), queryFn: () => listPlans(schoolId!), enabled: Boolean(schoolId) })
  const activePlans = useMemo(() => (plans.data ?? []).filter((p) => p.active), [plans.data])

  const [studentId, setStudentId] = useState(params.get('alumno') ?? '')
  const [studentSearch, setStudentSearch] = useState('')
  const [planId, setPlanId] = useState('')
  const [start, setStart] = useState(todayIso())
  const [ends, setEnds] = useState('')
  const [price, setPrice] = useState('')
  const [notes, setNotes] = useState('')
  const [error, setError] = useState<string | null>(null)

  // Preselect the default plan once plans load.
  const plan = activePlans.find((p) => p.id === planId)
  if (!planId && activePlans.length) {
    const def = activePlans.find((p) => p.is_default) ?? activePlans[0]
    setPlanId(def.id)
    setPrice(formatCLP(def.price))
    setEnds(endsFor(def, start))
  }

  function pickPlan(id: string) {
    const p = activePlans.find((x) => x.id === id)
    setPlanId(id)
    if (p) {
      setPrice(formatCLP(p.price))
      setEnds(endsFor(p, start))
    }
  }
  function pickStart(v: string) {
    setStart(v)
    if (v && plan) setEnds(endsFor(plan, v))
  }

  const studentOptions = useMemo(() => {
    const needle = normalize(studentSearch.trim())
    return (students.data ?? []).filter((s) => s.active && (!needle || normalize(s.full_name ?? '').includes(needle) || (s.rut ?? '').includes(studentSearch.replace(/\D/g, '') || '§')))
  }, [students.data, studentSearch])

  const save = useMutation({
    mutationFn: () => {
      const p = parseCLP(price)
      if (!studentId) throw new Error('Elige un alumno.')
      if (!planId) throw new Error('Elige un plan.')
      if (p === null || Number.isNaN(p)) throw new Error('Precio inválido: usa pesos enteros, ej: 35.000.')
      if (ends && ends < start) throw new Error('El vencimiento no puede ser anterior al inicio.')
      return createEnrollment(schoolId!, { student_id: studentId, plan_id: planId, start_date: start, ends_at: ends || null, price: p, enrollment_fee: 0, notes: notes.trim() || null })
    },
    onSuccess: (e) => {
      qc.invalidateQueries({ queryKey: enrollmentsKey(schoolId) })
      qc.invalidateQueries({ queryKey: ['student-enrollments', e.student_id] })
      navigate('..', { replace: true, state: { flash: 'Inscripción creada.' } })
    },
    onError: (e: Error) => setError(e.message),
  })

  function onSubmit(ev: FormEvent) {
    ev.preventDefault()
    setError(null)
    save.mutate()
  }

  if (!activeSchool) return <p className="page-note">Selecciona una escuela.</p>
  const noPlans = plans.isSuccess && activePlans.length === 0
  const noStudents = students.isSuccess && (students.data ?? []).filter((s) => s.active).length === 0

  return (
    <form className="alumno-form" onSubmit={onSubmit} noValidate>
      <header className="page-head">
        <Link className="link-btn back-link" to=".."><Icon name="back" size={16} /> Inscripciones</Link>
        <h1>Nueva inscripción</h1>
      </header>

      {noPlans && <p className="alert">No hay planes activos. <Link to="/app/planes">Crea un plan</Link> primero.</p>}
      {noStudents && <p className="alert">No hay alumnos activos. <Link to="/app/alumnos/nuevo">Crea un alumno</Link> primero.</p>}

      <section className="card form-section">
        <h2>Alumno</h2>
        <div className="form-grid">
          <div className="field">
            <label htmlFor="m-search">Buscar</label>
            <input id="m-search" className="input" type="search" placeholder="Nombre o RUT" value={studentSearch} onChange={(e) => setStudentSearch(e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="m-student">Alumno *</label>
            <select id="m-student" className="input" value={studentId} onChange={(e) => { setStudentId(e.target.value); setError(null) }}>
              <option value="">Elige un alumno ({studentOptions.length})</option>
              {studentOptions.map((s) => <option key={s.id} value={s.id}>{s.full_name}</option>)}
              {/* keep a preselected student visible even if the search hides it */}
              {studentId && !studentOptions.some((s) => s.id === studentId) && (
                <option value={studentId}>{students.data?.find((s) => s.id === studentId)?.full_name ?? 'Alumno seleccionado'}</option>
              )}
            </select>
          </div>
        </div>
      </section>

      <section className="card form-section">
        <h2>Plan y vigencia</h2>
        <div className="form-grid">
          <div className="field">
            <label htmlFor="m-plan">Plan *</label>
            <select id="m-plan" className="input" value={planId} onChange={(e) => { pickPlan(e.target.value); setError(null) }}>
              {activePlans.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} — {p.price === 0 ? 'Gratis' : `${formatCLP(p.price)} ${cycleInfo(p.billing_cycle).per}`}{p.is_default ? ' ★' : ''}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="m-start">Inicio *</label>
            <input id="m-start" className="input" type="date" value={start} onChange={(e) => pickStart(e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="m-ends">Vencimiento</label>
            <input id="m-ends" className="input" type="date" value={ends} min={start} onChange={(e) => setEnds(e.target.value)} />
            <span className="hint">{plan?.duration_days ? `Calculado con la vigencia del plan (${plan.duration_days} días).` : 'Vacío = sin vencimiento.'}</span>
          </div>
        </div>
      </section>

      <section className="card form-section">
        <h2>Precio acordado</h2>
        <p className="hint">Se copia del plan y queda fijo en esta inscripción. Cámbialo si aplicas un descuento.</p>
        <div className="form-grid">
          <div className="field">
            <label htmlFor="m-price">Precio (CLP) *</label>
            <input id="m-price" className="input" inputMode="numeric" value={price} onChange={(e) => setPrice(e.target.value)} onBlur={() => { const n = parseCLP(price); if (n !== null && !Number.isNaN(n)) setPrice(formatCLP(n)) }} />
          </div>
          <div className="field field--wide">
            <label htmlFor="m-notes">Notas</label>
            <textarea id="m-notes" className="input" rows={2} maxLength={400} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Ej: descuento hermanos 10%" />
          </div>
        </div>
      </section>

      {error && <p className="alert" role="alert">{error}</p>}
      <div className="form-actions">
        <button className="btn" type="submit" disabled={save.isPending || noPlans || noStudents}>{save.isPending ? 'Guardando…' : 'Matricular'}</button>
        <Link className="btn btn--ghost" to="..">Cancelar</Link>
      </div>
    </form>
  )
}

function MatriculaDetalle({ e }: { e: EnrollmentRow }) {
  const { activeSchool, role } = useSchool()
  const schoolId = activeSchool?.id
  const isAdmin = role === 'admin' || role === 'ceo'
  const qc = useQueryClient()
  const navigate = useNavigate()
  const phase = phaseOf(e)
  const [ends, setEnds] = useState(e.ends_at ?? '')
  const [notes, setNotes] = useState(e.notes ?? '')
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [confirm, setConfirm] = useState<'cancelar' | 'eliminar' | null>(null)

  const refresh = async () => {
    await qc.invalidateQueries({ queryKey: enrollmentsKey(schoolId) })
    await qc.invalidateQueries({ queryKey: ['enrollment', e.id] })
    await qc.invalidateQueries({ queryKey: ['student-enrollments', e.student_id] })
  }

  const patch = useMutation({
    mutationFn: (p: { status?: EnrollmentStatus; ends_at?: string | null; notes?: string | null; label: string }) => {
      const { label, ...rest } = p
      void label
      return updateEnrollment(e.id, rest)
    },
    onSuccess: async (_d, p) => {
      setConfirm(null)
      setMsg({ ok: true, text: p.label })
      await refresh()
    },
    onError: (err: Error) => setMsg({ ok: false, text: err.message }),
  })

  const remove = useMutation({
    mutationFn: () => deleteEnrollment(e.id),
    onSuccess: async () => {
      await refresh()
      navigate('..', { replace: true })
    },
    onError: (err: Error) => setMsg({ ok: false, text: err.message }),
  })

  // Renewal extends from the current end (or today if it already expired) by the plan's duration.
  const duration = e.plan?.duration_days ?? null
  const renewFrom = e.ends_at && e.ends_at >= todayIso() ? e.ends_at : todayIso()
  const renewTo = duration ? addDays(renewFrom, duration) : null

  return (
    <div className="alumno-form">
      <header className="page-head">
        <Link className="link-btn back-link" to=".."><Icon name="back" size={16} /> Inscripciones</Link>
        <h1>{e.student?.full_name ?? 'Inscripción'}</h1>
        <p className="hint">
          <span className={`tag tag--phase-${phase}`}>{phaseLabel[phase]}</span> {e.plan?.name} · {formatCLP(e.price)} · desde {formatDate(e.start_date)}{e.ends_at ? ` hasta ${formatDate(e.ends_at)}` : ''}
        </p>
      </header>

      <section className="card form-section">
        <h2>Acciones</h2>
        <div className="form-actions">
          {e.status === 'activa' && renewTo && (
            <button type="button" className="btn" disabled={patch.isPending} onClick={() => patch.mutate({ ends_at: renewTo, label: `Renovada hasta el ${formatDate(renewTo)}.` })}>
              Renovar hasta {formatDate(renewTo)}
            </button>
          )}
          {e.status === 'activa' && (
            <button type="button" className="btn btn--ghost" disabled={patch.isPending} onClick={() => patch.mutate({ status: 'pausada', label: 'Inscripción pausada.' })}>Pausar</button>
          )}
          {e.status !== 'activa' && (
            <button type="button" className="btn" disabled={patch.isPending} onClick={() => patch.mutate({ status: 'activa', label: 'Inscripción reactivada.' })}>Reactivar</button>
          )}
          {e.status !== 'cancelada' && (confirm === 'cancelar' ? (
            <>
              <span className="hint">¿Cancelar la inscripción?</span>
              <button type="button" className="btn btn--danger" onClick={() => patch.mutate({ status: 'cancelada', label: 'Inscripción cancelada.' })}>Sí, cancelar</button>
              <button type="button" className="btn btn--ghost" onClick={() => setConfirm(null)}>No</button>
            </>
          ) : (
            <button type="button" className="btn btn--ghost" onClick={() => setConfirm('cancelar')}>Cancelar inscripción</button>
          ))}
        </div>
        <p className="hint">Pausar conserva la inscripción sin contarla como vigente. Para registrar el pago, ve a Pagos.</p>
      </section>

      <section className="card form-section">
        <h2>Detalle</h2>
        <div className="form-grid">
          <div className="field">
            <label htmlFor="d-ends">Vencimiento</label>
            <input id="d-ends" className="input" type="date" value={ends} min={e.start_date} onChange={(ev) => setEnds(ev.target.value)} />
          </div>
          <div className="field field--wide">
            <label htmlFor="d-notes">Notas</label>
            <textarea id="d-notes" className="input" rows={2} maxLength={400} value={notes} onChange={(ev) => setNotes(ev.target.value)} />
          </div>
        </div>
        <div className="form-actions">
          <button type="button" className="btn" disabled={patch.isPending} onClick={() => patch.mutate({ ends_at: ends || null, notes: notes.trim() || null, label: 'Cambios guardados.' })}>Guardar cambios</button>
          {e.student && <Link className="btn btn--ghost" to={`/app/alumnos/${e.student.id}`}>Ver alumno</Link>}
          {isAdmin && (
            <span className="form-actions__danger">
              {confirm === 'eliminar' ? (
                <>
                  <span className="hint">¿Eliminar definitivamente?</span>
                  <button type="button" className="btn btn--danger" onClick={() => remove.mutate()}>Eliminar</button>
                  <button type="button" className="btn btn--ghost" onClick={() => setConfirm(null)}>No</button>
                </>
              ) : (
                <button type="button" className="btn btn--ghost" onClick={() => setConfirm('eliminar')}><Icon name="trash" size={16} /> Eliminar</button>
              )}
            </span>
          )}
        </div>
      </section>

      {msg && <p className={`alert${msg.ok ? ' alert--ok' : ''}`} role={msg.ok ? 'status' : 'alert'}>{msg.text}</p>}
    </div>
  )
}
