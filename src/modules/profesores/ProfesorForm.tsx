import { useState, type FormEvent, type ReactNode } from 'react'
import { Link, useNavigate, useParams } from '../../lib/nav'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useSchool } from '../../lib/school'
import { formatRut } from '../../lib/rut'
import { beltSuggestions } from '../../lib/belts'
import { artsKey, degreeText, listArts } from '../artes/api'
import { BeltEmote } from '../artes/Belt'
import { Icon } from '../../ui/Icon'
import { Toggle } from '../../ui/Toggle'
import { CatalogoDialog } from '../ajustes/CatalogoDialog'
import { listMembers } from '../miembros/api'
import { deleteTeacher, getTeacher, listSpecialties, listTeachers, saveTeacher, specialtiesKey, teachersKey, type TeacherWithSpecialties } from './api'
import { emptyTeacher, formFromTeacher, parseTeacher, type TeacherForm } from './schema'
import { TeacherLinks } from '../vinculos/Vinculos'

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
  const arts = useQuery({ queryKey: artsKey(schoolId), queryFn: () => listArts(schoolId!), enabled: Boolean(schoolId) })

  const [form, setForm] = useState<TeacherForm>(() => (teacher ? formFromTeacher(teacher) : emptyTeacher))
  const [picked, setPicked] = useState<string[]>(() => teacher?.specialty_ids ?? [])
  const [errors, setErrors] = useState<Errors>({})
  const [serverError, setServerError] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)

  // Accounts already linked to another teacher are not offered again.
  const taken = new Set((teachers.data ?? []).filter((t) => t.id !== teacher?.id && t.user_id).map((t) => t.user_id))
  const linkable = (members.data ?? []).filter((m) => !taken.has(m.user_id))
  // Card item 6: a member with the same email is probably this teacher.
  const mailMatch = !form.user_id && form.email.trim() ? linkable.find((m) => m.profile?.email?.toLowerCase() === form.email.trim().toLowerCase()) : undefined

  const set = <K extends keyof TeacherForm>(k: K, v: TeacherForm[K]) => {
    setForm((f) => ({ ...f, [k]: v }))
    if (errors[k]) setErrors((e) => ({ ...e, [k]: undefined }))
  }
  // Belts come from the school's arts; the free-text belt keeps its name (exports, old screens).
  const allBelts = (arts.data ?? []).flatMap((a) => a.belts.map((b) => ({ b, a })))
  const hasBelts = allBelts.length > 0
  const found = allBelts.find((x) => x.b.id === form.belt_id)
  const belt = found?.b
  const beltArt = found?.a
  const pickBelt = (id: string) => {
    const b = allBelts.find((x) => x.b.id === id)?.b
    setForm((f) => ({ ...f, belt_id: id, belt: b?.name ?? '', belt_degree: b && Number(f.belt_degree) <= b.max_degree ? f.belt_degree : '' }))
  }
  const toggleSpecialty = (id: string) => {
    setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]))
  }

  const save = useMutation({
    mutationFn: (payload: Parameters<typeof saveTeacher>[2]) => saveTeacher(schoolId!, teacher?.id ?? null, payload, picked),
    onSuccess: async (t) => {
      await qc.invalidateQueries({ queryKey: teachersKey(schoolId) })
      await qc.invalidateQueries({ queryKey: ['teacher', t.id] })
      navigate('..', { replace: true, state: { flash: teacher ? `Cambios de ${t.full_name} guardados.` : `Profesor ${t.full_name} creado.` } })
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
            {hasBelts ? (
              <>
                {field('belt_id', 'Cinturón', (
                  <select {...inputProps('belt_id')} onChange={(e) => pickBelt(e.target.value)}>
                    <option value="">Sin cinturón</option>
                    {(arts.data ?? []).filter((a) => a.belts.length).map((a) => (
                      <optgroup key={a.id} label={a.name}>
                        {a.belts.filter((b) => b.track === 'adultos').map((b) => <option key={b.id} value={b.id}>{b.name}{b.rank_label ? ` (${b.rank_label})` : ''}</option>)}
                      </optgroup>
                    ))}
                  </select>
                ))}
                {belt && belt.max_degree > 0 && field('belt_degree', belt.degree_name === 'franja' ? 'Franjas' : 'Grado', (
                  <select {...inputProps('belt_degree')}>
                    <option value="">Sin {belt.degree_name === 'franja' ? 'franjas' : 'grado'}</option>
                    {Array.from({ length: belt.max_degree }, (_, i) => i + 1).map((n) => <option key={n} value={String(n)}>{degreeText(n, belt.degree_name)}</option>)}
                  </select>
                ))}
                {belt && (
                  <div className="belt-preview field--wide" aria-hidden="true">
                    <BeltEmote color={belt.color} stripe={belt.stripe} bar={belt.bar} pattern={belt.pattern} degree={Number(form.belt_degree || 0)} size={64} />
                    <b>{beltArt?.name} · {belt.name}{Number(form.belt_degree) > 0 ? ` · ${degreeText(Number(form.belt_degree), belt.degree_name)}` : ''}</b>
                  </div>
                )}
              </>
            ) : (
              <>
                {field('belt', 'Cinturón', (
                  <>
                    <input {...inputProps('belt')} list="t-belt-options" placeholder="Ej: Negro" />
                    <datalist id="t-belt-options">{beltSuggestions.map((b) => <option key={b} value={b} />)}</datalist>
                  </>
                ))}
                {field('belt_degree', 'Grado / dan', <input {...inputProps('belt_degree')} inputMode="numeric" placeholder="0–12" />)}
                <p className="hint field--wide">Agrega las artes marciales de la escuela en Ajustes → Artes marciales para elegir el cinturón con sus colores.</p>
              </>
            )}
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
              <p className="hint">Aún no hay especialidades.</p>
            )}
            {canEdit && schoolId && (
              <CatalogoDialog
                label="Crear o editar especialidades"
                table="specialties" schoolId={schoolId}
                title="Especialidades"
                description="Disciplinas que enseñan los profesores."
                placeholder="Ej: Jiu-jitsu brasileño"
                onChange={() => qc.invalidateQueries({ queryKey: specialtiesKey(schoolId) })}
              />
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
          {mailMatch && (
            <div className="links__suggest" role="status">
              <span>El correo coincide con el miembro <b>{mailMatch.profile?.full_name || mailMatch.profile?.email}</b>. ¿Es su cuenta?</span>
              <button type="button" className="btn" onClick={() => set('user_id', mailMatch.user_id)}>Vincular</button>
            </div>
          )}
        </section>

        <section className="card form-section">
          <Toggle checked={form.active} onChange={(v) => set('active', v)} label="Profesor activo" hint="Los inactivos no aparecen al asignar clases, pero conservan su historial." />
        </section>
      </fieldset>

      {teacher && <TeacherLinks teacher={teacher} />}

      {serverError && <p className="alert" role="alert">{serverError}</p>}

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
