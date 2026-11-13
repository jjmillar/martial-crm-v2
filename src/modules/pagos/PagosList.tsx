import { useMemo, useState } from 'react'
import { Link } from '../../lib/nav'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { useSchool } from '../../lib/school'
import { formatDate, monthTitle, santiagoDate, todayIso } from '../../lib/dates'
import { formatCLP } from '../../lib/money'
import type { PaymentStatus } from '../../lib/database.types'
import { Icon } from '../../ui/Icon'
import { listPayments, methodLabel, paymentsKey, statusLabel } from './api'

type Filter = PaymentStatus | 'todos'
const filters: { id: Filter; label: string }[] = [
  { id: 'pendiente', label: 'Pendientes' },
  { id: 'pagado', label: 'Pagados' },
  { id: 'fallido', label: 'Fallidos' },
  { id: 'reembolsado', label: 'Reembolsados' },
  { id: 'todos', label: 'Todos' },
]
const normalize = (s: string) => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()

export function PagosList() {
  const { activeSchool, role } = useSchool()
  const schoolId = activeSchool?.id
  const isAdmin = role === 'admin' || role === 'ceo'
  // Admins: make sure due enrollment fees exist before listing (the daily job does the same; this is idempotent).
  const fees = useQuery({
    queryKey: ['enrollment-fees-run', schoolId],
    queryFn: async () => { const { error } = await supabase.rpc('generate_enrollment_fees', { p_school_id: schoolId! }); return !error },
    enabled: Boolean(schoolId) && isAdmin && Boolean(activeSchool?.enrollment_fee),
    staleTime: 10 * 60_000,
  })
  const feesReady = !isAdmin || !activeSchool?.enrollment_fee || fees.isFetched
  const q = useQuery({ queryKey: paymentsKey(schoolId), queryFn: () => listPayments(schoolId!), enabled: Boolean(schoolId) && feesReady })
  const [filter, setFilter] = useState<Filter>('pendiente')
  const [search, setSearch] = useState('')

  const thisMonth = todayIso().slice(0, 7)
  const stats = useMemo(() => {
    const all = q.data ?? []
    const paidMonth = all.filter((p) => p.status === 'pagado' && p.paid_at && santiagoDate(p.paid_at).slice(0, 7) === thisMonth)
    const pending = all.filter((p) => p.status === 'pendiente')
    return {
      collected: paidMonth.reduce((a, p) => a + p.amount, 0),
      collectedCount: paidMonth.length,
      pending: pending.reduce((a, p) => a + p.amount, 0),
      pendingCount: pending.length,
    }
  }, [q.data, thisMonth])
  const counts = useMemo(() => Object.fromEntries(filters.map((f) => [f.id, (q.data ?? []).filter((p) => f.id === 'todos' || p.status === f.id).length])) as Record<Filter, number>, [q.data])
  const rows = useMemo(() => {
    const needle = normalize(search.trim())
    return (q.data ?? []).filter((p) => (filter === 'todos' || p.status === filter) && (!needle || normalize(`${p.student?.full_name ?? ''} ${p.concept}`).includes(needle)))
  }, [q.data, filter, search])

  if (!activeSchool) return <p className="page-note">Selecciona una escuela para ver sus pagos.</p>

  return (
    <div className="matriculas">
      <header className="page-head page-head--row">
        <div>
          <span className="eyebrow">{activeSchool.name}</span>
          <h1>Pagos</h1>
        </div>
        {Boolean(q.data?.length) && <Link className="fab" to="nuevo" aria-label="Registrar pago" title="Registrar pago"><Icon name="plus" size={22} /></Link>}
      </header>

      {q.isLoading && <p className="hint">Cargando…</p>}
      {q.isError && <p className="alert">No se pudieron cargar los pagos.</p>}
      {q.data?.length === 0 && (
        <div className="card empty">
          <h2>Aún no hay pagos</h2>
          <p className="hint">Registra mensualidades, matrículas o packs en transferencia o efectivo. Puedes adjuntar el comprobante.</p>
          <Link className="btn" to="nuevo"><Icon name="plus" size={16} /> Registrar pago</Link>
        </div>
      )}

      {Boolean(q.data?.length) && (
        <>
          <div className="kpis">
            <div className="card kpi">
              <span className="eyebrow">Recaudado · {monthTitle(todayIso())}</span>
              <strong>{formatCLP(stats.collected)}</strong>
              <span className="hint">{stats.collectedCount} {stats.collectedCount === 1 ? 'pago' : 'pagos'}</span>
            </div>
            <button type="button" className="card kpi kpi--link" onClick={() => setFilter('pendiente')}>
              <span className="eyebrow">Por confirmar</span>
              <strong>{formatCLP(stats.pending)}</strong>
              <span className="hint">{stats.pendingCount} {stats.pendingCount === 1 ? 'pago pendiente' : 'pagos pendientes'}</span>
            </button>
          </div>
          <div className="toolbar">
            <label className="search">
              <Icon name="search" size={16} />
              <span className="sr-only">Buscar pago</span>
              <input className="input" type="search" placeholder="Buscar por alumno o concepto" value={search} onChange={(e) => setSearch(e.target.value)} />
            </label>
          </div>
          <div className="segmented segmented--wrap segmented--scroll" role="group" aria-label="Filtrar por estado">
            {filters.map((f) => (
              <button key={f.id} type="button" aria-pressed={filter === f.id} onClick={() => setFilter(f.id)}>{f.label} <span>{counts[f.id]}</span></button>
            ))}
          </div>
        </>
      )}
      {Boolean(q.data?.length) && rows.length === 0 && <p className="hint">No hay pagos en este filtro.</p>}

      <ul className="student-list">
        {rows.map((p) => (
          <li key={p.id}>
            <Link className="card student-row" to={p.id}>
              <span className="student-row__main">
                <strong>{p.student?.full_name ?? 'Alumno'}</strong>
                <span className="hint">{p.concept} · {methodLabel[p.method]} · {formatDate(santiagoDate(p.paid_at ?? p.created_at))}{p.receipt_path ? ' · 📎' : ''}</span>
              </span>
              {p.kind === 'matricula' && <span className="tag">Matrícula</span>}
              <span className="pay-amount">{formatCLP(p.amount)}</span>
              <span className={`tag tag--pay-${p.status}`}>{statusLabel[p.status]}</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}
