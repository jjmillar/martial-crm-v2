import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { useSchool } from '../../lib/school'
import { formatDate, santiagoDate } from '../../lib/dates'
import { formatRut } from '../../lib/rut'
import { Icon } from '../../ui/Icon'
import { listStudents, studentsKey } from './api'

// Pending student self-signups (admins). Link to the existing student, create a new one, or reject.
type Req = { id: string; first_name: string; first_last_name: string; rut: string; email: string; phone: string | null; created_at: string }

const rutKey = (r: string | null | undefined) => (r ? r.replace(/[^0-9kK]/g, '').toUpperCase() : '')

export function SignupRequests() {
  const { activeSchool, role } = useSchool()
  const schoolId = activeSchool?.id
  const isAdmin = role === 'admin' || role === 'ceo'
  const qc = useQueryClient()
  const key = ['signups', schoolId]
  const reqs = useQuery({
    queryKey: key,
    queryFn: async () => {
      const { data, error } = await supabase.from('student_signups').select('id, first_name, first_last_name, rut, email, phone, created_at')
        .eq('school_id', schoolId!).eq('status', 'pendiente').order('created_at')
      if (error) throw error
      return data as Req[]
    },
    enabled: Boolean(schoolId) && isAdmin,
  })
  const students = useQuery({ queryKey: studentsKey(schoolId), queryFn: () => listStudents(schoolId!), enabled: Boolean(schoolId) && isAdmin })
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [pick, setPick] = useState<Record<string, string>>({})

  const decide = useMutation({
    mutationFn: async (v: { id: string; action: 'link' | 'create' | 'reject'; studentId?: string; name: string }) => {
      const { error } = await supabase.rpc('decide_student_signup', { p_id: v.id, p_action: v.action, p_student_id: v.studentId })
      if (error) {
        if (error.message.includes('students_school_rut_key')) throw new Error('Ya hay un alumno con ese RUT: usa "Vincular" con esa ficha.')
        if (error.message.includes('not available')) throw new Error('Esa ficha ya tiene una cuenta vinculada.')
        throw new Error('No se pudo guardar la decisión.')
      }
      return v
    },
    onMutate: () => setMsg(null),
    onSuccess: async (v) => {
      await Promise.all([qc.invalidateQueries({ queryKey: key }), qc.invalidateQueries({ queryKey: studentsKey(schoolId) })])
      setMsg({ ok: true, text: v.action === 'reject' ? `Registro de ${v.name} rechazado.` : v.action === 'create' ? `${v.name} quedó como alumno nuevo con acceso.` : `Cuenta de ${v.name} vinculada.` })
    },
    onError: (e: Error) => setMsg({ ok: false, text: e.message }),
  })

  if (!isAdmin || (!reqs.data?.length && !msg)) return null
  const free = (students.data ?? []).filter((s) => !s.user_id && s.active)

  return (
    <section className="card form-section signup-reqs" aria-labelledby="signups-h">
      <h2 id="signups-h">Registros por aprobar {reqs.data?.length ? <span className="tag tag--wait">{reqs.data.length}</span> : null}</h2>
      <p className="hint">Alumnos que se registraron con el link de la escuela y no coincidieron con una ficha (RUT + correo).</p>
      {msg && <p className={`alert${msg.ok ? ' alert--ok' : ''}`} role={msg.ok ? 'status' : 'alert'}>{msg.text}</p>}
      <ul className="signup-list">
        {reqs.data?.map((r) => {
          const name = `${r.first_name} ${r.first_last_name}`
          const suggested = free.find((s) => rutKey(s.rut) === rutKey(r.rut)) ?? free.find((s) => s.email && s.email.toLowerCase() === r.email.toLowerCase())
          const target = pick[r.id] ?? suggested?.id ?? ''
          return (
            <li key={r.id} className="signup-item">
              <div className="signup-item__who">
                <strong>{name}</strong>
                <span className="hint">{formatRut(r.rut)} · {r.email}{r.phone ? ` · ${r.phone}` : ''} · {formatDate(santiagoDate(r.created_at))}</span>
                {suggested && <span className="hint">Parece ser <b>{suggested.full_name}</b> (mismo {rutKey(suggested.rut) === rutKey(r.rut) ? 'RUT' : 'correo'}).</span>}
              </div>
              <div className="signup-item__actions">
                <select className="input" aria-label={`Ficha para ${name}`} value={target} onChange={(e) => setPick((p) => ({ ...p, [r.id]: e.target.value }))}>
                  <option value="">Crear alumno nuevo</option>
                  {free.map((s) => <option key={s.id} value={s.id}>Vincular con {s.full_name}</option>)}
                </select>
                <button type="button" className="btn" disabled={decide.isPending}
                  onClick={() => decide.mutate(target ? { id: r.id, action: 'link', studentId: target, name } : { id: r.id, action: 'create', name })}>
                  <Icon name="check" size={16} /> Aprobar
                </button>
                <button type="button" className="btn btn--ghost" disabled={decide.isPending} onClick={() => decide.mutate({ id: r.id, action: 'reject', name })}>Rechazar</button>
              </div>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
