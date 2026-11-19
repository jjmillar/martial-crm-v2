import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { useSchool } from '../../lib/school'
import { formatDate, santiagoDate, yearsSince } from '../../lib/dates'
import { formatCLP } from '../../lib/money'
import { formatRut } from '../../lib/rut'
import { roleLabel } from '../../lib/roles'
import type { SchoolRole } from '../../lib/database.types'
import { Icon } from '../../ui/Icon'
import { listPending, pendingKey, type Req } from './api'
import { byGuardian, pendingCheckIns, pendingCheckInsKey, reviewAttendance, type PendingCheckIn } from '../asistencia/api'
import { decideSubmission, listReviews, reviewsKey, type Review } from '../pagar/api'
import { decideChild, pendingChildren, pendingChildrenKey, type PendingChild } from '../portal/guardian'

type Free = { id: string; school_id: string; full_name: string | null; rut: string | null; email: string | null }
type Item =
  | { kind: 'asistencia'; at: string; a: PendingCheckIn }
  | { kind: 'pago'; at: string; p: Review }
  | { kind: 'cuenta'; at: string; r: Req }
  | { kind: 'hijo'; at: string; h: PendingChild }

const rutKey = (r: string | null | undefined) => (r ? r.replace(/[^0-9kK]/g, '').toUpperCase() : '')
const timeFmt = new Intl.DateTimeFormat('es-CL', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'America/Santiago' })

/**
 * Tareas → Aprobaciones: everything waiting for a decision, in one list (oldest first). Students' attendance
 * check-ins (whole team), transfers reported from the payment gateway and new accounts from the sign-up pages (CEO).
 */
export function Aprobaciones() {
  const { activeSchool, role, schools } = useSchool()
  const ceo = role === 'ceo'
  const admin = ceo || role === 'admin'
  const qc = useQueryClient()
  const att = useQuery({ queryKey: pendingCheckInsKey(activeSchool?.id), queryFn: () => pendingCheckIns(activeSchool!.id), enabled: Boolean(activeSchool) })
  const pays = useQuery({ queryKey: reviewsKey, queryFn: listReviews, enabled: ceo })
  const reqs = useQuery({ queryKey: pendingKey, queryFn: listPending, enabled: ceo })
  const kids = useQuery({ queryKey: pendingChildrenKey, queryFn: pendingChildren, enabled: admin })
  const studentSchools = [...new Set((reqs.data ?? []).filter((r) => r.kind === 'alumno').map((r) => r.school_id))]
  const free = useQuery({
    queryKey: ['free-students', studentSchools.join()],
    queryFn: async () => {
      const { data, error } = await supabase.from('students').select('id, school_id, full_name, rut, email').in('school_id', studentSchools).is('user_id', null).eq('active', true).order('full_name')
      if (error) throw error
      return data as Free[]
    },
    enabled: studentSchools.length > 0,
  })
  const [choice, setChoice] = useState<Record<string, string>>({})
  const [rejecting, setRejecting] = useState<string | null>(null)
  const [reason, setReason] = useState('')
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)

  const items: Item[] = [
    ...(att.data ?? []).map((a) => ({ kind: 'asistencia' as const, at: a.created_at, a })),
    ...(ceo ? (pays.data ?? []).map((p) => ({ kind: 'pago' as const, at: p.created_at, p })) : []),
    ...(ceo ? (reqs.data ?? []).map((r) => ({ kind: 'cuenta' as const, at: r.created_at, r })) : []),
    ...(admin ? (kids.data ?? []).map((h) => ({ kind: 'hijo' as const, at: h.created_at, h })) : []),
  ].sort((a, b) => a.at.localeCompare(b.at))
  const attendance = (att.data ?? [])
  const loading = att.isLoading || (ceo && (pays.isLoading || reqs.isLoading)) || (admin && kids.isLoading)

  const done = (text: string) => { setMsg({ ok: true, text }); setRejecting(null); setReason('') }
  const fail = (e: Error) => setMsg({ ok: false, text: e.message })
  const refresh = (...keys: readonly unknown[][]) => Promise.all(keys.map((k) => qc.invalidateQueries({ queryKey: k })))

  const reviewAtt = useMutation({
    mutationFn: async (v: { rows: PendingCheckIn[]; approve: boolean }) => { await reviewAttendance(v.rows.map((r) => r.id), v.approve); return v },
    onMutate: () => setMsg(null),
    onSuccess: async (v) => {
      await refresh(['attendance-pending'], ['attendance'], ['attendance-range'])
      const one = v.rows.length === 1 ? v.rows[0].student?.full_name ?? 'el alumno' : null
      done(v.approve ? (one ? `Asistencia de ${one} aprobada.` : `${v.rows.length} asistencias aprobadas.`) : `Asistencia de ${one ?? 'los alumnos'} rechazada.`)
    },
    onError: fail,
  })
  const decidePay = useMutation({
    mutationFn: async (v: { p: Review; approve: boolean; reason?: string }) => { await decideSubmission(v.p.id, v.approve, v.reason); return v },
    onMutate: () => setMsg(null),
    onSuccess: async (v) => {
      await refresh([...reviewsKey], ['payments'], ['payment-submissions'])
      const who = v.p.student?.full_name ?? 'el alumno'
      done(v.approve ? `Pago de ${who} aprobado: ya figura como pagado.` : `Pago de ${who} rechazado. Le mostramos el motivo.`)
    },
    onError: fail,
  })
  const decideAcc = useMutation({
    mutationFn: async (v: { r: Req; approve: boolean; studentId?: string; role?: SchoolRole }) => {
      const { error } = await supabase.rpc('decide_account_request', { p_id: v.r.id, p_approve: v.approve, p_student_id: v.studentId, p_role: v.role ?? 'user' })
      if (error) {
        if (error.message.includes('students_school_rut_key')) throw new Error('Ya existe un alumno con ese RUT en la escuela: elige "Vincular con…" esa ficha.')
        if (error.message.includes('not available')) throw new Error('Esa ficha ya tiene una cuenta vinculada.')
        throw new Error('No se pudo guardar la decisión.')
      }
      return v
    },
    onMutate: () => setMsg(null),
    onSuccess: async (v) => {
      await refresh([...pendingKey], ['free-students'], ['students'], ['members'])
      const name = [v.r.first_name, v.r.middle_name, v.r.first_last_name, v.r.second_last_name].filter(Boolean).join(' ')
      done(!v.approve ? `Solicitud de ${name} rechazada.` : v.r.kind === 'alumno' ? `${name} ya es alumno y puede entrar a completar su perfil.` : `${name} ya es parte del equipo (${roleLabel[v.role ?? 'user']}).`)
    },
    onError: fail,
  })
  const decideKid = useMutation({
    mutationFn: async (v: { h: PendingChild; approve: boolean; reason?: string }) => { await decideChild(v.h.id, v.approve, v.reason); return v },
    onMutate: () => setMsg(null),
    onSuccess: async (v) => {
      await refresh([...pendingChildrenKey], ['students'])
      done(v.approve ? `${v.h.first_name} ${v.h.first_last_name} ya es alumno. ${v.h.guardian_name ?? 'Su apoderado'} lo ve desde su cuenta.` : `Solicitud de ${v.h.first_name} rechazada. Su apoderado verá el motivo.`)
    },
    onError: fail,
  })
  const busy = reviewAtt.isPending || decidePay.isPending || decideAcc.isPending || decideKid.isPending
  const schoolName = (id: string) => schools.find((s) => s.id === id)?.name ?? 'Escuela'
  const multiSchool = schools.length > 1

  return (
    <section className="tareas__approvals" aria-labelledby="aprob-h">
      <div className="tareas__section-head appr-head">
        <div>
          <h2 id="aprob-h">Aprobaciones {items.length > 0 && <span className="nav-badge">{items.length}</span>}</h2>
          <p className="hint">{ceo ? 'Asistencias que marcaron los alumnos, pagos por transferencia, cuentas nuevas e hijos de apoderados.' : admin ? 'Asistencias que marcaron los alumnos e hijos que agregaron los apoderados.' : 'Asistencias que marcaron los alumnos desde su cuenta.'}</p>
        </div>
        {attendance.length > 1 && (
          <button type="button" className="btn btn--ghost" disabled={busy} onClick={() => reviewAtt.mutate({ rows: attendance, approve: true })}>
            <Icon name="check" size={16} /> Aprobar asistencias ({attendance.length})
          </button>
        )}
      </div>
      {msg && <p className={`alert${msg.ok ? ' alert--ok' : ''}`} role={msg.ok ? 'status' : 'alert'}>{msg.text}</p>}
      {loading && <p className="hint">Cargando…</p>}
      {!loading && items.length === 0 && <p className="hint">No hay nada por aprobar.</p>}

      {items.length > 0 && (
        <ul className="card appr-list" data-motion>
          {items.map((it) => {
            if (it.kind === 'asistencia') {
              const a = it.a
              return (
                <li key={`a-${a.id}`} className="appr" style={{ ['--class-color' as string]: a.class?.color }}>
                  <span className="appr__main">
                    <span className="appr__title"><span className="tag appr__kind">Asistencia</span><strong>{a.student?.full_name ?? 'Alumno'}</strong></span>
                    <span className="hint">{a.class?.name ?? 'Clase'} · {formatDate(a.date)} · {byGuardian(a) ? 'su apoderado marcó' : 'marcó'} a las {timeFmt.format(new Date(a.created_at))}</span>
                  </span>
                  <span className="appr__actions">
                    <button type="button" className="btn" disabled={busy} onClick={() => reviewAtt.mutate({ rows: [a], approve: true })}>Aprobar</button>
                    <button type="button" className="btn btn--ghost" disabled={busy} onClick={() => reviewAtt.mutate({ rows: [a], approve: false })}>Rechazar</button>
                  </span>
                </li>
              )
            }
            if (it.kind === 'pago') {
              const p = it.p
              return (
                <li key={`p-${p.id}`} className="appr appr--pay">
                  <span className="appr__main">
                    <span className="appr__title"><span className="tag appr__kind">Pago</span><strong>{p.student?.full_name ?? 'Alumno'}</strong><b className="appr__amount">{formatCLP(p.amount)}</b></span>
                    <span className="hint">{p.payment?.concept ?? 'Pago'} · Transferencia{p.reference ? ` · Op.: ${p.reference}` : ''} · {formatDate(santiagoDate(p.created_at))}{multiSchool ? ` · ${schoolName(p.school_id)}` : ''}</span>
                  </span>
                  {rejecting === p.id ? (
                    <span className="appr__actions appr__actions--wide">
                      <input className="input" autoFocus maxLength={200} aria-label="Motivo del rechazo" placeholder="Motivo (ej: no llegó la transferencia)" value={reason} onChange={(e) => setReason(e.target.value)} />
                      <button type="button" className="btn btn--danger" disabled={busy} onClick={() => decidePay.mutate({ p, approve: false, reason })}>Rechazar</button>
                      <button type="button" className="btn btn--ghost" onClick={() => { setRejecting(null); setReason('') }}>Cancelar</button>
                    </span>
                  ) : (
                    <span className="appr__actions">
                      <button type="button" className="btn" disabled={busy} onClick={() => decidePay.mutate({ p, approve: true })}>Aprobar</button>
                      <button type="button" className="btn btn--ghost" disabled={busy} onClick={() => setRejecting(p.id)}>Rechazar</button>
                    </span>
                  )}
                </li>
              )
            }
            if (it.kind === 'hijo') {
              const h = it.h
              const name = [h.first_name, h.middle_name, h.first_last_name, h.second_last_name].filter(Boolean).join(' ')
              return (
                <li key={`h-${h.id}`} className="appr appr--account">
                  <span className="appr__main">
                    <span className="appr__title"><span className="tag appr__kind">Hijo de apoderado</span><strong>{name}</strong></span>
                    <span className="hint">{[`Apoderado: ${h.guardian_name ?? 'alumno de la escuela'}`, formatRut(h.rut), `${yearsSince(h.birth_date)} años`, h.email, h.address, multiSchool ? schoolName(h.school_id) : null].filter(Boolean).join(' · ')}</span>
                  </span>
                  {rejecting === h.id ? (
                    <span className="appr__actions appr__actions--wide">
                      <input className="input" autoFocus maxLength={200} aria-label="Motivo del rechazo" placeholder="Motivo (ej: datos incompletos)" value={reason} onChange={(e) => setReason(e.target.value)} />
                      <button type="button" className="btn btn--danger" disabled={busy} onClick={() => decideKid.mutate({ h, approve: false, reason })}>Rechazar</button>
                      <button type="button" className="btn btn--ghost" onClick={() => { setRejecting(null); setReason('') }}>Cancelar</button>
                    </span>
                  ) : (
                    <span className="appr__actions">
                      <button type="button" className="btn" disabled={busy} onClick={() => decideKid.mutate({ h, approve: true })}>Aprobar</button>
                      <button type="button" className="btn btn--ghost" disabled={busy} onClick={() => setRejecting(h.id)}>Rechazar</button>
                    </span>
                  )}
                </li>
              )
            }
            const r = it.r
            const name = [r.first_name, r.middle_name, r.first_last_name, r.second_last_name].filter(Boolean).join(' ')
            const options = (free.data ?? []).filter((s) => s.school_id === r.school_id)
            const match = r.kind === 'alumno'
              ? options.find((s) => rutKey(s.rut) && rutKey(s.rut) === rutKey(r.rut)) ?? options.find((s) => s.email && s.email.toLowerCase() === r.email)
              : undefined
            const picked = choice[r.id] ?? (r.kind === 'alumno' ? match?.id ?? '' : 'user')
            return (
              <li key={`c-${r.id}`} className="appr appr--account">
                <span className="appr__main">
                  <span className="appr__title"><span className="tag appr__kind">{r.kind === 'alumno' ? 'Cuenta de alumno' : 'Cuenta del equipo'}</span><strong>{name}</strong></span>
                  <span className="hint">{[r.email, r.phone, r.rut && formatRut(r.rut), r.birth_date && `${yearsSince(r.birth_date)} años`, multiSchool ? schoolName(r.school_id) : null].filter(Boolean).join(' · ')}</span>
                  {match && <span className="hint appr__match">Ya existe la ficha <b>{match.full_name}</b> con el mismo {rutKey(match.rut) === rutKey(r.rut) ? 'RUT' : 'correo'}: se vinculará a esa ficha.</span>}
                </span>
                <span className="appr__actions">
                  {r.kind === 'alumno' ? (
                    <select className="input" aria-label={`Ficha para ${name}`} value={picked} onChange={(e) => setChoice((c) => ({ ...c, [r.id]: e.target.value }))}>
                      <option value="">Crear alumno nuevo</option>
                      {options.map((s) => <option key={s.id} value={s.id}>Vincular con {s.full_name}</option>)}
                    </select>
                  ) : (
                    <select className="input" aria-label={`Rol para ${name}`} value={picked} onChange={(e) => setChoice((c) => ({ ...c, [r.id]: e.target.value }))}>
                      <option value="user">{roleLabel.user}</option>
                      <option value="admin">{roleLabel.admin}</option>
                    </select>
                  )}
                  <button type="button" className="btn" disabled={busy}
                    onClick={() => decideAcc.mutate(r.kind === 'alumno' ? { r, approve: true, studentId: picked || undefined } : { r, approve: true, role: picked as SchoolRole })}>Aprobar</button>
                  <button type="button" className="btn btn--ghost" disabled={busy} onClick={() => decideAcc.mutate({ r, approve: false })}>Rechazar</button>
                </span>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
