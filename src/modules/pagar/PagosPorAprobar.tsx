import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useSchool } from '../../lib/school'
import { formatCLP } from '../../lib/money'
import { formatDate, santiagoDate } from '../../lib/dates'
import { Icon } from '../../ui/Icon'
import { decideSubmission, listReviews, reviewsKey, type Review } from './api'

// Transfers students reported from the payment gateway. The CEO checks the bank account, then approves
// (the payment becomes "Pagado") or rejects it with a reason the student sees.
export function PagosPorAprobar() {
  const { schools } = useSchool()
  const qc = useQueryClient()
  const q = useQuery({ queryKey: reviewsKey, queryFn: listReviews })
  const [rejecting, setRejecting] = useState<string | null>(null)
  const [reason, setReason] = useState('')
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)

  const decide = useMutation({
    mutationFn: async (v: { r: Review; approve: boolean; reason?: string }) => { await decideSubmission(v.r.id, v.approve, v.reason); return v },
    onMutate: () => setMsg(null),
    onSuccess: async (v) => {
      setRejecting(null); setReason('')
      await Promise.all([qc.invalidateQueries({ queryKey: reviewsKey }), qc.invalidateQueries({ queryKey: ['payments'] }), qc.invalidateQueries({ queryKey: ['payment-submissions'] })])
      const who = v.r.student?.full_name ?? 'el alumno'
      setMsg({ ok: true, text: v.approve ? `Pago de ${who} aprobado: ya figura como pagado.` : `Pago de ${who} rechazado. Le mostramos el motivo.` })
    },
    onError: (e: Error) => setMsg({ ok: false, text: e.message }),
  })
  const schoolName = (id: string) => schools.find((s) => s.id === id)?.name ?? 'Escuela'

  return (
    <section className="tareas__approvals" aria-labelledby="pay-rev-h">
      <div className="tareas__section-head">
        <h2 id="pay-rev-h">Pagos por aprobar {Boolean(q.data?.length) && <span className="nav-badge">{q.data!.length}</span>}</h2>
        <p className="hint">Transferencias que informaron los alumnos. Revisa que el dinero llegó a la cuenta y apruébalas.</p>
      </div>
      {msg && <p className={`alert${msg.ok ? ' alert--ok' : ''}`} role={msg.ok ? 'status' : 'alert'}>{msg.text}</p>}
      {q.isLoading && <p className="hint">Cargando…</p>}
      {q.isSuccess && q.data.length === 0 && <p className="hint">No hay pagos por aprobar.</p>}
      <ul className="req-list" data-motion>
        {q.data?.map((r) => (
          <li key={r.id} className="card req">
            <div className="req__top">
              <div className="req__who">
                <strong>{r.student?.full_name ?? 'Alumno'}</strong>
                <span className="hint">{r.payment?.concept ?? 'Pago'} · Transferencia{r.reference ? ` · Op./comentario: ${r.reference}` : ''}</span>
                <span className="hint">{schoolName(r.school_id)} · informado el {formatDate(santiagoDate(r.created_at))}</span>
              </div>
              <b className="pay-amount">{formatCLP(r.amount)}</b>
            </div>
            {rejecting === r.id ? (
              <div className="pay-review__actions">
                <input className="input" autoFocus maxLength={200} aria-label="Motivo del rechazo" placeholder="Motivo (ej: no llegó la transferencia)" value={reason} onChange={(e) => setReason(e.target.value)} />
                <button type="button" className="btn btn--danger" disabled={decide.isPending} onClick={() => decide.mutate({ r, approve: false, reason })}>Rechazar pago</button>
                <button type="button" className="btn btn--ghost" onClick={() => { setRejecting(null); setReason('') }}>Cancelar</button>
              </div>
            ) : (
              <div className="pay-review__actions">
                <button type="button" className="btn" disabled={decide.isPending} onClick={() => decide.mutate({ r, approve: true })}><Icon name="check" size={16} /> Aprobar pago</button>
                <button type="button" className="btn btn--ghost" disabled={decide.isPending} onClick={() => setRejecting(r.id)}>Rechazar</button>
              </div>
            )}
          </li>
        ))}
      </ul>
    </section>
  )
}
