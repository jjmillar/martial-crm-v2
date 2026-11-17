import { useMemo, useState, type ReactNode } from 'react'
import { Link } from '../../lib/nav'
import { formatCLP } from '../../lib/money'
import { formatDate, santiagoDate } from '../../lib/dates'
import type { Submission } from '../pagar/api'
import { methodLabel, type PaymentRow } from './api'

// History at the end of "Pagos y planes": a short summary (last 3 transactions), "Mostrar más" shows the last 10,
// then each "Cargar más transacciones" adds 10 more. Staff see who paid and open the payment; students also see
// their transfer reports in review or rejected (with the reason).
const FIRST = 3
const PAGE = 10

type Entry =
  | { kind: 'payment'; at: string; p: PaymentRow }
  | { kind: 'report'; at: string; s: Submission; concept: string }

export function PaymentHistory({ payments, reports = [], staff = false }: { payments: PaymentRow[]; reports?: (Submission & { concept: string })[]; staff?: boolean }) {
  const [shown, setShown] = useState(FIRST)
  const entries = useMemo<Entry[]>(() => [
    ...payments.filter((p) => p.status === 'pagado' || p.status === 'reembolsado')
      .map((p) => ({ kind: 'payment' as const, at: p.paid_at ?? p.updated_at ?? p.created_at, p })),
    ...reports.filter((s) => s.status !== 'aprobada') // approved ones show as the paid payment
      .map((s) => ({ kind: 'report' as const, at: s.decided_at ?? s.created_at, s, concept: s.concept })),
  ].sort((a, b) => b.at.localeCompare(a.at)), [payments, reports])

  const visible = entries.slice(0, shown)
  const left = entries.length - visible.length

  return (
    <section className="pp-section" id="historial" aria-labelledby="historial-h">
      <div className="pp-section__head">
        <div>
          <h2 id="historial-h">Historial</h2>
          <p className="hint">{entries.length ? `Últimas transacciones${staff ? ' de la escuela' : ''}.` : staff ? 'Los pagos que confirmes aparecerán aquí.' : 'Cuando tu escuela confirme tus pagos aparecerán aquí.'}</p>
        </div>
      </div>
      {entries.length > 0 && (
        <div className="card pay-history">
          <ul className="pay-history__list" data-motion>
            {visible.map((e) => e.kind === 'payment' ? (
              <li key={e.p.id}>
                <Row
                  to={staff ? `/app/pagos/${e.p.id}` : null}
                  title={staff ? e.p.student?.full_name ?? 'Alumno' : e.p.concept}
                  detail={[staff ? e.p.concept : null, methodLabel[e.p.method], formatDate(santiagoDate(e.at))].filter(Boolean).join(' · ')}
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
          {left > 0 && (
            <div className="pay-history__more">
              <button type="button" className="btn btn--ghost" onClick={() => setShown((n) => (n < PAGE ? PAGE : n + PAGE))}>
                {shown < PAGE ? 'Mostrar más' : 'Cargar más transacciones'}
              </button>
              <span className="hint">Mostrando {visible.length} de {entries.length}</span>
            </div>
          )}
        </div>
      )}
    </section>
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
