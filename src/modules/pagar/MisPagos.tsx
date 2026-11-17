import { useQuery } from '@tanstack/react-query'
import { Link } from '../../lib/nav'
import { useSchool } from '../../lib/school'
import { formatCLP } from '../../lib/money'
import { formatDate } from '../../lib/dates'
import { Icon } from '../../ui/Icon'
import { listStudentPayments } from '../pagos/api'
import { latestSubmissions, listMySubmissions, payHref, submissionsKey } from './api'
import { PlanesList } from '../planes/PlanesList'
import { PaymentHistory } from '../pagos/PaymentHistory'

// "Pagos y planes" for students, all on one page: what they owe (with "Pagar", which opens the payment gateway), the
// school's plans, and at the end the history (paid payments and transfer reports in review or rejected).
export function MisPagos() {
  const { activeSchool, myStudent } = useSchool()
  const id = myStudent?.id
  const pays = useQuery({ queryKey: ['my-payments', id, 'all'], queryFn: () => listStudentPayments(id!), enabled: Boolean(id) })
  const subs = useQuery({ queryKey: submissionsKey(id), queryFn: () => latestSubmissions({ studentId: id }), enabled: Boolean(id) })
  const reports = useQuery({ queryKey: ['payment-submissions', id, 'all'], queryFn: () => listMySubmissions(id!), enabled: Boolean(id) })
  const all = (pays.data ?? []).filter((p) => p.status === 'pendiente' || p.status === 'pagado')
  const owed = all.filter((p) => p.status === 'pendiente')
  const total = owed.filter((p) => subs.data?.get(p.id)?.status !== 'pendiente').reduce((n, p) => n + p.amount, 0)

  return (
    <div className="pagos my-pays-page">
      <header className="page-head">
        <span className="eyebrow">{activeSchool?.name}</span>
        <h1>Pagos y planes</h1>
        {total > 0 && <p className="hint">Tienes {formatCLP(total)} por pagar.</p>}
      </header>
      {(pays.isLoading || subs.isLoading) && <p className="hint">Cargando…</p>}

      {pays.isSuccess && (
        <section className="pp-section" id="por-pagar" aria-labelledby="mp-owed">
          <div className="pp-section__head">
            <div>
              <h2 id="mp-owed">Por pagar</h2>
              {owed.length > 0 && <p className="hint">Paga por transferencia: tu escuela la confirma y queda como pagado.</p>}
            </div>
          </div>
          {owed.length === 0 ? (
            <div className="card plan-card pay-card pay-card--ok">
              <span className="eyebrow">Sin pagos pendientes</span>
              <h3 className="plan-card__name">Estás al día</h3>
              <p className="hint">Cuando tu escuela registre un cobro aparecerá aquí, listo para pagar.</p>
            </div>
          ) : (
            <ul className="plan-grid pay-grid" data-motion>
              {owed.map((p) => {
                const s = subs.data?.get(p.id)
                const review = s?.status === 'pendiente'
                const rejected = s?.status === 'rechazada'
                return (
                  <li key={p.id}>
                    <article className={`card plan-card pay-card${review ? ' is-review' : ''}${rejected ? ' is-rejected' : ''}`}>
                      <div className="plan-card__tags">
                        <span className="eyebrow">{p.due_date ? `Vence el ${formatDate(p.due_date)}` : 'Sin vencimiento'}</span>
                        {review && <span className="tag tag--review">En revisión</span>}
                        {rejected && <span className="tag tag--pay-fallido">Rechazado</span>}
                      </div>
                      <div className="pay-card__row">
                        <h3 className="plan-card__name">{p.concept}</h3>
                        <p className="plan-card__price">{formatCLP(p.amount)}</p>
                      </div>
                      {rejected && <p className="pay-card__note">{s?.reject_reason ? `Motivo: ${s.reject_reason}` : 'La escuela no pudo confirmar tu transferencia.'}</p>}
                      <div className="pay-card__action">
                        {review
                          ? <p className="hint">Informaste la transferencia. Tu escuela la está revisando.</p>
                          : <Link className="btn btn--block" to={payHref(p.id)}><Icon name="wallet" size={16} /> {rejected ? 'Pagar de nuevo' : 'Pagar'}</Link>}
                      </div>
                    </article>
                  </li>
                )
              })}
            </ul>
          )}
        </section>
      )}

      <PlanesList />
      {pays.isSuccess && <PaymentHistory payments={pays.data} reports={reports.data ?? []} />}
    </div>
  )
}
