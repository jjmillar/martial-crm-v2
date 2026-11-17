import { useQuery } from '@tanstack/react-query'
import { Link } from '../../lib/nav'
import { useSchool } from '../../lib/school'
import { formatCLP } from '../../lib/money'
import { formatDate, santiagoDate } from '../../lib/dates'
import { Icon } from '../../ui/Icon'
import { listStudentPayments } from '../pagos/api'
import { latestSubmissions, payHref, submissionsKey } from './api'

// Pagos for students: what they owe (with "Pagar", which opens the payment gateway), what is in review, and
// what they already paid.
export function MisPagos() {
  const { activeSchool, myStudent } = useSchool()
  const id = myStudent?.id
  const pays = useQuery({ queryKey: ['my-payments', id, 'all'], queryFn: () => listStudentPayments(id!), enabled: Boolean(id) })
  const subs = useQuery({ queryKey: submissionsKey(id), queryFn: () => latestSubmissions({ studentId: id }), enabled: Boolean(id) })
  const all = (pays.data ?? []).filter((p) => p.status === 'pendiente' || p.status === 'pagado')
  const owed = all.filter((p) => p.status === 'pendiente')
  const paid = all.filter((p) => p.status === 'pagado')
  const total = owed.filter((p) => subs.data?.get(p.id)?.status !== 'pendiente').reduce((n, p) => n + p.amount, 0)

  return (
    <div className="pagos">
      <header className="page-head">
        <span className="eyebrow">{activeSchool?.name}</span>
        <h1>Mis pagos</h1>
        <p className="hint">{total ? `Tienes ${formatCLP(total)} por pagar.` : 'Estás al día.'}</p>
      </header>
      {(pays.isLoading || subs.isLoading) && <p className="hint">Cargando…</p>}

      {owed.length > 0 && (
        <section className="card form-section" aria-labelledby="mp-owed">
          <h2 id="mp-owed">Por pagar</h2>
          <ul className="my-pays" data-motion>
            {owed.map((p) => {
              const s = subs.data?.get(p.id)
              const review = s?.status === 'pendiente'
              return (
                <li key={p.id} className="my-pay">
                  <span className="my-pay__main">
                    <strong>{p.concept}</strong>
                    <span className="hint">{p.due_date ? `Vence el ${formatDate(p.due_date)}` : 'Sin fecha de vencimiento'}</span>
                    {s?.status === 'rechazada' && <span className="field__error">La escuela no confirmó tu transferencia{s.reject_reason ? `: ${s.reject_reason}` : ''}.</span>}
                  </span>
                  <span className="my-pay__side">
                    <b className="pay-amount">{formatCLP(p.amount)}</b>
                    {review
                      ? <span className="tag tag--review">En revisión</span>
                      : <Link className="btn" to={payHref(p.id)}><Icon name="wallet" size={16} /> Pagar</Link>}
                  </span>
                </li>
              )
            })}
          </ul>
        </section>
      )}

      {paid.length > 0 && (
        <section className="card form-section" aria-labelledby="mp-paid">
          <h2 id="mp-paid">Pagados</h2>
          <ul className="my-pays">
            {paid.map((p) => (
              <li key={p.id} className="my-pay">
                <span className="my-pay__main"><strong>{p.concept}</strong><span className="hint">Pagado el {formatDate(santiagoDate(p.paid_at ?? p.created_at))}</span></span>
                <span className="my-pay__side"><b className="pay-amount">{formatCLP(p.amount)}</b><span className="tag tag--pay-pagado">Pagado</span></span>
              </li>
            ))}
          </ul>
        </section>
      )}
      {pays.isSuccess && all.length === 0 && <div className="card empty"><h2>Sin pagos</h2><p className="hint">Cuando tu escuela registre un cobro, aparecerá aquí.</p></div>}
    </div>
  )
}
