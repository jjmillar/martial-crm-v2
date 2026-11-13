import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { useSchool } from '../../lib/school'
import { formatDate, santiagoDate } from '../../lib/dates'
import { formatRut } from '../../lib/rut'
import { roleLabel } from '../../lib/roles'
import type { SchoolRole } from '../../lib/database.types'
import { Icon } from '../../ui/Icon'
import { listPending, pendingKey, type Req } from './api'

type Free = { id: string; school_id: string; full_name: string | null; rut: string | null; email: string | null }

const rutKey = (r: string | null | undefined) => (r ? r.replace(/[^0-9kK]/g, '').toUpperCase() : '')

// Account requests from the sign-up pages, shown on top of Tareas. Only the CEO sees and decides them.
export function Aprobaciones() {
  const { schools } = useSchool()
  const qc = useQueryClient()
  const reqs = useQuery({ queryKey: pendingKey, queryFn: listPending })
  const schoolIds = [...new Set((reqs.data ?? []).filter((r) => r.kind === 'alumno').map((r) => r.school_id))]
  // Students without an account in the schools that have student requests (to link instead of duplicating).
  const free = useQuery({
    queryKey: ['free-students', schoolIds.join()],
    queryFn: async () => {
      const { data, error } = await supabase.from('students').select('id, school_id, full_name, rut, email').in('school_id', schoolIds).is('user_id', null).eq('active', true).order('full_name')
      if (error) throw error
      return data as Free[]
    },
    enabled: schoolIds.length > 0,
  })
  const [choice, setChoice] = useState<Record<string, string>>({})
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)

  const decide = useMutation({
    mutationFn: async (v: { r: Req; approve: boolean; studentId?: string; role?: SchoolRole }) => {
      const { error } = await supabase.rpc('decide_account_request', {
        p_id: v.r.id, p_approve: v.approve, p_student_id: v.studentId, p_role: v.role ?? 'user',
      })
      if (error) {
        if (error.message.includes('students_school_rut_key')) throw new Error('Ya existe un alumno con ese RUT en la escuela: elige "Vincular con…" esa ficha.')
        if (error.message.includes('not available')) throw new Error('Esa ficha ya tiene una cuenta vinculada.')
        throw new Error('No se pudo guardar la decisión.')
      }
      return v
    },
    onMutate: () => setMsg(null),
    onSuccess: async (v) => {
      await Promise.all([qc.invalidateQueries({ queryKey: pendingKey }), qc.invalidateQueries({ queryKey: ['free-students'] }), qc.invalidateQueries({ queryKey: ['students'] }), qc.invalidateQueries({ queryKey: ['members'] })])
      const name = `${v.r.first_name} ${v.r.first_last_name}`
      setMsg({ ok: true, text: !v.approve ? `Solicitud de ${name} rechazada.` : v.r.kind === 'alumno' ? `${name} ya es alumno y puede entrar a completar su perfil.` : `${name} ya es parte del equipo (${roleLabel[v.role ?? 'user']}).` })
    },
    onError: (e: Error) => setMsg({ ok: false, text: e.message }),
  })

  const schoolName = (id: string) => schools.find((s) => s.id === id)?.name ?? 'Escuela'

  return (
    <section className="tareas__approvals" aria-labelledby="aprob-h">
      <div className="tareas__section-head">
        <h2 id="aprob-h">Aprobaciones {Boolean(reqs.data?.length) && <span className="nav-badge">{reqs.data!.length}</span>}</h2>
        <p className="hint">Cuentas creadas en la página de registro. Nadie tiene acceso hasta que lo apruebes.</p>
      </div>
      {msg && <p className={`alert${msg.ok ? ' alert--ok' : ''}`} role={msg.ok ? 'status' : 'alert'}>{msg.text}</p>}
      {reqs.isLoading && <p className="hint">Cargando…</p>}
      {reqs.isSuccess && reqs.data.length === 0 && <p className="hint">No hay cuentas por aprobar.</p>}
      <ul className="req-list">
        {reqs.data?.map((r) => {
          const name = `${r.first_name} ${r.first_last_name}`
          const options = (free.data ?? []).filter((s) => s.school_id === r.school_id)
          const match = r.kind === 'alumno'
            ? options.find((s) => rutKey(s.rut) && rutKey(s.rut) === rutKey(r.rut)) ?? options.find((s) => s.email && s.email.toLowerCase() === r.email)
            : undefined
          const picked = choice[r.id] ?? (r.kind === 'alumno' ? match?.id ?? '' : 'user')
          return (
            <li key={r.id} className="card req">
              <div className="req__top">
                <div className="req__who">
                  <strong>{name}</strong>
                  <span className="hint">{r.email}{r.phone ? ` · ${r.phone}` : ''}{r.rut ? ` · ${formatRut(r.rut)}` : ''}</span>
                  <span className="hint">{schoolName(r.school_id)} · {formatDate(santiagoDate(r.created_at))}</span>
                </div>
                <span className={`tag ${r.kind === 'alumno' ? 'tag--accent' : ''}`}>{r.kind === 'alumno' ? 'Alumno' : 'Miembro del equipo'}</span>
              </div>
              {match && <p className="req__match">Ya existe la ficha <b>{match.full_name}</b> con el mismo {rutKey(match.rut) === rutKey(r.rut) ? 'RUT' : 'correo'}: se vinculará a esa ficha.</p>}
              <div className="req__actions">
                {r.kind === 'alumno' ? (
                  <select className="input" aria-label={`Ficha para ${name}`} value={picked} onChange={(e) => setChoice((c) => ({ ...c, [r.id]: e.target.value }))}>
                    <option value="">Crear alumno nuevo</option>
                    {options.map((s) => <option key={s.id} value={s.id}>Vincular con {s.full_name}</option>)}
                  </select>
                ) : (
                  <select className="input" aria-label={`Rol para ${name}`} value={picked} onChange={(e) => setChoice((c) => ({ ...c, [r.id]: e.target.value }))}>
                    <option value="user">Rol: {roleLabel.user}</option>
                    <option value="admin">Rol: {roleLabel.admin}</option>
                  </select>
                )}
                <button type="button" className="btn" disabled={decide.isPending}
                  onClick={() => decide.mutate(r.kind === 'alumno' ? { r, approve: true, studentId: picked || undefined } : { r, approve: true, role: picked as SchoolRole })}>
                  <Icon name="check" size={16} /> Aprobar
                </button>
                <button type="button" className="btn btn--ghost" disabled={decide.isPending} onClick={() => decide.mutate({ r, approve: false })}>Rechazar</button>
              </div>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
