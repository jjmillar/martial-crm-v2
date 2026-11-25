import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { formatDate, santiagoDate, todayIso, daysUntil } from '../../lib/dates'
import { formatCLP } from '../../lib/money'
import { Icon } from '../../ui/Icon'
import { ShowMore } from '../../ui/ShowMore'
import { useShowMore } from '../../ui/useShowMore'
import { CodeField } from '../descuentos/CodeField'
import { TransferData } from '../pagar/Checkout'
import {
  applyCode, checkout, fetchMySubscription, invoiceStatusLabel, mySubKey, perLabel, reportTransfer, subStatusLabel,
  type BillPlan, type Invoice, type MySubscription,
} from './api'

const limitText = (n: number | null, used: number, one: string, many: string) =>
  n ? `${used} de ${n} ${n === 1 ? one : many}` : `${used} ${used === 1 ? one : many} · sin límite`

/**
 * Ajustes → Mi cuenta → "Mi suscripción" (the CEO): the Martial CRM plan they have, its state and limits, and paying
 * the next period by bank transfer, like students pay their school: pick the plan, apply a code, transfer, "Ya
 * transferí"; the platform confirms it. Also on the "suscripción suspendida" screen, so a blocked customer can pay.
 */
export function MiSuscripcion() {
  const qc = useQueryClient()
  const q = useQuery({ queryKey: mySubKey, queryFn: fetchMySubscription })
  const refresh = () => qc.invalidateQueries({ queryKey: mySubKey })
  if (q.isLoading) return <p className="hint">Cargando…</p>
  if (q.isError || !q.data) return <p className="alert">No se pudo cargar tu suscripción.</p>
  const s = q.data
  const open = s.invoices.find((i) => i.status === 'pendiente' || i.status === 'por_confirmar') ?? null
  return (
    <div className="mysub">
      <Status s={s} />
      <Pay s={s} open={open} refresh={refresh} />
      <History invoices={s.invoices.filter((i) => i.status === 'pagada' || i.status === 'anulada')} />
    </div>
  )
}

function Status({ s }: { s: MySubscription }) {
  const today = todayIso()
  const left = s.status === 'prueba' && s.trial_ends ? daysUntil(s.trial_ends, today) : s.status === 'activa' && s.period_end ? daysUntil(s.period_end, today) : null
  const warn = s.status === 'suspendida' || s.status === 'cancelada' || (left !== null && left <= 7)
  return (
    <section className={`card mysub__plan${warn ? ' is-warn' : ''}`} aria-label="Tu plan">
      <div className="mysub__plan-head">
        <div>
          <span className="hint">Tu plan de Martial CRM</span>
          <h3>{s.plan?.name ?? 'Sin plan'}</h3>
        </div>
        {s.status && <span className={`tag tag--sub-${s.status}`}>{subStatusLabel[s.status]}</span>}
      </div>
      {s.plan && <p className="mysub__price">{formatCLP(s.plan.price_clp)}<span>{perLabel(s.plan.period)}</span></p>}
      <p className="mysub__when">
        <Icon name="calendar" size={16} />
        <span>
        {s.status === 'prueba' && (s.trial_ends ? <>Prueba gratis hasta el <b>{formatDate(s.trial_ends)}</b>{left !== null && left >= 0 ? ` (${left === 0 ? 'termina hoy' : `quedan ${left} días`})` : ' (terminó)'}.</> : 'Prueba gratis.')}
        {s.status === 'activa' && (s.period_end ? <>Pagado hasta el <b>{formatDate(s.period_end)}</b>{left !== null && left < 0 ? ' (venció)' : left !== null && left <= 7 ? ` (quedan ${left} días)` : ''}.</> : 'Activa.')}
        {(s.status === 'suspendida' || s.status === 'cancelada') && <>Tu suscripción está {s.status}: paga para reactivarla. Tus datos siguen guardados.</>}
        </span>
      </p>
      <ul className="mysub__usage">
        <li><Icon name="school" size={16} /> {limitText(s.plan?.max_schools ?? null, s.usage.schools, 'escuela', 'escuelas')}</li>
        <li><Icon name="users" size={16} /> {limitText(s.plan?.max_students ?? null, s.usage.students, 'alumno activo', 'alumnos activos')}</li>
        {s.discount && <li><Icon name="tag" size={16} /> <span>Código <b>{s.discount.code}</b>: {s.discount.percent ? `${s.discount.percent} %` : formatCLP(s.discount.fixed ?? 0)} de descuento en cada cobro</span></li>}
      </ul>
    </section>
  )
}

function Pay({ s, open, refresh }: { s: MySubscription; open: Invoice | null; refresh: () => Promise<unknown> }) {
  const [plan, setPlan] = useState<string | null>(open?.plan_id ?? s.plan?.id ?? s.plans[0]?.id ?? null)
  const [reference, setReference] = useState('')
  const [error, setError] = useState<string | null>(null)
  useEffect(() => { if (open?.plan_id) setPlan(open.plan_id) }, [open?.plan_id])
  const prepare = useMutation({ mutationFn: (id: string) => checkout(id), onMutate: () => setError(null), onSuccess: refresh, onError: (e: Error) => setError(e.message) })
  const send = useMutation({ mutationFn: () => reportTransfer(reference), onMutate: () => setError(null), onSuccess: refresh, onError: (e: Error) => setError(e.message) })

  if (open?.status === 'por_confirmar') {
    return (
      <section className="card checkout__state" role="status">
        <Icon name="clock" size={22} />
        <div>
          <strong>Tu transferencia está por confirmar</strong>
          <p className="hint">Avisaste el pago de {formatCLP(open.amount)} ({open.plan_name}, {formatDate(open.period_start)} al {formatDate(open.period_end)}){open.reported_at ? ` el ${formatDate(santiagoDate(open.reported_at))}` : ''}. Cuando lo confirmemos, tu suscripción queda pagada hasta el {formatDate(open.period_end)}.</p>
        </div>
      </section>
    )
  }

  const choose = (p: BillPlan) => { setPlan(p.id); if (open && open.plan_id !== p.id) prepare.mutate(p.id) }
  const title = s.status === 'activa' ? 'Pagar el próximo período' : s.status === 'prueba' ? 'Contratar un plan' : 'Pagar y reactivar'

  return (
    <section className="card form-section mysub__pay" aria-labelledby="mysub-pay-h">
      <h3 id="mysub-pay-h">{title}</h3>
      {open?.reject_reason && <p className="alert" role="alert">No pudimos confirmar tu transferencia anterior: {open.reject_reason}. Revísala y vuelve a avisar.</p>}
      <div className="mysub__plans" role="radiogroup" aria-label="Plan">
        {s.plans.map((p) => (
          <button key={p.id} type="button" role="radio" aria-checked={plan === p.id} className={`mysub__opt${plan === p.id ? ' is-on' : ''}`} onClick={() => choose(p)} disabled={prepare.isPending}>
            <strong>{p.name}</strong>
            <span className="mysub__opt-price">{formatCLP(p.price_clp)}<small>{perLabel(p.period)}</small></span>
            <span className="hint">{[p.max_schools ? `${p.max_schools} ${p.max_schools === 1 ? 'escuela' : 'escuelas'}` : 'Escuelas ilimitadas', p.max_students ? `hasta ${p.max_students} alumnos` : 'alumnos ilimitados'].join(' · ')}</span>
          </button>
        ))}
      </div>

      {!open && (
        <button type="button" className="btn" disabled={!plan || prepare.isPending} onClick={() => plan && prepare.mutate(plan)}>
          {prepare.isPending ? 'Preparando…' : 'Continuar al pago'}
        </button>
      )}

      {open && (
        <>
          <div className="checkout__summary mysub__summary" aria-label="Resumen del cobro">
            <div>
              <span className="hint">Plan {open.plan_name}</span>
              <strong>{formatDate(open.period_start)} al {formatDate(open.period_end)}</strong>
            </div>
            <div className="checkout__total">
              {open.discount_amount > 0 && <s className="hint">{formatCLP(open.base_amount)}</s>}
              <p className="checkout__amount">{formatCLP(open.amount)}</p>
            </div>
          </div>
          {open.discount_amount > 0 ? (
            <p className="checkout__discount" role="status"><Icon name="tag" size={16} /> <span>Código <b>{open.discount_code}</b>: −{formatCLP(open.discount_amount)}</span></p>
          ) : (
            <CodeField apply={async (c) => ({ ok: true as const, ...(await applyCode(c)) })} onApplied={refresh} />
          )}
          {s.transfer ? (
            <TransferData t={{ bank: s.transfer.bank, type: s.transfer.account_type, number: s.transfer.account_number, holder: s.transfer.holder, rut: s.transfer.rut, email: s.transfer.email }}
              amount={open.amount} concept={`Martial CRM ${open.plan_name}`}>
              <p className="hint">Transfiere <b>{formatCLP(open.amount)}</b> a esta cuenta y después presiona <b>Ya transferí</b>.</p>
            </TransferData>
          ) : (
            <p className="alert" role="alert">Aún no están los datos de transferencia de Martial CRM. Escríbenos para pagar.</p>
          )}
          <div className="field">
            <label htmlFor="mysub-ref">N° de operación o comentario (opcional)</label>
            <input id="mysub-ref" className="input" maxLength={120} value={reference} onChange={(e) => setReference(e.target.value)} placeholder="Ej: transferencia del 25-11" />
          </div>
          {error && <p className="alert" role="alert">{error}</p>}
          <div className="checkout__pay">
            <button type="button" className="btn" disabled={!s.transfer || send.isPending} onClick={() => send.mutate()}>
              <Icon name="check" size={16} /> {send.isPending ? 'Enviando…' : `Ya transferí ${formatCLP(open.amount)}`}
            </button>
            <p className="hint">Presiónalo cuando hayas transferido: lo confirmamos y tu suscripción queda pagada.</p>
          </div>
        </>
      )}
      {!open && error && <p className="alert" role="alert">{error}</p>}
    </section>
  )
}

function History({ invoices }: { invoices: Invoice[] }) {
  const { shown, more } = useShowMore('mysub.historial')
  if (!invoices.length) return null
  return (
    <section className="mysub__history" aria-labelledby="mysub-hist-h">
      <h3 id="mysub-hist-h">Pagos de tu suscripción</h3>
      <ul className="email-log">
        {invoices.slice(0, shown).map((i) => (
          <li key={i.id} className="email-log__row">
            <span className="email-log__main">
              <strong>{i.plan_name} · {formatDate(i.period_start)} al {formatDate(i.period_end)}</strong>
              <span className="hint">{i.decided_at ? `Confirmado el ${formatDate(santiagoDate(i.decided_at))}` : ''}{i.discount_code ? ` · código ${i.discount_code}` : ''}</span>
            </span>
            <span className="pay-amount">{formatCLP(i.amount)}</span>
            <span className={`tag tag--inv-${i.status}`}>{invoiceStatusLabel[i.status]}</span>
          </li>
        ))}
      </ul>
      <ShowMore shown={shown} total={invoices.length} onMore={more} noun="pagos" />
    </section>
  )
}
