import { useQuery } from '@tanstack/react-query'
import { Link } from '../../lib/nav'
import { useSchool } from '../../lib/school'
import { formatCLP } from '../../lib/money'
import { formatDate } from '../../lib/dates'
import { Icon } from '../../ui/Icon'
import { listStudentPayments } from '../pagos/api'
import { latestSubmissions, listMySubmissions, payHref, submissionsKey } from './api'
import { PagosTabs } from '../pagos/PagosTabs'
import { usePagosTab } from '../pagos/pagosTab'
import { PaymentHistory } from '../pagos/PaymentHistory'

// "Pagos y planes" for students. Pagos: what they owe (with "Pagar", which opens the payment gateway) and what is in
// review. Historial: what they paid, month by month, plus transfer reports in review or rejected.
export function MisPagos() {
  const { activeSchool, myStudent } = useSchool()
  const id = myStudent?.id
  const pays = useQuery({ queryKey: ['my-payments', id, 'all'], queryFn: () => listStudentPayments(id!), enabled: Boolean(id) })
  const subs = useQuery({ queryKey: submissionsKey(id), queryFn: () => latestSubmissions({ studentId: id }), enabled: Boolean(id) })
  const tab = usePagosTab()
  const reports = useQuery({ queryKey: ['payment-submissions', id, 'all'], queryFn: () => listMySubmissions(id!), enabled: Boolean(id) && tab === 'historial' })
  const all = (pays.data ?? []).filter((p) => p.status === 'pendiente' || p.status === 'pagado')
  const owed = all.filter((p) => p.status === 'pendiente')
  const total = owed.filter((p) => subs.data?.get(p.id)?.status !== 'pendiente').reduce((n, p) => n + p.amount, 0)

  return (
    <div className="pagos my-pays-page">
      <header className="page-head">
        <span className="eyebrow">{activeSchool?.name}</span>
        <h1>Pagos y planes</h1>
        <p className="hint">{total ? `Tienes ${formatCLP(total)} por pagar.` : 'Estás al día.'}</p>
      </header>
      <PagosTabs />
      {(pays.isLoading || subs.isLoading) && <p className="hint">Cargando…</p>}

      {tab === 'historial' && pays.isSuccess && <PaymentHistory payments={pays.data} reports={reports.data ?? []} />}

      {tab === 'pagos' && owed.length === 0 && pays.isSuccess && (
        <div className="card empty">
          <h2>Estás al día</h2>
          <p className="hint">No tienes pagos pendientes. Revisa lo que ya pagaste en Historial.</p>
          <Link className="btn btn--ghost" to="/app/pagos?vista=historial">Ver historial</Link>
        </div>
      )}

      {tab === 'pagos' && owed.length > 0 && (
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

    </div>
  )
}
