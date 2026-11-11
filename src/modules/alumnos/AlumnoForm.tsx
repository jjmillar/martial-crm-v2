import { useState, type FormEvent, type ReactNode } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useSchool } from '../../lib/school'
import { formatDate, todayIso, yearsSince } from '../../lib/dates'
import { formatRut } from '../../lib/rut'
import type { Student } from '../../lib/database.types'
import { Icon } from '../../ui/Icon'
import { createStudent, deleteStudent, getStudent, studentsKey, updateStudent } from './api'
import { beltSuggestions } from './belts'
import { emptyForm, formFromStudent, parseStudent, type StudentForm } from './schema'

type Errors = Partial<Record<keyof StudentForm, string>>

/** Route element: loads the student for /alumnos/:id, or renders an empty form for /alumnos/nuevo. */
export function AlumnoEditor() {
  const { id } = useParams()
  const isNew = !id || id === 'nuevo'
  const student = useQuery({ queryKey: ['student', id], queryFn: () => getStudent(id!), enabled: !isNew })
  if (isNew) return <AlumnoForm key="new" />
  if (student.isLoading) return <p className="hint">Cargando…</p>
  if (!student.data) return <p className="alert">No encontramos ese alumno. <Link to="..">Volver al listado</Link></p>
  return <AlumnoForm key={student.data.id} student={student.data} />
}

function AlumnoForm({ student }: { student?: Student }) {
  const { activeSchool, role } = useSchool()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [form, setForm] = useState<StudentForm>(() => (student ? formFromStudent(student) : emptyForm(todayIso())))
  const [errors, setErrors] = useState<Errors>({})
  const [serverError, setServerError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const set = <K extends keyof StudentForm>(k: K, v: StudentForm[K]) => {
    setForm((f) => ({ ...f, [k]: v }))
    setSaved(false)
    if (errors[k]) setErrors((e) => ({ ...e, [k]: undefined }))
  }

  const save = useMutation({
    mutationFn: (payload: Parameters<typeof updateStudent>[1]) =>
      student ? updateStudent(student.id, payload) : createStudent({ ...payload, school_id: activeSchool!.id, first_name: payload.first_name!, first_last_name: payload.first_last_name! }),
    onSuccess: (s) => {
      qc.invalidateQueries({ queryKey: studentsKey(activeSchool?.id) })
      qc.setQueryData(['student', s.id], s)
      if (student) {
        setSaved(true)
        setForm(formFromStudent(s))
      } else navigate(`../${s.id}`, { replace: true })
    },
    onError: (e: Error) => setServerError(e.message),
  })

  const remove = useMutation({
    mutationFn: () => deleteStudent(student!.id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: studentsKey(activeSchool?.id) })
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
    const r = parseStudent(form)
    if (!r.ok) {
      setErrors(r.errors)
      const first = Object.keys(r.errors)[0]
      document.getElementById(`f-${first}`)?.focus()
      return
    }
    save.mutate(r.data)
  }

  if (!activeSchool) return <p className="page-note">Selecciona una escuela.</p>

  const field = (k: keyof StudentForm, label: string, input: ReactNode, wide = false) => (
    <div className={`field${wide ? ' field--wide' : ''}`}>
      <label htmlFor={`f-${k}`}>{label}</label>
      {input}
      {errors[k] && <span className="field__error" id={`e-${k}`}>{errors[k]}</span>}
    </div>
  )
  const inputProps = (k: Exclude<keyof StudentForm, 'active' | 'gender'>) => ({
    id: `f-${k}`,
    className: 'input',
    value: form[k],
    onChange: (e: { target: { value: string } }) => set(k, e.target.value),
    'aria-invalid': errors[k] ? true : undefined,
    'aria-describedby': errors[k] ? `e-${k}` : undefined,
  })

  const age = yearsSince(form.birth_date || null)
  const tenure = yearsSince(form.enrollment_date || null)

  return (
    <form className="alumno-form" onSubmit={onSubmit} noValidate>
      <header className="page-head page-head--row">
        <div>
          <Link className="link-btn back-link" to=".."><Icon name="back" size={16} /> Alumnos</Link>
          <h1>{student ? student.full_name : 'Nuevo alumno'}</h1>
          {student && (
            <p className="hint">
              {[student.rut && formatRut(student.rut), age !== null && `${age} años`, `Inscrito el ${formatDate(student.enrollment_date)}`, tenure ? `${tenure} ${tenure === 1 ? 'año' : 'años'} en la escuela` : null].filter(Boolean).join(' · ')}
            </p>
          )}
        </div>
      </header>

      <section className="card form-section">
        <h2>Identidad</h2>
        <div className="form-grid">
          {field('first_name', 'Primer nombre *', <input {...inputProps('first_name')} autoComplete="off" />)}
          {field('middle_name', 'Segundo nombre', <input {...inputProps('middle_name')} autoComplete="off" />)}
          {field('first_last_name', 'Primer apellido *', <input {...inputProps('first_last_name')} autoComplete="off" />)}
          {field('second_last_name', 'Segundo apellido', <input {...inputProps('second_last_name')} autoComplete="off" />)}
          {field('rut', 'RUT', <input {...inputProps('rut')} inputMode="text" placeholder="12.345.678-5" onBlur={() => form.rut && set('rut', formatRut(form.rut))} />)}
          {field('gender', 'Género', (
            <select id="f-gender" className="input" value={form.gender} onChange={(e) => set('gender', e.target.value as StudentForm['gender'])}>
              <option value="">Sin especificar</option>
              <option value="femenino">Femenino</option>
              <option value="masculino">Masculino</option>
              <option value="otro">Otro</option>
            </select>
          ))}
          {field('birth_date', 'Fecha de nacimiento', <input {...inputProps('birth_date')} type="date" max={todayIso()} />)}
          {field('enrollment_date', 'Fecha de inscripción *', <input {...inputProps('enrollment_date')} type="date" />)}
        </div>
      </section>

      <section className="card form-section">
        <h2>Artes marciales</h2>
        <div className="form-grid">
          {field('belt', 'Cinturón', (
            <>
              <input {...inputProps('belt')} list="belt-options" placeholder="Ej: Azul" />
              <datalist id="belt-options">{beltSuggestions.map((b) => <option key={b} value={b} />)}</datalist>
            </>
          ))}
          {field('belt_degree', 'Grado / franjas', <input {...inputProps('belt_degree')} inputMode="numeric" placeholder="0–12" />)}
          {field('weight_kg', 'Peso (kg)', <input {...inputProps('weight_kg')} inputMode="decimal" placeholder="Ej: 72,5" />)}
        </div>
      </section>

      <section className="card form-section">
        <h2>Contacto</h2>
        <div className="form-grid">
          {field('email', 'Correo', <input {...inputProps('email')} type="email" autoComplete="off" />)}
          {field('phone', 'Teléfono', <input {...inputProps('phone')} type="tel" placeholder="+56 9 1234 5678" />)}
          {field('address', 'Dirección', <input {...inputProps('address')} />, true)}
        </div>
      </section>

      <section className="card form-section">
        <h2>Salud y emergencia</h2>
        <div className="form-grid">
          {field('emergency_contact', 'Contacto de emergencia', <input {...inputProps('emergency_contact')} placeholder="Nombre y parentesco" />)}
          {field('emergency_phone', 'Teléfono de emergencia', <input {...inputProps('emergency_phone')} type="tel" />)}
          {field('medical_notes', 'Alergias, lesiones o condiciones', <textarea {...inputProps('medical_notes')} rows={3} />, true)}
          {field('notes', 'Notas', <textarea {...inputProps('notes')} rows={3} />, true)}
        </div>
      </section>

      <section className="card form-section form-section--row">
        <label className="switch">
          <input type="checkbox" checked={form.active} onChange={(e) => set('active', e.target.checked)} />
          <span>
            <strong>Alumno activo</strong>
            <span className="hint">Los inactivos se ocultan del listado principal, pero conservan su historial.</span>
          </span>
        </label>
      </section>

      {serverError && <p className="alert" role="alert">{serverError}</p>}
      {saved && <p className="alert alert--ok" role="status">Cambios guardados.</p>}

      <div className="form-actions">
        <button className="btn" type="submit" disabled={save.isPending}>{save.isPending ? 'Guardando…' : student ? 'Guardar cambios' : 'Crear alumno'}</button>
        <Link className="btn btn--ghost" to="..">Cancelar</Link>
        {student && (role === 'admin' || role === 'ceo') && (
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
    </form>
  )
}
