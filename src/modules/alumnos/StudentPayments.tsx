import { Link } from '../../lib/nav'
import { useQuery } from '@tanstack/react-query'
import { formatDate, santiagoDate } from '../../lib/dates'
import { formatCLP } from '../../lib/money'
import { Icon } from '../../ui/Icon'
import { listStudentPayments, statusLabel } from '../pagos/api'

/** Payments of one student, shown inside the student form. */
export function StudentPayments({ studentId }: { studentId: string }) {
  const q = useQuery({ queryKey: ['student-payments', studentId], queryFn: () => listStudentPayments(studentId) })
  return (
    <section className="card form-section">
      <div className="ajustes__section-head">
        <h2>Pagos</h2>
        <Link className="btn btn--ghost" to={`/app/pagos/nuevo?alumno=${studentId}`}><Icon name="plus" size={16} /> Registrar pago</Link>
      </div>
      {q.isLoading && <p className="hint">Cargando…</p>}
      {q.data?.length === 0 && <p className="hint">Sin pagos registrados.</p>}
      {Boolean(q.data?.length) && (
        <ul className="email-log">
          {q.data!.slice(0, 12).map((p) => (
            <li key={p.id} className="email-log__row">
              <Link className="email-log__main link-plain" to={`/app/pagos/${p.id}`}>
                <strong>{formatCLP(p.amount)} · {p.concept}</strong>
                <span className="hint">{formatDate(santiagoDate(p.paid_at ?? p.created_at))}</span>
              </Link>
              <span className={`tag tag--pay-${p.status}`}>{statusLabel[p.status]}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
