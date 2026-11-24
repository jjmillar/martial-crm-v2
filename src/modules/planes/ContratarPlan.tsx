import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { Plan } from '../../lib/database.types'
import { formatCLP } from '../../lib/money'
import { addDays, formatDate, todayIso } from '../../lib/dates'
import { Icon } from '../../ui/Icon'
import { Modal } from '../../ui/Modal'
import { flash } from '../../ui/flashEvent'
import { PayDialog } from '../pagar/Checkout'
import type { MyEnrollment } from '../portal/api'
import { contractPlan, withdrawPlanContract } from './api'
import { cycleInfo, planFeatures } from './cycles'

/** Renewal opens when the plan has 7 days or less left (or already ended); same rule as the database. */
export const RENEW_DAYS = 7

type Props = { plan: Plan; mine: MyEnrollment | undefined; studentId: string; schoolId: string }

/**
 * The student's actions on a plan card: Contratar → confirm pop-up → pay pop-up (transfer or cash, the school
 * confirms and the plan activates). A contract waiting for payment shows Pagar / Anular; their own plan near its
 * end shows Renovar. Everything happens here, in pop-ups (docs/ui-standards.md §6).
 */
export function PlanActions({ plan, mine, studentId, schoolId }: Props) {
  const qc = useQueryClient()
  const [confirm, setConfirm] = useState(false)
  const [paying, setPaying] = useState<string | null>(null)
  const [askWithdraw, setAskWithdraw] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const refresh = () => Promise.all([
    qc.invalidateQueries({ queryKey: ['my-enrollments', studentId] }),
    qc.invalidateQueries({ queryKey: ['my-payments', studentId] }),
    qc.invalidateQueries({ queryKey: ['enrollments', schoolId] }),
    qc.invalidateQueries({ queryKey: ['payments'] }),
  ])
  const contract = useMutation({
    mutationFn: () => contractPlan(studentId, plan.id),
    onMutate: () => setError(null),
    onSuccess: async (r) => {
      await refresh()
      setConfirm(false)
      if (r.payment_id) setPaying(r.payment_id)
      else flash(`Plan ${plan.name} activado.`)
    },
    onError: (e: Error) => setError(e.message),
  })
  const withdraw = useMutation({
    mutationFn: () => withdrawPlanContract(studentId, mine!.id),
    onMutate: () => setError(null),
    onSuccess: async () => { await refresh(); setAskWithdraw(false); flash('Solicitud anulada.') },
    onError: (e: Error) => setError(e.message),
  })

  const pending = mine?.status === 'pendiente'
  const active = mine?.status === 'activa'
  const renewable = active && Boolean(plan.duration_days) && Boolean(mine?.ends_at) && mine!.ends_at! <= addDays(todayIso(), RENEW_DAYS)
  if (plan.is_trial || (active && !renewable)) return null

  return (
    <div className="plan-card__actions">
      {pending ? (
        askWithdraw ? (
          <>
            <span className="hint">¿Anular la solicitud?</span>
            <button type="button" className="btn btn--danger" disabled={withdraw.isPending} onClick={() => withdraw.mutate()}>Sí, anular</button>
            <button type="button" className="btn btn--ghost" onClick={() => setAskWithdraw(false)}>No</button>
          </>
        ) : (
          <>
            <button type="button" className="btn" disabled={contract.isPending} onClick={() => contract.mutate()}>
              <Icon name="wallet" size={16} /> Pagar {formatCLP(plan.price)}
            </button>
            <button type="button" className="btn btn--ghost" onClick={() => setAskWithdraw(true)}>Anular</button>
          </>
        )
      ) : renewable ? (
        <button type="button" className="btn" disabled={contract.isPending} onClick={() => contract.mutate()}>
          <Icon name="wallet" size={16} /> {contract.isPending ? 'Abriendo…' : 'Renovar'}
        </button>
      ) : (
        <button type="button" className="btn" onClick={() => { setError(null); setConfirm(true) }}>Contratar</button>
      )}
      {error && !confirm && <p className="alert" role="alert">{error}</p>}

      <Modal open={confirm} onClose={() => setConfirm(false)} label={`Contratar ${plan.name}`}>
        <div className="modal__head">
          <span className="eyebrow">Contratar plan</span>
          <button type="button" className="icon-btn" onClick={() => setConfirm(false)} aria-label="Cerrar"><Icon name="close" /></button>
        </div>
        <div className="contract">
          <h2>{plan.name}</h2>
          <p className="plan-card__price">
            {plan.price === 0 ? 'Gratis' : formatCLP(plan.price)}
            {plan.price > 0 && <span>{cycleInfo(plan.billing_cycle).per}</span>}
          </p>
          <ul className="plan-card__features">{planFeatures(plan).map((f) => <li key={f}>{f}</li>)}</ul>
          {plan.description && <p className="hint">{plan.description}</p>}
          <p className="contract__how">
            {plan.price === 0
              ? 'Es gratis: queda activo apenas lo contrates.'
              : <>Se crea un cobro de <b>{formatCLP(plan.price)}</b>. Lo pagas por transferencia o en efectivo y, cuando tu escuela lo confirme, el plan queda activo desde ese día{plan.duration_days ? ` por ${plan.duration_days} días` : ''}.</>}
          </p>
          {error && <p className="alert" role="alert">{error}</p>}
          <div className="form-actions">
            <button type="button" className="btn" disabled={contract.isPending} onClick={() => contract.mutate()}>
              <Icon name="check" size={16} /> {contract.isPending ? 'Contratando…' : plan.price === 0 ? 'Activar plan' : 'Contratar y pagar'}
            </button>
            <button type="button" className="btn btn--ghost" onClick={() => setConfirm(false)}>Cancelar</button>
          </div>
        </div>
      </Modal>
      <PayDialog paymentId={paying} open={Boolean(paying)} onClose={() => setPaying(null)} more={false} />
    </div>
  )
}

/** The status line on the student's card: waiting for payment, or their plan and when it ends. */
export function PlanStatus({ mine }: { mine: MyEnrollment | undefined }) {
  if (!mine) return null
  if (mine.status === 'pendiente') return <span className="tag tag--phase-pendiente">Por pagar</span>
  if (mine.status !== 'activa') return null
  const ended = mine.ends_at && mine.ends_at < todayIso()
  return (
    <>
      <span className={`tag ${ended ? 'tag--phase-vencida' : 'tag--ok'}`}>{ended ? 'Tu plan · vencido' : 'Tu plan'}</span>
      {mine.ends_at && !ended && <span className="hint plan-card__until">hasta el {formatDate(mine.ends_at)}</span>}
    </>
  )
}
