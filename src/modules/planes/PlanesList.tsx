import { useMemo, type ReactNode } from 'react'
import { usePersisted } from '../../lib/persist'
import { Link } from '../../lib/nav'
import { useQuery } from '@tanstack/react-query'
import { useSchool } from '../../lib/school'
import { formatCLP } from '../../lib/money'
import { Icon } from '../../ui/Icon'
import { Toggle } from '../../ui/Toggle'
import { artsKey, listArts } from '../artes/api'
import { listPlans, plansKey } from './api'
import { cycleInfo, planFeatures } from './cycles'
import { myEnrollments, type MyEnrollment } from '../portal/api'
import { PlanActions, PlanStatus } from './ContratarPlan'
import { todayIso } from '../../lib/dates'

/** The plans: a section of Contabilidad (staff edit them) and of "Pagos y planes" (students read and contract). */
export function PlanesList() {
  const { activeSchool, role, student: myStudent } = useSchool()
  const schoolId = activeSchool?.id
  const student = role === 'alumno'
  const mine = useQuery({ queryKey: ['my-enrollments', myStudent?.id], queryFn: () => myEnrollments(myStudent!.id), enabled: student && Boolean(myStudent) })
  // The student's enrollment per plan: the active one wins over one waiting for payment.
  const myByPlan = useMemo(() => {
    const m = new Map<string, MyEnrollment>()
    for (const e of mine.data ?? []) {
      if (e.status !== 'activa' && e.status !== 'pendiente') continue
      if (!m.has(e.plan_id) || e.status === 'activa') m.set(e.plan_id, e)
    }
    return m
  }, [mine.data])
  const myPlans = useMemo(() => new Set([...myByPlan.values()].filter((e) => e.status === 'activa' && (!e.ends_at || e.ends_at >= todayIso())).map((e) => e.plan_id)), [myByPlan])
  const canEdit = role === 'admin' || role === 'ceo'
  const plans = useQuery({ queryKey: plansKey(schoolId), queryFn: () => listPlans(schoolId!), enabled: Boolean(schoolId) })
  const arts = useQuery({ queryKey: artsKey(schoolId), queryFn: () => listArts(schoolId!), enabled: Boolean(schoolId) })
  const [showInactive, setShowInactive] = usePersisted('planes.inactivos', false)

  const artName = useMemo(() => new Map((arts.data ?? []).map((a) => [a.id, a.name])), [arts.data])
  const inactiveCount = (plans.data ?? []).filter((p) => !p.active).length
  const rows = (plans.data ?? []).filter((p) => (showInactive && !student) || p.active)

  if (!activeSchool) return null

  return (
    <section className="planes pp-section" id="planes" aria-labelledby="planes-h">
      <div className="pp-section__head">
        <div>
          <h2 id="planes-h">Planes</h2>
          {Boolean(plans.data?.length) && <p className="hint">{student ? 'Elige un plan y contrátalo aquí: lo pagas por transferencia o en efectivo y queda activo cuando tu escuela confirme el pago.' : 'Lo que ofrece tu escuela. El plan predeterminado se sugiere primero al matricular.'}</p>}
        </div>
        {canEdit && Boolean(plans.data?.length) && (
          <Link className="btn btn--ghost" to="/app/planes/nuevo" data-tour="nuevo-plan"><Icon name="plus" size={16} /> Nuevo plan</Link>
        )}
      </div>

      {inactiveCount > 0 && !student && (
        <Toggle inline checked={showInactive} onChange={setShowInactive} label={`Mostrar inactivos (${inactiveCount})`} />
      )}

      {plans.isLoading && <p className="hint">Cargando…</p>}
      {plans.isError && <p className="alert">No se pudieron cargar los planes.</p>}
      {plans.data?.length === 0 && (
        <div className="card empty">
          <h2>Aún no hay planes</h2>
          {canEdit ? (
            <>
              <p className="hint">Define lo que ofreces: mensualidades, packs de clases o una clase de prueba gratis.</p>
              <Link className="btn" to="/app/planes/nuevo" data-tour="nuevo-plan"><Icon name="plus" size={16} /> Crear plan</Link>
            </>
          ) : (
            <p className="hint">Un administrador de la escuela puede crearlos.</p>
          )}
        </div>
      )}

      <ul className="plan-grid">
        {rows.map((p) => {
          const cycle = cycleInfo(p.billing_cycle)
          return (
            <li key={p.id}>
              <PlanCard student={student} className={`card plan-card${p.is_default && !student ? ' is-default' : ''}${myPlans.has(p.id) ? ' is-mine' : ''}${p.active ? '' : ' is-off'}`} to={`/app/planes/${p.id}`}>
                <div className="plan-card__tags">
                  {p.art_id && <span className="tag">{artName.get(p.art_id) ?? 'Arte marcial'}</span>}
                  {student ? <PlanStatus mine={myByPlan.get(p.id)} /> : myPlans.has(p.id) && <span className="tag tag--ok">Tu plan</span>}
                  {p.is_default && !student && <span className="tag tag--accent">Predeterminado</span>}
                  {p.is_trial && <span className="tag">Prueba</span>}
                  {!p.active && <span className="tag">Inactivo</span>}
                </div>
                <h2 className="plan-card__name">{p.name}</h2>
                <p className="plan-card__price">
                  {p.price === 0 ? 'Gratis' : formatCLP(p.price)}
                  {p.price > 0 && <span>{cycle.per}</span>}
                </p>
                <ul className="plan-card__features">
                  {planFeatures(p).map((f) => <li key={f}>{f}</li>)}
                </ul>
                {p.description && <p className="hint plan-card__desc">{p.description}</p>}
                {student && myStudent && <PlanActions plan={p} mine={myByPlan.get(p.id)} studentId={myStudent.id} schoolId={activeSchool.id} />}
              </PlanCard>
            </li>
          )
        })}
      </ul>
    </section>
  )
}

// Staff open a plan to edit it; students only read it.
function PlanCard({ student, className, to, children }: { student: boolean; className: string; to: string; children: ReactNode }) {
  return student ? <div className={className}>{children}</div> : <Link className={className} to={to}>{children}</Link>
}
