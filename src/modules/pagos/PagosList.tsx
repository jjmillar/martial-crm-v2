import { useEffect, useMemo } from 'react'
import { usePersisted } from '../../lib/persist'
import { Link, useNavigate } from '../../lib/nav'
import { useSchool } from '../../lib/school'
import { formatDate, santiagoDate } from '../../lib/dates'
import { formatCLP } from '../../lib/money'
import { Icon } from '../../ui/Icon'
import { methodLabel, statusLabel } from './api'
import { useSchoolPayments, type PayFilter } from './data'
import { PaidTag } from '../pagar/PaidTag'
import { doubleChecked } from '../pagar/api'
import { MisPagos } from '../pagar/MisPagos'
import { PaymentHistory } from './PaymentHistory'
import { ShowMore } from '../../ui/ShowMore'
import { useShowMore } from '../../ui/useShowMore'

type Filter = PayFilter
const filters: { id: Filter; label: string }[] = [
  { id: 'pendiente', label: 'Pendientes' },
  { id: 'pagado', label: 'Pagados' },
  { id: 'fallido', label: 'Fallidos' },
  { id: 'reembolsado', label: 'Reembolsados' },
  { id: 'todos', label: 'Todos' },
]
const normalize = (s: string) => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()

/** /app/pagos: a student's own payments and plans ("Pagos y planes"). Staff work in Contabilidad → Pagos. */
export function PagosList() {
  const { role } = useSchool()
  const navigate = useNavigate()
  const staff = role !== null && role !== 'alumno'
  useEffect(() => { if (staff) navigate('/app/contabilidad#pagos', { replace: true }) }, [staff, navigate])
  return role === 'alumno' ? <MisPagos /> : null
}

/** Contabilidad → Pagos: search, filter by status, 10 at a time, "Registrar pago". */
export function PagosSection({ filter, setFilter }: { filter: Filter; setFilter: (f: Filter) => void }) {
  const { q, subs } = useSchoolPayments()
  const [search, setSearch] = usePersisted('pagos.q', '', 'session')
  const { shown, more } = useShowMore('pagos.mostrar', 10)

  const counts = useMemo(() => Object.fromEntries(filters.map((f) => [f.id, (q.data ?? []).filter((p) => f.id === 'todos' || p.status === f.id).length])) as Record<Filter, number>, [q.data])
  const rows = useMemo(() => {
    const needle = normalize(search.trim())
    return (q.data ?? []).filter((p) => (filter === 'todos' || p.status === filter) && (!needle || normalize(`${p.student?.full_name ?? ''} ${p.concept}`).includes(needle)))
  }, [q.data, filter, search])

  return (
    <div className="conta-list">
      {q.isLoading && <p className="hint">Cargando…</p>}
      {q.isError && <p className="alert">No se pudieron cargar los pagos.</p>}
      {q.data?.length === 0 && (
        <div className="card empty">
          <h2>Aún no hay pagos</h2>
          <p className="hint">Registra mensualidades, matrículas o packs en transferencia o efectivo. Puedes adjuntar el comprobante.</p>
          <Link className="btn" to="/app/pagos/nuevo"><Icon name="plus" size={16} /> Registrar pago</Link>
        </div>
      )}

      {Boolean(q.data?.length) && (
        <>
          <div className="toolbar">
            <label className="search">
              <Icon name="search" size={16} />
              <span className="sr-only">Buscar pago</span>
              <input className="input" type="search" placeholder="Buscar por alumno o concepto" value={search} onChange={(e) => setSearch(e.target.value)} />
            </label>
            <Link className="btn" to="/app/pagos/nuevo"><Icon name="plus" size={16} /> Registrar pago</Link>
          </div>
          <div className="segmented segmented--wrap segmented--scroll" role="group" aria-label="Filtrar pagos por estado">
            {filters.map((f) => (
              <button key={f.id} type="button" aria-pressed={filter === f.id} onClick={() => setFilter(f.id)}>{f.label} <span>{counts[f.id]}</span></button>
            ))}
          </div>
        </>
      )}
      {Boolean(q.data?.length) && rows.length === 0 && <p className="hint">No hay pagos en este filtro.</p>}

      <ul className="student-list">
        {rows.slice(0, shown).map((p) => (
          <li key={p.id}>
            <Link className="card student-row" to={`/app/pagos/${p.id}`}>
              <span className="student-row__main">
                <strong>{p.student?.full_name ?? 'Alumno'}</strong>
                <span className="hint">{p.concept} · {methodLabel[p.method]} · {formatDate(santiagoDate(p.paid_at ?? p.created_at))}{p.receipt_path ? ' · 📎' : ''}</span>
              </span>
              {p.kind === 'matricula' && <span className="tag">Matrícula</span>}
              <span className="pay-amount">{formatCLP(p.amount)}</span>
              {p.status === 'pendiente' && subs.data?.get(p.id)?.status === 'pendiente'
                ? <span className="tag tag--review">Por confirmar</span>
                : p.status === 'pagado' ? <PaidTag double={subs.data?.get(p.id)?.status === 'aprobada'} />
                : <span className={`tag tag--pay-${p.status}`}>{statusLabel[p.status]}</span>}
            </Link>
          </li>
        ))}
      </ul>
      <ShowMore shown={shown} total={rows.length} onMore={more} label="Mostrar más" />
    </div>
  )
}

/** Contabilidad → Historial: the latest transactions of the school. */
export function HistorialSection() {
  const { q, subs } = useSchoolPayments()
  if (!q.isSuccess) return <p className="hint">Cargando…</p>
  return <PaymentHistory payments={q.data} staff doubleIds={doubleChecked(subs.data)} />
}
