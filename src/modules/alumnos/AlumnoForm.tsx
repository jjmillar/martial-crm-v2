import { useState, type FormEvent, type ReactNode } from 'react'
import { Link, useNavigate, useParams } from '../../lib/nav'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useSchool } from '../../lib/school'
import { formatDate, todayIso, yearsSince } from '../../lib/dates'
import { formatRut } from '../../lib/rut'
import type { Student } from '../../lib/database.types'
import { Icon } from '../../ui/Icon'
import { Toggle } from '../../ui/Toggle'
import { createStudent, deleteStudent, getStudent, studentsKey, updateStudent } from './api'
import { emptyForm, formFromStudent, parseStudent, type StudentForm } from './schema'
import { Family } from './Family'
import { StudentEnrollments } from './StudentEnrollments'
import { StudentPayments } from './StudentPayments'
import { StudentLinks } from '../vinculos/Vinculos'
import { artsKey, listArts, listStudentArts, rowFrom, saveStudentArts, schoolStudentArtsKey, studentArtsKey, type ArtRow, type StudentArt } from '../artes/api'
import { StudentArtsEditor } from '../artes/StudentArtsEditor'
import { StudentLogros } from '../artes/Logros'

/** The list lives in Miembros → Alumnos. */
const BACK = '/app/miembros#alumnos'

type Errors = Partial<Record<keyof StudentForm, string>>

/** Route element: loads the student for /alumnos/:id, or renders an empty form for /alumnos/nuevo. */
export function AlumnoEditor() {
  const { id } = useParams()
  const isNew = !id || id === 'nuevo'
  const student = useQuery({ queryKey: ['student', id], queryFn: () => getStudent(id!), enabled: !isNew })
  // The student's arts are loaded before the form, so its rows start with them.
  const arts = useQuery({ queryKey: studentArtsKey(id), queryFn: () => listStudentArts(id!), enabled: !isNew })
  if (isNew) return <AlumnoForm key="new" />
  if (student.isLoading || arts.isLoading) return <p className="hint">Cargando…</p>
  if (!student.data) return <p className="alert">No encontramos ese alumno. <Link to={BACK}>Volver al listado</Link></p>
  return <AlumnoForm key={student.data.id} student={student.data} studentArts={arts.data ?? []} />
}

function AlumnoForm({ student, studentArts = [] }: { student?: Student; studentArts?: StudentArt[] }) {
  const { activeSchool, role } = useSchool()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [form, setForm] = useState<StudentForm>(() => (student ? formFromStudent(student) : emptyForm(todayIso())))
  const [errors, setErrors] = useState<Errors>({})
  const [serverError, setServerError] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const schoolArts = useQuery({ queryKey: artsKey(activeSchool?.id), queryFn: () => listArts(activeSchool!.id), enabled: Boolean(activeSchool) })
  const [artRows, setArtRows] = useState<ArtRow[]>(() => studentArts.map(rowFrom))
  const [artsError, setArtsError] = useState<string | null>(null)

  const set = <K extends keyof StudentForm>(k: K, v: StudentForm[K]) => {
    setForm((f) => ({ ...f, [k]: v }))
    if (errors[k]) setErrors((e) => ({ ...e, [k]: undefined }))
  }

  const save = useMutation({
    mutationFn: async (payload: Parameters<typeof updateStudent>[1]) => {
      const s = student ? await updateStudent(student.id, payload) : await createStudent({ ...payload, school_id: activeSchool!.id, first_name: payload.first_name!, first_last_name: payload.first_last_name! })
      let artsFailed: string | null = null
      try { await saveStudentArts(s.school_id, s.id, artRows, studentArts) } catch (e) { artsFailed = (e as Error).message }
      return { s, artsFailed }
    },
    onSuccess: ({ s, artsFailed }) => {
      qc.invalidateQueries({ queryKey: studentsKey(activeSchool?.id) })
      qc.invalidateQueries({ queryKey: studentArtsKey(s.id) })
      qc.invalidateQueries({ queryKey: schoolStudentArtsKey(activeSchool?.id) })
      qc.invalidateQueries({ queryKey: ['achievements', s.id] })
      qc.setQueryData(['student', s.id], s)
      if (artsFailed) {
        // The student is saved; stay (or move to the new student's page) so the arts can be fixed and saved again.
        setArtsError(`Datos guardados, pero no las artes marciales: ${artsFailed}`)
        if (!student) navigate(`../${s.id}`, { replace: true })
        return
      }
      navigate(BACK, { replace: true, state: { flash: student ? `Cambios de ${s.full_name ?? 'alumno'} guardados.` : `Alumno ${s.full_name ?? ''} creado.` } })
    },
    onError: (e: Error) => setServerError(e.message),
  })

  const remove = useMutation({
    mutationFn: () => deleteStudent(student!.id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: studentsKey(activeSchool?.id) })
      navigate(BACK, { replace: true })
    },
    onError: (e: Error) => {
      setConfirmDelete(false)
      setServerError(e.message)
    },
  })

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    setServerError(null)
    setArtsError(null)
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
          <Link className="link-btn back-link" to={BACK}><Icon name="back" size={16} /> Alumnos</Link>
          <h1>{student ? student.full_name : 'Nuevo alumno'}</h1>
          <p className="hint">Los campos con * son obligatorios.</p>
          {student && (
            <p className="hint">
              {[student.rut && formatRut(student.rut), age !== null && `${age} años`, `Inscrito el ${formatDate(student.enrollment_date)}`, tenure ? `${tenure} ${tenure === 1 ? 'año' : 'años'} en la escuela` : null].filter(Boolean).join(' · ')}
            </p>
          )}
          {student && <Family studentId={student.id} userId={student.user_id ?? null} schoolId={student.school_id} />}
        </div>
      </header>

      <section className="card form-section">
        <h2>Identidad</h2>
        <div className="form-grid">
          {field('first_name', 'Primer nombre *', <input {...inputProps('first_name')} autoComplete="off" />)}
          {field('middle_name', 'Segundo nombre', <input {...inputProps('middle_name')} autoComplete="off" />)}
          {field('first_last_name', 'Primer apellido *', <input {...inputProps('first_last_name')} autoComplete="off" />)}
          {field('second_last_name', 'Segundo apellido *', <input {...inputProps('second_last_name')} autoComplete="off" />)}
          {field('rut', 'RUT *', <input {...inputProps('rut')} inputMode="text" placeholder="12.345.678-5" onBlur={() => form.rut && set('rut', formatRut(form.rut))} />)}
          {field('gender', 'Género', (
            <select id="f-gender" className="input" value={form.gender} onChange={(e) => set('gender', e.target.value as StudentForm['gender'])}>
              <option value="">Sin especificar</option>
              <option value="femenino">Femenino</option>
              <option value="masculino">Masculino</option>
              <option value="otro">Otro</option>
            </select>
          ))}
          {field('birth_date', age !== null ? `Fecha de nacimiento * · ${age} ${age === 1 ? 'año' : 'años'}` : 'Fecha de nacimiento (edad) *', <input {...inputProps('birth_date')} type="date" max={todayIso()} />)}
          {field('enrollment_date', 'Fecha de inscripción *', <input {...inputProps('enrollment_date')} type="date" />)}
        </div>
      </section>

      <section className="card form-section">
        <h2>Artes marciales</h2>
        {schoolArts.isLoading ? <p className="hint">Cargando…</p> : (
          <StudentArtsEditor arts={schoolArts.data ?? []} rows={artRows} onChange={setArtRows} canConfigure={role === 'ceo' || role === 'admin'} error={artsError} />
        )}
        <div className="form-grid">
          {field('weight_kg', 'Peso (kg)', <input {...inputProps('weight_kg')} inputMode="decimal" placeholder="Ej: 72,5" />)}
        </div>
      </section>

      <section className="card form-section">
        <h2>Contacto</h2>
        <div className="form-grid">
          {field('email', 'Correo *', <input {...inputProps('email')} type="email" autoComplete="off" />)}
          {field('phone', 'Teléfono', <input {...inputProps('phone')} type="tel" placeholder="+56 9 1234 5678" />)}
          {field('address', 'Dirección *', <input {...inputProps('address')} />, true)}
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
        <Toggle checked={form.active} onChange={(v) => set('active', v)} label="Alumno activo" hint="Los inactivos se ocultan del listado principal, pero conservan su historial." />
      </section>

      {student && <StudentLogros studentId={student.id} schoolId={student.school_id} />}
      {student && <StudentEnrollments studentId={student.id} />}
      {student && <StudentPayments studentId={student.id} />}
      {student && <StudentLinks student={student} />}

      {serverError && <p className="alert" role="alert">{serverError}</p>}

      <div className="form-actions">
        <button className="btn" type="submit" disabled={save.isPending}>{save.isPending ? 'Guardando…' : student ? 'Guardar cambios' : 'Crear alumno'}</button>
        <Link className="btn btn--ghost" to={BACK}>Cancelar</Link>
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
