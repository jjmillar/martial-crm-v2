import { useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useLocation } from '../../lib/nav'
import { usePersisted } from '../../lib/persist'
import { useSchool } from '../../lib/school'
import { monthTitle, todayIso } from '../../lib/dates'
import { formatCLP } from '../../lib/money'
import { Acc } from '../../ui/Accordion'
import { Icon, type IconName } from '../../ui/Icon'
import { openFromHash } from '../../ui/openFromHash'
import { DescuentosSection } from '../descuentos/DescuentosSection'
import { codesKey, listCodes } from '../descuentos/api'
import { InscripcionesSection } from '../matriculas/MatriculasList'
import { countPhase, useSchoolEnrollments, type EnrollFilter } from '../matriculas/data'
import { HistorialSection, PagosSection } from '../pagos/PagosList'
import { paymentStats, useSchoolPayments, type PayFilter } from '../pagos/data'
import { PlanesList } from '../planes/PlanesList'
import { listPlans, plansKey } from '../planes/api'
import { ComisionesSection, EgresosSection, RecurrentesSection } from '../egresos/EgresosSections'
import { useEgresos } from '../egresos/data'
import { expenseStats } from '../egresos/api'

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`

/** Opens a section of the page and brings it into view (the summary cards jump to their list). */
function openSection(id: string) {
  history.replaceState(null, '', `#${id}`)
  openFromHash(`#${id}`)
}

/**
 * Contabilidad: payments, enrollments, plans, discount codes and the history in one place. On top, a summary of the
 * month (collected, still to collect, current enrollments, about to expire): each card opens its list already
 * filtered. Below, one accordion per area (like Miembros and Escuelas), each with its search, filters and "add" button.
 */
export function ContabilidadPage() {
  const { activeSchool, role } = useSchool()
  const location = useLocation()
  const schoolId = activeSchool?.id
  const isAdmin = role === 'admin' || role === 'ceo'
  const { q: pays } = useSchoolPayments()
  const { q: enrolls, withPhase } = useSchoolEnrollments()
  const plans = useQuery({ queryKey: plansKey(schoolId), queryFn: () => listPlans(schoolId!), enabled: Boolean(schoolId) })
  const codes = useQuery({ queryKey: codesKey(schoolId), queryFn: () => listCodes(schoolId!), enabled: Boolean(schoolId) && isAdmin })
  const egr = useEgresos()
  // The filters live here so the summary cards can set them.
  const [payFilter, setPayFilter] = usePersisted<PayFilter>('pagos.filtro', 'pendiente')
  const [enrollFilter, setEnrollFilter] = usePersisted<EnrollFilter>('inscripciones.filtro', 'vigentes')

  useEffect(() => {
    const t = setTimeout(() => openFromHash(location.hash), 50)
    return () => clearTimeout(t)
  }, [location.hash])

  if (!activeSchool) return <p className="page-note">Selecciona una escuela para ver su contabilidad.</p>

  const st = pays.data ? paymentStats(pays.data) : null
  const current = countPhase(withPhase, 'vigentes')
  const expiring = countPhase(withPhase, 'por_vencer')
  const expired = countPhase(withPhase, 'vencida')
  const unpaid = countPhase(withPhase, 'pendiente')
  const activePlans = plans.data?.filter((p) => p.active).length
  const loading = 'Cargando…'
  const ex = egr.expenses.data ? expenseStats(egr.expenses.data) : null
  const teacherRules = egr.rules.data?.rules.filter((r) => r.teacher_id && r.active).length ?? 0
  const autoTeachers = egr.rules.data ? [...egr.rules.data.modes.values()].filter((m) => m === 'automatica').length : 0
  const recurring = egr.rules.data?.rules.filter((r) => !r.teacher_id && r.active) ?? []

  return (
    <div className="miembros contabilidad">
      <header className="page-head">
        <h1>Contabilidad</h1>
        <p className="hint">Resumen del mes y, debajo, cada área. Toca un número para ver su lista.</p>
      </header>

      <section className="conta-kpis" aria-label={`Resumen de ${monthTitle(todayIso())}`}>
        <Kpi icon="wallet" label={`Recaudado · ${monthTitle(todayIso())}`} value={st ? formatCLP(st.collected) : '—'}
          hint={st ? plural(st.collectedCount, 'pago confirmado', 'pagos confirmados') : loading}
          onClick={() => { setPayFilter('pagado'); openSection('pagos') }} />
        <Kpi icon="clock" label="Por cobrar" value={st ? formatCLP(st.pending) : '—'} tone={st?.pendingCount ? 'warn' : undefined}
          hint={st ? plural(st.pendingCount, 'pago pendiente', 'pagos pendientes') : loading}
          onClick={() => { setPayFilter('pendiente'); openSection('pagos') }} />
        <Kpi icon="enroll" label="Inscripciones vigentes" value={enrolls.data ? String(current) : '—'}
          hint={enrolls.data ? (unpaid ? `${plural(unpaid, 'inscripción', 'inscripciones')} por pagar` : 'Ninguna por pagar') : loading}
          onClick={() => { setEnrollFilter('vigentes'); openSection('inscripciones') }} />
        <Kpi icon="calendar" label="Por vencer" value={enrolls.data ? String(expiring) : '—'} tone={expiring || expired ? 'warn' : undefined}
          hint={enrolls.data ? (expired ? `${plural(expired, 'vencida', 'vencidas')} por renovar` : 'Ninguna vencida') : loading}
          onClick={() => { setEnrollFilter(expiring || !expired ? 'por_vencer' : 'vencida'); openSection('inscripciones') }} />
      </section>

      <div className="miembros__sections">
        <h2 className="acc-group">Movimientos</h2>
        <Acc id="pagos" icon="wallet" title="Pagos"
          hint={st ? `${plural(st.pendingCount, 'pendiente', 'pendientes')} · ${formatCLP(st.collected)} este mes` : loading}>
          <PagosSection filter={payFilter} setFilter={setPayFilter} />
        </Acc>
        <Acc id="inscripciones" icon="enroll" title="Inscripciones"
          hint={enrolls.data ? `${plural(current, 'vigente', 'vigentes')} · ${plural(expiring, 'por vencer', 'por vencer')}` : loading}>
          <InscripcionesSection filter={enrollFilter} setFilter={setEnrollFilter} />
        </Acc>
        <Acc id="acc-historial" icon="clock" title="Historial" hint="Últimas transacciones de la escuela">
          <HistorialSection />
        </Acc>

        {isAdmin && (
          <>
            <h2 className="acc-group">Egresos</h2>
            <Acc id="egresos" icon="bank" title="Egresos"
              hint={ex ? `${ex.pendingCount ? `${plural(ex.pendingCount, 'por pagar', 'por pagar')} · ${formatCLP(ex.pending)}` : 'Nada por pagar'} · ${formatCLP(ex.paid)} pagado este mes` : loading}>
              <EgresosSection />
            </Acc>
            <Acc id="acc-comisiones" icon="teacher" title="Comisiones de profesores"
              hint={egr.rules.data ? (autoTeachers ? `${plural(autoTeachers, 'profesor automático', 'profesores automáticos')} · ${plural(teacherRules, 'regla', 'reglas')}` : 'Todos en pago manual') : loading}>
              <ComisionesSection />
            </Acc>
            <Acc id="acc-recurrentes" icon="calendar" title="Pagos recurrentes"
              hint={egr.rules.data ? (recurring.length ? `${plural(recurring.length, 'activo', 'activos')} · ${formatCLP(recurring.reduce((a, r) => a + r.amount, 0))} al mes` : 'Arriendo, cuentas, sueldos…') : loading}>
              <RecurrentesSection />
            </Acc>
          </>
        )}

        <h2 className="acc-group">Qué ofreces</h2>
        <Acc id="acc-planes" icon="plan" title="Planes"
          hint={plans.data ? `${plural(activePlans ?? 0, 'plan activo', 'planes activos')}${plans.data.some((p) => p.is_default && p.active) ? ' · con predeterminado' : ''}` : loading}>
          <PlanesList />
        </Acc>
        {isAdmin && (
          <Acc id="acc-descuentos" icon="tag" title="Códigos de descuento"
            hint={codes.data ? plural(codes.data.length, 'código', 'códigos') : loading}>
            <DescuentosSection />
          </Acc>
        )}
      </div>
    </div>
  )
}

function Kpi({ icon, label, value, hint, onClick, tone }: { icon: IconName; label: string; value: string; hint: string; onClick: () => void; tone?: 'warn' }) {
  return (
    <button type="button" className={`card conta-kpi${tone ? ` is-${tone}` : ''}`} onClick={onClick}>
      <span className="conta-kpi__label"><Icon name={icon} size={16} /> {label}</span>
      <strong>{value}</strong>
      <span className="hint">{hint}</span>
    </button>
  )
}
