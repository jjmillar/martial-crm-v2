import { useState } from 'react'
import { Link } from '../../lib/nav'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { useSchool } from '../../lib/school'
import { roleLabel } from '../../lib/roles'
import type { Student } from '../../lib/database.types'
import { Icon } from '../../ui/Icon'
import { listStudents, studentsKey } from '../alumnos/api'
import { listMembers, inviteMember } from '../miembros/api'
import { listTeachers, teachersKey, type TeacherWithSpecialties } from '../profesores/api'

// Card item 6: one person can be a student, a teacher and a member (account) at the same time.
// Links: students.user_id (portal account), teachers.student_id, teachers.user_id (member account).
// Matching RUT or email suggests linking.

const rutKey = (r: string | null | undefined) => (r ? r.replace(/[^0-9kK]/g, '').toUpperCase() : '')
const mailKey = (e: string | null | undefined) => (e ? e.trim().toLowerCase() : '')
const same = (a: { rut?: string | null; email?: string | null }, b: { rut?: string | null; email?: string | null }) =>
  (rutKey(a.rut) && rutKey(a.rut) === rutKey(b.rut)) ? 'RUT' : (mailKey(a.email) && mailKey(a.email) === mailKey(b.email)) ? 'correo' : null

async function studentAccess(body: { student_id: string; action: 'link' | 'unlink'; email?: string; password?: string }) {
  const { data, error } = await supabase.functions.invoke<{ ok: boolean; created?: boolean; error?: string }>('student-access', { body })
  if (error) {
    const ctx = (error as { context?: Response }).context
    const res = ctx ? await ctx.json().catch(() => null) : null
    throw new Error(res?.error ?? 'No se pudo completar la acción.')
  }
  return data
}

async function setTeacherLink(teacherId: string, patch: { student_id: string | null }) {
  const { error, count } = await supabase.from('teachers').update(patch, { count: 'exact' }).eq('id', teacherId)
  if (error) throw new Error(error.message.includes('teachers_school_student_key') ? 'Ese alumno ya está vinculado a otro profesor.' : error.message.includes('teachers_school_user_key') ? 'Esa cuenta ya está vinculada a otro profesor.' : 'No se pudo guardar el vínculo.')
  if (count === 0) throw new Error('Solo los administradores pueden vincular.')
}

function useLinkData() {
  const { activeSchool, role } = useSchool()
  const schoolId = activeSchool?.id
  const isAdmin = role === 'admin' || role === 'ceo'
  const teachers = useQuery({ queryKey: teachersKey(schoolId), queryFn: () => listTeachers(schoolId!), enabled: Boolean(schoolId) })
  const students = useQuery({ queryKey: studentsKey(schoolId), queryFn: () => listStudents(schoolId!), enabled: Boolean(schoolId) })
  const members = useQuery({ queryKey: ['members', schoolId], queryFn: () => listMembers(schoolId!), enabled: Boolean(schoolId) })
  return { schoolId, isAdmin, teachers: teachers.data ?? [], students: students.data ?? [], members: members.data ?? [] }
}

function useRefresh() {
  const qc = useQueryClient()
  const { schoolId } = useLinkData()
  return (studentId?: string, teacherId?: string) => Promise.all([
    qc.invalidateQueries({ queryKey: teachersKey(schoolId) }),
    qc.invalidateQueries({ queryKey: studentsKey(schoolId) }),
    qc.invalidateQueries({ queryKey: ['members', schoolId] }),
    studentId ? qc.invalidateQueries({ queryKey: ['student', studentId] }) : null,
    teacherId ? qc.invalidateQueries({ queryKey: ['teacher', teacherId] }) : null,
  ])
}

/** Student detail: portal account, teacher link, staff membership. */
export function StudentLinks({ student }: { student: Student }) {
  const { schoolId, isAdmin, teachers, members } = useLinkData()
  const refresh = useRefresh()
  const [email, setEmail] = useState(student.email ?? '')
  const [password, setPassword] = useState('')
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const done = (text: string) => async () => { await refresh(student.id); setMsg({ ok: true, text }) }
  const fail = (e: Error) => setMsg({ ok: false, text: e.message })

  const linkedTeacher = teachers.find((t) => t.student_id === student.id) ?? null
  const teacherMatches = linkedTeacher ? [] : teachers.filter((t) => !t.student_id && same(t, student))
  const member = student.user_id ? members.find((m) => m.user_id === student.user_id) ?? null : null
  const memberMatch = !student.user_id ? members.find((m) => mailKey(m.profile?.email) && mailKey(m.profile?.email) === mailKey(student.email)) ?? null : null
  const freeTeachers = teachers.filter((t) => !t.student_id)

  const access = useMutation({ mutationFn: studentAccess, onMutate: () => setMsg(null), onError: fail })
  const tLink = useMutation({ mutationFn: (v: { teacherId: string; studentId: string | null }) => setTeacherLink(v.teacherId, { student_id: v.studentId }), onMutate: () => setMsg(null), onError: fail })
  const toStaff = useMutation({
    mutationFn: () => inviteMember({ school_id: schoolId!, email: mailKey(student.email) || email, role: 'user', full_name: student.full_name ?? undefined }),
    onMutate: () => setMsg(null), onSuccess: done('Ahora también es miembro del equipo (rol Usuario).'), onError: fail,
  })

  // Not a <form>: this section renders inside the student form.
  function createAccess() {
    access.mutate({ student_id: student.id, action: 'link', email, password }, {
      onSuccess: (r) => done(r?.created ? `Acceso creado. Comparte el correo y la contraseña con ${student.first_name}.` : 'Ese correo ya tenía cuenta: quedó vinculada como acceso del alumno.')(),
    })
  }

  return (
    <section className="card form-section links" aria-labelledby="links-h">
      <h2 id="links-h">Cuenta y vínculos</h2>

      <div className="links__row">
        <Icon name="user" size={18} />
        <div className="links__body">
          <strong>Acceso del alumno</strong>
          {student.user_id ? (
            <span className="hint">Puede entrar a Martial CRM con {student.email ? <b>{student.email}</b> : 'su correo'} y ver su nivel, skills y asistencia.</span>
          ) : (
            <span className="hint">Sin acceso. Con una cuenta puede marcar su asistencia y ver su progreso.</span>
          )}
        </div>
        {isAdmin && student.user_id && (
          <button type="button" className="btn btn--ghost" disabled={access.isPending} onClick={() => access.mutate({ student_id: student.id, action: 'unlink' }, { onSuccess: done('Acceso quitado.') })}>Quitar acceso</button>
        )}
      </div>

      {isAdmin && memberMatch && (
        <div className="links__suggest" role="status">
          <span>El correo coincide con el miembro <b>{memberMatch.profile?.full_name || memberMatch.profile?.email}</b>. ¿Usar esa misma cuenta como acceso del alumno?</span>
          <button type="button" className="btn" disabled={access.isPending} onClick={() => access.mutate({ student_id: student.id, action: 'link', email: memberMatch.profile!.email! }, { onSuccess: done('Cuenta vinculada.') })}>Vincular</button>
        </div>
      )}

      {isAdmin && !student.user_id && (
        <div className="links__form">
          <div className="field">
            <label htmlFor="acc-email">Correo</label>
            <input id="acc-email" className="input" type="email" autoComplete="off" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="acc-pw">Contraseña inicial</label>
            <input id="acc-pw" className="input" type="text" autoComplete="new-password" placeholder="Mín. 8 caracteres" value={password} onChange={(e) => setPassword(e.target.value)} />
            <span className="hint">Si el correo ya tiene cuenta, se vincula sin cambiar su contraseña. El alumno puede cambiarla en Mi cuenta.</span>
          </div>
          <button className="btn" type="button" disabled={access.isPending} onClick={createAccess}>{access.isPending ? 'Creando…' : 'Crear acceso'}</button>
        </div>
      )}

      <div className="links__row">
        <Icon name="teacher" size={18} />
        <div className="links__body">
          <strong>Profesor</strong>
          {linkedTeacher
            ? <span className="hint">También es profesor: <Link to={`/app/profesores/${linkedTeacher.id}`}>{linkedTeacher.full_name}</Link></span>
            : <span className="hint">No está vinculado a un profesor.</span>}
        </div>
        {isAdmin && linkedTeacher && (
          <button type="button" className="btn btn--ghost" disabled={tLink.isPending} onClick={() => tLink.mutate({ teacherId: linkedTeacher.id, studentId: null }, { onSuccess: done('Vínculo con el profesor quitado.') })}>Desvincular</button>
        )}
      </div>
      {isAdmin && teacherMatches.map((t) => (
        <div key={t.id} className="links__suggest" role="status">
          <span>Mismo {same(t, student)} que el profesor <b>{t.full_name}</b>. ¿Es la misma persona?</span>
          <button type="button" className="btn" disabled={tLink.isPending} onClick={() => tLink.mutate({ teacherId: t.id, studentId: student.id }, { onSuccess: done(`Vinculado con el profesor ${t.full_name}.`) })}>Vincular</button>
        </div>
      ))}
      {isAdmin && !linkedTeacher && teacherMatches.length === 0 && freeTeachers.length > 0 && (
        <div className="field links__pick">
          <label htmlFor="link-teacher">Vincular con un profesor</label>
          <select id="link-teacher" className="input" value="" onChange={(e) => e.target.value && tLink.mutate({ teacherId: e.target.value, studentId: student.id }, { onSuccess: done('Vinculado con el profesor.') })}>
            <option value="">Elige un profesor…</option>
            {freeTeachers.map((t) => <option key={t.id} value={t.id}>{t.full_name}</option>)}
          </select>
        </div>
      )}

      <div className="links__row">
        <Icon name="users" size={18} />
        <div className="links__body">
          <strong>Equipo</strong>
          {member
            ? <span className="hint">También es miembro del equipo ({roleLabel[member.role]}).</span>
            : <span className="hint">No es parte del equipo de la escuela.</span>}
        </div>
        {isAdmin && !member && student.user_id && (
          <button type="button" className="btn btn--ghost" disabled={toStaff.isPending} onClick={() => toStaff.mutate()}>Agregar al equipo</button>
        )}
      </div>

      {msg && <p className={`alert${msg.ok ? ' alert--ok' : ''}`} role={msg.ok ? 'status' : 'alert'}>{msg.text}</p>}
    </section>
  )
}

/** Teacher detail: student link and matching suggestions. The member account (teachers.user_id) is a field of
 *  the teacher form itself, so its suggestion lives there (linking it from here would be overwritten on save). */
export function TeacherLinks({ teacher }: { teacher: TeacherWithSpecialties }) {
  const { isAdmin, students } = useLinkData()
  const refresh = useRefresh()
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const done = (text: string) => async () => { await refresh(undefined, teacher.id); setMsg({ ok: true, text }) }
  const link = useMutation({ mutationFn: (patch: { student_id: string | null }) => setTeacherLink(teacher.id, patch), onMutate: () => setMsg(null), onError: (e: Error) => setMsg({ ok: false, text: e.message }) })

  const linked = teacher.student_id ? students.find((s) => s.id === teacher.student_id) ?? null : null
  const studentMatches = linked ? [] : students.filter((s) => same(s, teacher))
  const pickable = students.filter((s) => s.active)

  return (
    <section className="card form-section links" aria-labelledby="tlinks-h">
      <h2 id="tlinks-h">Vínculos</h2>
      <div className="links__row">
        <Icon name="users" size={18} />
        <div className="links__body">
          <strong>Alumno</strong>
          {linked
            ? <span className="hint">También es alumno: <Link to={`/app/alumnos/${linked.id}`}>{linked.full_name}</Link></span>
            : <span className="hint">No está vinculado a un alumno.</span>}
        </div>
        {isAdmin && linked && <button type="button" className="btn btn--ghost" disabled={link.isPending} onClick={() => link.mutate({ student_id: null }, { onSuccess: done('Vínculo quitado.') })}>Desvincular</button>}
      </div>
      {isAdmin && studentMatches.map((s) => (
        <div key={s.id} className="links__suggest" role="status">
          <span>Mismo {same(s, teacher)} que el alumno <b>{s.full_name}</b>. ¿Es la misma persona?</span>
          <button type="button" className="btn" disabled={link.isPending} onClick={() => link.mutate({ student_id: s.id }, { onSuccess: done(`Vinculado con el alumno ${s.full_name}.`) })}>Vincular</button>
        </div>
      ))}
      {isAdmin && !linked && studentMatches.length === 0 && pickable.length > 0 && (
        <div className="field links__pick">
          <label htmlFor="link-student">Vincular con un alumno</label>
          <select id="link-student" className="input" value="" onChange={(e) => e.target.value && link.mutate({ student_id: e.target.value }, { onSuccess: done('Vinculado con el alumno.') })}>
            <option value="">Elige un alumno…</option>
            {pickable.map((s) => <option key={s.id} value={s.id}>{s.full_name}</option>)}
          </select>
        </div>
      )}
      {msg && <p className={`alert${msg.ok ? ' alert--ok' : ''}`} role={msg.ok ? 'status' : 'alert'}>{msg.text}</p>}
    </section>
  )
}
