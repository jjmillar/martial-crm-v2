import { useState, type FormEvent, type ReactNode } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useSchool } from '../../lib/school'
import { formatCLP, parseCLP } from '../../lib/money'
import type { Plan } from '../../lib/database.types'
import { Icon } from '../../ui/Icon'
import { listSpecialties, specialtiesKey } from '../profesores/api'
import { deletePlan, getPlan, plansKey, savePlan } from './api'
import { cycleInfo, cycles, planFeatures } from './cycles'
import { emptyPlan, formFromPlan, parsePlan, type PlanForm as Form } from './schema'

type Errors = Partial<Record<keyof Form, string>>

/** Route element for /planes/nuevo (optionally prefilled by "Duplicar") and /planes/:id. */
export function PlanEditor() {
  const { id } = useParams()
  const location = useLocation()
  const isNew = !id || id === 'nuevo'
  const plan = useQuery({ queryKey: ['plan', id], queryFn: () => getPlan(id!), enabled: !isNew })
  if (isNew) {
    const copy = (location.state as { copy?: Form } | null)?.copy
    return <PlanForm key={copy ? `copy-${location.key}` : 'new'} initial={copy} />
  }
  if (plan.isLoading) return <p className="hint">Cargando…</p>
  if (!plan.data) return <p className="alert">No encontramos ese plan. <Link to="..">Volver a planes</Link></p>
  return <PlanForm key={plan.data.id} plan={plan.data} />
}

function PlanForm({ plan, initial }: { plan?: Plan; initial?: Form }) {
  const { activeSchool, role } = useSchool()
  const schoolId = activeSchool?.id
  const canEdit = role === 'admin' || role === 'ceo'
  const navigate = useNavigate()
  const qc = useQueryClient()
  const specialties = useQuery({ queryKey: specialtiesKey(schoolId), queryFn: () => listSpecialties(schoolId!), enabled: Boolean(schoolId) })

  const [form, setForm] = useState<Form>(() => (plan ? formFromPlan(plan) : initial ?? emptyPlan))
  // Once someone edits the duration by hand, changing the cycle stops overwriting it.
  const [durationTouched, setDurationTouched] = useState(Boolean(plan))
  const [errors, setErrors] = useState<Errors>({})
  const [serverError, setServerError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const set = <K extends keyof Form>(k: K, v: Form[K]) => {
    setForm((f) => ({ ...f, [k]: v }))
    setSaved(false)
    if (errors[k]) setErrors((e) => ({ ...e, [k]: undefined }))
  }
  const setCycle = (c: Form['billing_cycle']) => {
    setForm((f) => ({ ...f, billing_cycle: c, duration_days: durationTouched ? f.duration_days : cycleInfo(c).days?.toString() ?? '' }))
    setSaved(false)
  }
  const setDefault = (v: boolean) => setForm((f) => ({ ...f, is_default: v, active: v ? true : f.active }))
  const moneyBlur = (k: 'price' | 'enrollment_fee') => () => {
    const n = parseCLP(form[k])
    if (n !== null && !Number.isNaN(n)) set(k, formatCLP(n))
  }

  const save = useMutation({
    mutationFn: (payload: Parameters<typeof savePlan>[2]) => savePlan(schoolId!, plan?.id ?? null, payload),
    onSuccess: async (p) => {
      // Saving a default unmarks another plan, so refresh the whole list.
      await qc.invalidateQueries({ queryKey: plansKey(schoolId) })
      qc.setQueryData(['plan', p.id], p)
      if (plan) {
        setSaved(true)
        setForm(formFromPlan(p))
      } else navigate('..', { replace: true, state: { flash: `Plan "${p.name}" creado.` } })
    },
    onError: (e: Error) => setServerError(e.message),
  })

  const remove = useMutation({
    mutationFn: () => deletePlan(plan!.id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: plansKey(schoolId) })
      navigate('..', { replace: true })
    },
    onError: (e: Error) => {
      setConfirmDelete(false)
      setServerError(e.message)
    },
  })

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    setServerError(null)
    const r = parsePlan(form)
    if (!r.ok) {
      setErrors(r.errors)
      document.getElementById(`p-${Object.keys(r.errors)[0]}`)?.focus()
      return
    }
    save.mutate(r.data)
  }

  function duplicate() {
    const copy: Form = { ...form, name: `${form.name} (copia)`.slice(0, 80), is_default: false }
    navigate('../nuevo', { state: { copy } })
  }

  if (!activeSchool) return <p className="page-note">Selecciona una escuela.</p>

  const field = (k: keyof Form, label: string, input: ReactNode, hint?: string, wide = false) => (
    <div className={`field${wide ? ' field--wide' : ''}`}>
      <label htmlFor={`p-${k}`}>{label}</label>
      {input}
      {errors[k] ? <span className="field__error" id={`pe-${k}`}>{errors[k]}</span> : hint && <span className="hint">{hint}</span>}
    </div>
  )
  const inputProps = (k: 'name' | 'price' | 'enrollment_fee' | 'duration_days' | 'sessions_per_week' | 'class_count' | 'description') => ({
    id: `p-${k}`,
    className: 'input',
    value: form[k],
    onChange: (e: { target: { value: string } }) => {
      if (k === 'duration_days') setDurationTouched(true)
      set(k, e.target.value)
    },
    'aria-invalid': errors[k] ? true : undefined,
    'aria-describedby': errors[k] ? `pe-${k}` : undefined,
  })

  // Live preview of the card while editing.
  const parsed = parsePlan(form)
  const preview = parsed.ok ? parsed.data : null

  return (
    <form className="alumno-form" onSubmit={onSubmit} noValidate>
      <header className="page-head">
        <Link className="link-btn back-link" to=".."><Icon name="back" size={16} /> Planes</Link>
        <h1>{plan ? plan.name : 'Nuevo plan'}</h1>
        {!canEdit && <p className="hint">Solo lectura: los administradores editan los planes.</p>}
      </header>

      <div className="plan-editor">
        <fieldset className="form-fieldset" disabled={!canEdit}>
          <section className="card form-section">
            <h2>Plan</h2>
            <div className="form-grid">
              {field('name', 'Nombre *', <input {...inputProps('name')} maxLength={80} placeholder="Ej: Mensual BJJ 3x semana" autoComplete="off" />)}
              {field('specialty_id', 'Disciplina', (
                <select id="p-specialty_id" className="input" value={form.specialty_id} onChange={(e) => set('specialty_id', e.target.value)}>
                  <option value="">Todas / Mixto</option>
                  {(specialties.data ?? []).filter((s) => s.active || s.id === form.specialty_id).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              ), specialties.data?.length ? undefined : 'Agrega disciplinas en Ajustes → Catálogos.')}
            </div>
          </section>

          <section className="card form-section">
            <h2>Precio</h2>
            <div className="field">
              <span className="field__label" id="cycle-label">Ciclo de cobro</span>
              <div className="segmented segmented--wrap" role="group" aria-labelledby="cycle-label">
                {cycles.map((c) => (
                  <button key={c.value} type="button" aria-pressed={form.billing_cycle === c.value} onClick={() => setCycle(c.value)}>{c.label}</button>
                ))}
              </div>
            </div>
            <div className="form-grid">
              {field('price', 'Precio (CLP) *', <input {...inputProps('price')} inputMode="numeric" placeholder="$35.000" onBlur={moneyBlur('price')} />, form.billing_cycle === 'unico' ? 'Se cobra una vez.' : `Se cobra ${cycleInfo(form.billing_cycle).per.replace('/ ', 'por ')}.`)}
              {field('enrollment_fee', 'Matrícula (CLP)', <input {...inputProps('enrollment_fee')} inputMode="numeric" placeholder="$0" onBlur={moneyBlur('enrollment_fee')} />, 'Cobro único al inscribirse. Vacío = sin matrícula.')}
              {field('duration_days', 'Vigencia (días)', <input {...inputProps('duration_days')} inputMode="numeric" placeholder={form.billing_cycle === 'unico' ? 'Sin vencimiento' : ''} />, 'Se usa para calcular el vencimiento de la matrícula.')}
            </div>
          </section>

          <section className="card form-section">
            <h2>Qué incluye</h2>
            <div className="form-grid">
              {field('sessions_per_week', 'Clases por semana', <input {...inputProps('sessions_per_week')} inputMode="numeric" placeholder="Ilimitadas" />, 'Vacío = ilimitadas.')}
              {field('class_count', 'Pack de clases', <input {...inputProps('class_count')} inputMode="numeric" placeholder="Ej: 10" />, 'Total de clases del plan, si es un pack.')}
              {field('description', 'Descripción', <textarea {...inputProps('description')} rows={3} maxLength={400} placeholder="Qué incluye, horarios, condiciones…" />, undefined, true)}
            </div>
          </section>

          <section className="card form-section plan-flags">
            <label className="switch">
              <input type="checkbox" checked={form.is_default} onChange={(e) => setDefault(e.target.checked)} />
              <span>
                <strong>Plan predeterminado</strong>
                <span className="hint">Se sugiere primero al matricular. Solo puede haber uno: marcar este desmarca el anterior.</span>
              </span>
            </label>
            <label className="switch">
              <input type="checkbox" checked={form.is_trial} onChange={(e) => set('is_trial', e.target.checked)} />
              <span>
                <strong>Plan de prueba</strong>
                <span className="hint">Para clases de prueba o primeras visitas.</span>
              </span>
            </label>
            <label className="switch">
              <input id="p-active" type="checkbox" checked={form.active} disabled={form.is_default} onChange={(e) => set('active', e.target.checked)} />
              <span>
                <strong>Plan activo</strong>
                <span className="hint">{form.is_default ? 'El predeterminado siempre está activo.' : 'Los inactivos no se ofrecen en nuevas matrículas; las existentes siguen igual.'}</span>
              </span>
            </label>
            {errors.active && <span className="field__error">{errors.active}</span>}
          </section>
        </fieldset>

        <aside className="plan-preview" aria-label="Vista previa">
          <span className="field__label">Vista previa</span>
          <div className={`card plan-card${form.is_default ? ' is-default' : ''}${form.active ? '' : ' is-off'}`}>
            <div className="plan-card__tags">
              <span className="eyebrow">{form.specialty_id ? specialties.data?.find((s) => s.id === form.specialty_id)?.name : 'Todas las disciplinas'}</span>
              {form.is_default && <span className="tag tag--accent">Predeterminado</span>}
              {form.is_trial && <span className="tag">Prueba</span>}
            </div>
            <h2 className="plan-card__name">{form.name || 'Nombre del plan'}</h2>
            <p className="plan-card__price">
              {preview ? (preview.price === 0 ? 'Gratis' : formatCLP(preview.price)) : form.price || '$0'}
              {(!preview || preview.price > 0) && <span>{cycleInfo(form.billing_cycle).per}</span>}
            </p>
            {preview && (
              <ul className="plan-card__features">
                {planFeatures({ ...preview, billing_cycle: form.billing_cycle, duration_days: preview.duration_days ?? null, sessions_per_week: preview.sessions_per_week ?? null, class_count: preview.class_count ?? null }).map((f) => <li key={f}>{f}</li>)}
                {(preview.enrollment_fee ?? 0) > 0 && <li>Matrícula {formatCLP(preview.enrollment_fee ?? 0)}</li>}
              </ul>
            )}
          </div>
        </aside>
      </div>

      {serverError && <p className="alert" role="alert">{serverError}</p>}
      {saved && <p className="alert alert--ok" role="status">Cambios guardados.</p>}

      {canEdit && (
        <div className="form-actions">
          <button className="btn" type="submit" disabled={save.isPending}>{save.isPending ? 'Guardando…' : plan ? 'Guardar cambios' : 'Crear plan'}</button>
          <Link className="btn btn--ghost" to="..">Cancelar</Link>
          {plan && <button type="button" className="btn btn--ghost" onClick={duplicate}>Duplicar</button>}
          {plan && (
            <span className="form-actions__danger">
              {confirmDelete ? (
                <>
                  <span className="hint">¿Eliminar definitivamente?</span>
                  <button type="button" className="btn btn--danger" disabled={remove.isPending} onClick={() => remove.mutate()}>Eliminar</button>
                  <button type="button" className="btn btn--ghost" onClick={() => setConfirmDelete(false)}>No</button>
                </>
              ) : (
                <button type="button" className="btn btn--ghost" onClick={() => setConfirmDelete(true)} disabled={plan.is_default} title={plan.is_default ? 'Marca otro plan como predeterminado antes de eliminar este' : undefined}>
                  <Icon name="trash" size={16} /> Eliminar
                </button>
              )}
            </span>
          )}
        </div>
      )}
    </form>
  )
}
