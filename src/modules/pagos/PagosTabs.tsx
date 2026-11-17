import { Link } from '../../lib/nav'
import { usePagosTab, type PagosTab } from './pagosTab'

// "Pagos y planes": one menu item, three tabs. Pagos (what is owed / to confirm), Historial (paid, by month) and
// Planes. Shared by the staff and the student views.
const tabs: { id: PagosTab; label: string; to: string }[] = [
  { id: 'pagos', label: 'Pagos', to: '/app/pagos' },
  { id: 'historial', label: 'Historial', to: '/app/pagos?vista=historial' },
  { id: 'planes', label: 'Planes', to: '/app/planes' },
]

export function PagosTabs() {
  const current = usePagosTab()
  return (
    <nav className="section-tabs" aria-label="Pagos y planes">
      {tabs.map((t) => (
        <Link key={t.id} to={t.to} className="section-tabs__tab" aria-current={current === t.id ? 'page' : undefined}>{t.label}</Link>
      ))}
    </nav>
  )
}
