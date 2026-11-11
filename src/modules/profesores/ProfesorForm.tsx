import { useState, type FormEvent, type ReactNode } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useSchool } from '../../lib/school'
import { formatRut } from '../../lib/rut'
import { beltSuggestions } from '../../lib/belts'
import { Icon } from '../../ui/Icon'
import { listMembers } from '../miembros/api'
import { deleteTeacher, getTeacher, listSpecialties, listTeachers, saveTeacher, specialtiesKey, teachersKey, type TeacherWithSpecialties } from './api'
import { emptyTeacher, formFromTeacher, parseTeacher, type TeacherForm } from './schema'

type Errors = Partial<Record<keyof TeacherForm, string>>

/** Route element for /profesores/nuevo and /profesores/:id. */
export function ProfesorEditor() {
  const { id } = useParams()
  const isNew = !id || id === 'nuevo'
  const teacher = useQuery({ queryKey: ['teacher', id], queryFn: () => getTeacher(id!), enabled: !isNew })
  if (isNew) return <ProfesorForm key="new" />
  if (teacher.isLoading) return <p className="hint">Cargando…</p>
  if (!teacher.data) return <p className="alert">No encontramos ese profesor. <Link to="..">Volver al listado</Link></p>
  return <ProfesorForm key={teacher.data.id} teacher={teacher.data} />
}

function ProfesorForm({ teacher }: { teacher?: TeacherWithSpecialties }) {
  const { activeSchool, role } = useSchool()
  const schoolId = activeSchool?.id
  const canEdit = role === 'admin' || role === 'ceo'
  const navigate = useNavigate()
  const qc = useQueryClient()

  const specialties = useQuery({ queryKey: specialtiesKey(schoolId), queryFn: () => listSpecialties(schoolId!), enabled: Boolean(schoolId) })
  const members = useQuery({ queryKey: ['members', schoolId], queryFn: () => listMembers(schoolId!), enabled: Boolean(schoolId) })
  const teachers = useQuery({ queryKey: teachersKey(schoolId), queryFn: () => listTeachers(schoolId!), enabled: Boolean(schoolId) })

  const [form, setForm] = useState<TeacherForm>(() => (teacher ? formFromTeacher(teacher) : emptyTeacher))
  const [picked, setPicked] = useState<string[]>(() => teacher?.specialty_ids ?? [])
  const [errors, setErrors] = useState<Errors>({})
  const [serverError, setServerError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  // Accounts already linked to another teacher are not offered again.
  const taken = new Set((teachers.data ?? []).filter((t) => t.id !== teacher?.id && t.user_id).map((t) => t.user_id))
  const linkable = (members.data ?? []).filter((m) => !taken.has(m.user_id))

  const set = <K extends keyof TeacherForm>(k: K, v: TeacherForm[K]) => {
    setForm((f) => ({ ...f, [k]: v }))
    setSaved(false)
    if (errors[k]) setErrors((e) => ({ ...e, [k]: undefined }))
  }
  const toggleSpecialty = (id: string) => {
    setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]))
    setSaved(false)
  }

  const save = useMutation({
    mutationFn: (payload: Parameters<typeof saveTeacher>[2]) => saveTeacher(schoolId!, teacher?.id ?? null, payload, picked),
    onSuccess: async (t) => {
      await qc.invalidateQueries({ queryKey: teachersKey(schoolId) })
      await qc.invalidateQueries({ queryKey: ['teacher', t.id] })
      if (teacher) setSaved(true)
      else navigate(`../${t.id}`, { replace: true })
    },
    onError: (e: Error) => setServerError(e.message),
  })

  const remove = useMutation({
    mutationFn: () => deleteTeacher(teacher!.id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: teachersKey(schoolId) })
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
    const r = parseTeacher(form)
    if (!r.ok) {
      setErrors(r.errors)
      document.getElementById(`t-${Object.keys(r.errors)[0]}`)?.focus()
      return
    }
    save.mutate(r.data)
  }

  if (!activeSchool) return <p className="page-note">Selecciona una escuela.</p>

  const field = (k: keyof TeacherForm, label: string, input: ReactNode, wide = false) => (
    <div className={`field${wide ? ' field--wide' : ''}`}>
      <label htmlFor={`t-${k}`}>{label}</label>
      {input}
      {errors[k] && <span className="field__error" id={`te-${k}`}>{errors[k]}</span>}
    </div>
  )
  const inputProps = (k: Exclude<keyof TeacherForm, 'active'>) => ({
    id: `t-${k}`,
    className: 'input',
    value: form[k],
    onChange: (e: { target: { value: string } }) => set(k, e.target.value),
    'aria-invalid': errors[k] ? true : undefined,
    'aria-describedby': errors[k] ? `te-${k}` : undefined,
  })

  return (
    <form className="alumno-form" onSubmit={onSubmit} noValidate>
      <header className="page-head">
        <Link className="link-btn back-link" to=".."><Icon name="back" size={16} /> Profesores</Link>
        <h1>{teacher ? teacher.full_name : 'Nuevo profesor'}</h1>
        {!canEdit && <p className="hint">Solo lectura: los administradores editan los profesores.</p>}
      </header>

      <fieldset className="form-fieldset" disabled={!canEdit}>
        <section className="card form-section">
          <h2>Identidad y contacto</h2>
          <div className="form-grid">
            {field('first_name', 'Nombre *', <input {...inputProps('first_name')} autoComplete="off" />)}
            {field('first_last_name', 'Primer apellido *', <input {...inputProps('first_last_name')} autoComplete="off" />)}
            {field('second_last_name', 'Segundo apellido', <input {...inputProps('second_last_name')} autoComplete="off" />)}
            {field('rut', 'RUT', <input {...inputProps('rut')} placeholder="12.345.678-5" onBlur={() => form.rut && set('rut', formatRut(form.rut))} />)}
            {field('email', 'Correo', <input {...inputProps('email')} type="email" autoComplete="off" />)}
            {field('phone', 'Teléfono', <input {...inputProps('phone')} type="tel" placeholder="+56 9 1234 5678" />)}
          </div>
        </section>

        <section className="card form-section">
          <h2>Artes marciales</h2>
          <div className="form-grid">
            {field('belt', 'Cinturón', (
              <>
                <input {...inputProps('belt')} list="t-belt-options" placeholder="Ej: Negro" />
                <datalist id="t-belt-options">{beltSuggestions.map((b) => <option key={b} value={b} />)}</datalist>
              </>
            ))}
            {field('belt_degree', 'Grado / dan', <input {...inputProps('belt_degree')} inputMode="numeric" placeholder="0–12" />)}
          </div>
          <div className="field">
            <span className="field__label" id="sp-label">Especialidades</span>
            {specialties.data?.length ? (
              <div className="pick-chips" role="group" aria-labelledby="sp-label">
                {specialties.data.filter((s) => s.active || picked.includes(s.id)).map((s) => (
                  <button key={s.id} type="button" className="pick-chip" aria-pressed={picked.includes(s.id)} onClick={() => toggleSpecialty(s.id)}>
                    {s.name}
                  </button>
                ))}
              </div>
            ) : (
              <p className="hint">
                Aún no hay especialidades. {canEdit && <>Créalas en <Link to="/app/ajustes">Ajustes → Catálogos</Link>.</>}
              </p>
            )}
          </div>
          {field('bio', 'Bio corta', <textarea {...inputProps('bio')} rows={3} maxLength={600} placeholder="Trayectoria, logros, estilo de enseñanza…" />, true)}
        </section>

        <section className="card form-section">
          <h2>Cuenta en Martial CRM</h2>
          <p className="hint">Opcional. Vincula al profesor con su cuenta de miembro para que más adelante tome asistencia con su propio usuario. Para crear la cuenta, invítalo desde Miembros.</p>
          {field('user_id', 'Cuenta vinculada', (
            <select id="t-user_id" className="input" value={form.user_id} onChange={(e) => set('user_id', e.target.value)}>
              <option value="">Sin cuenta vinculada</option>
              {linkable.map((m) => <option key={m.user_id} value={m.user_id}>{m.profile?.full_name || m.profile?.email || 'Miembro'}</option>)}
            </select>
          ))}
        </section>

        <section className="card form-section">
          <label className="switch">
            <input type="checkbox" checked={form.active} onChange={(e) => set('active', e.target.checked)} />
            <span>
              <strong>Profesor activo</strong>
              <span className="hint">Los inactivos no aparecen al asignar clases, pero conservan su historial.</span>
            </span>
          </label>
        </section>
      </fieldset>

      {serverError && <p className="alert" role="alert">{serverError}</p>}
      {saved && <p className="alert alert--ok" role="status">Cambios guardados.</p>}

      {canEdit && (
        <div className="form-actions">
          <button className="btn" type="submit" disabled={save.isPending}>{save.isPending ? 'Guardando…' : teacher ? 'Guardar cambios' : 'Crear profesor'}</button>
          <Link className="btn btn--ghost" to="..">Cancelar</Link>
          {teacher && (
            <span className="form-actions__danger">
              {confirmDelete ? (
                <>
                  <span className="hint">¿Eliminar definitivamente?</span>
                  <button type="button" className="btn btn--danger" disabled={remove.isPending} onClick={() => remove.mutate()}>Eliminar</button>
                  <button type="button" className="btn btn--ghost" onClick={() => setConfirmDelete(false)}>No</button>
                </>
              ) : (
                <button type="button" className="btn btn--ghost" onClick={() => setConfirmDelete(true)}><Icon name="trash" size={16} /> Eliminar</button>
              )}
            </span>
          )}
        </div>
      )}
    </form>
  )
}
