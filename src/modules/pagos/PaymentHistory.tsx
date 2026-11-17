import { useMemo, type ReactNode } from 'react'
import { Link } from '../../lib/nav'
import { formatCLP } from '../../lib/money'
import { formatDate, monthTitle, santiagoDate } from '../../lib/dates'
import type { Submission } from '../pagar/api'
import { methodLabel, type PaymentRow } from './api'

// Payment history grouped by month (newest first), with each month's total. Staff see who paid and open the
// payment; students also see their transfer reports that are in review or were rejected (with the reason).
const cap = (t: string) => t.charAt(0).toUpperCase() + t.slice(1)

type Entry =
  | { kind: 'payment'; at: string; p: PaymentRow }
  | { kind: 'report'; at: string; s: Submission; concept: string }

export function PaymentHistory({ payments, reports = [], staff = false }: { payments: PaymentRow[]; reports?: (Submission & { concept: string })[]; staff?: boolean }) {
  const months = useMemo(() => {
    const entries: Entry[] = [
      ...payments.filter((p) => p.status === 'pagado' || p.status === 'reembolsado')
        .map((p) => ({ kind: 'payment' as const, at: santiagoDate(p.paid_at ?? p.updated_at ?? p.created_at), p })),
      ...reports.filter((s) => s.status !== 'aprobada') // approved ones show as the paid payment
        .map((s) => ({ kind: 'report' as const, at: santiagoDate(s.decided_at ?? s.created_at), s, concept: s.concept })),
    ].sort((a, b) => b.at.localeCompare(a.at))
    const byMonth = new Map<string, Entry[]>()
    for (const e of entries) byMonth.set(e.at.slice(0, 7), [...(byMonth.get(e.at.slice(0, 7)) ?? []), e])
    return [...byMonth.entries()].map(([month, list]) => ({
      month,
      list,
      total: list.reduce((n, e) => n + (e.kind === 'payment' && e.p.status === 'pagado' ? e.p.amount : 0), 0),
      count: list.filter((e) => e.kind === 'payment' && e.p.status === 'pagado').length,
    }))
  }, [payments, reports])

  if (months.length === 0) {
    return (
      <div className="card empty">
        <h2>Sin pagos todavía</h2>
        <p className="hint">{staff ? 'Cuando confirmes pagos aparecerán aquí, ordenados por mes.' : 'Cuando tu escuela confirme tus pagos aparecerán aquí.'}</p>
      </div>
    )
  }

  return (
    <div className="pay-history" data-motion>
      {months.map((m) => (
        <section key={m.month} className="card pay-history__month" aria-label={monthTitle(`${m.month}-01`)}>
          <header className="pay-history__head">
            <h2>{cap(monthTitle(`${m.month}-01`))}</h2>
            {m.count > 0 && (
              <span className="pay-history__total">
                <b>{formatCLP(m.total)}</b>
                <span className="hint">{m.count} {m.count === 1 ? 'pago' : 'pagos'}</span>
              </span>
            )}
          </header>
          <ul className="pay-history__list">
            {m.list.map((e) => e.kind === 'payment' ? (
              <li key={e.p.id}>
                <Row
                  to={staff ? `/app/pagos/${e.p.id}` : null}
                  title={staff ? e.p.student?.full_name ?? 'Alumno' : e.p.concept}
                  detail={[staff ? e.p.concept : null, methodLabel[e.p.method], formatDate(e.at)].filter(Boolean).join(' · ')}
                  amount={e.p.amount}
                  tag={e.p.status === 'pagado' ? <span className="tag tag--pay-pagado">Pagado</span> : <span className="tag tag--pay-reembolsado">Reembolsado</span>}
                />
              </li>
            ) : (
              <li key={e.s.id}>
                <Row
                  to={null}
                  title={e.concept}
                  detail={[`Transferencia informada el ${formatDate(santiagoDate(e.s.created_at))}`, e.s.status === 'rechazada' && e.s.reject_reason ? `Motivo: ${e.s.reject_reason}` : null].filter(Boolean).join(' · ')}
                  amount={e.s.amount}
                  tag={e.s.status === 'pendiente' ? <span className="tag tag--review">En revisión</span> : <span className="tag tag--pay-fallido">Rechazado</span>}
                />
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  )
}

function Row({ to, title, detail, amount, tag }: { to: string | null; title: string; detail: string; amount: number; tag: ReactNode }) {
  const inner = (
    <>
      <span className="pay-history__main"><strong>{title}</strong><span className="hint">{detail}</span></span>
      <span className="pay-history__side"><b className="pay-amount">{formatCLP(amount)}</b>{tag}</span>
    </>
  )
  return to ? <Link className="pay-history__row pay-history__row--link" to={to}>{inner}</Link> : <div className="pay-history__row">{inner}</div>
}
