import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useSchool } from '../../lib/school'
import { formatCLP } from '../../lib/money'
import { Icon } from '../../ui/Icon'
import { listSpecialties, specialtiesKey } from '../profesores/api'
import { listPlans, plansKey } from './api'
import { cycleInfo, planFeatures } from './cycles'

export function PlanesList() {
  const { activeSchool, role } = useSchool()
  const schoolId = activeSchool?.id
  const canEdit = role === 'admin' || role === 'ceo'
  const plans = useQuery({ queryKey: plansKey(schoolId), queryFn: () => listPlans(schoolId!), enabled: Boolean(schoolId) })
  const specialties = useQuery({ queryKey: specialtiesKey(schoolId), queryFn: () => listSpecialties(schoolId!), enabled: Boolean(schoolId) })
  const [showInactive, setShowInactive] = useState(false)

  const spName = useMemo(() => new Map((specialties.data ?? []).map((s) => [s.id, s.name])), [specialties.data])
  const inactiveCount = (plans.data ?? []).filter((p) => !p.active).length
  const rows = (plans.data ?? []).filter((p) => showInactive || p.active)

  if (!activeSchool) return <p className="page-note">Selecciona una escuela para ver sus planes.</p>

  return (
    <div className="planes">
      <header className="page-head page-head--row">
        <div>
          <span className="eyebrow">{activeSchool.name}</span>
          <h1>Planes</h1>
          {Boolean(plans.data?.length) && <p className="hint">Lo que ofrece tu escuela. El plan predeterminado se sugiere primero al matricular.</p>}
        </div>
        {canEdit && Boolean(plans.data?.length) && (
          <Link className="fab" to="nuevo" aria-label="Nuevo plan" title="Nuevo plan"><Icon name="plus" size={22} /></Link>
        )}
      </header>

      {inactiveCount > 0 && (
        <label className="switch switch--inline">
          <input type="checkbox" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} />
          <span>Mostrar inactivos ({inactiveCount})</span>
        </label>
      )}

      {plans.isLoading && <p className="hint">Cargando…</p>}
      {plans.isError && <p className="alert">No se pudieron cargar los planes.</p>}
      {plans.data?.length === 0 && (
        <div className="card empty">
          <h2>Aún no hay planes</h2>
          {canEdit ? (
            <>
              <p className="hint">Define lo que ofreces: mensualidades, packs de clases o una clase de prueba gratis.</p>
              <Link className="btn" to="nuevo"><Icon name="plus" size={16} /> Crear plan</Link>
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
              <Link className={`card plan-card${p.is_default ? ' is-default' : ''}${p.active ? '' : ' is-off'}`} to={p.id}>
                <div className="plan-card__tags">
                  <span className="eyebrow">{p.specialty_id ? spName.get(p.specialty_id) ?? 'Disciplina' : 'Todas las disciplinas'}</span>
                  {p.is_default && <span className="tag tag--accent">Predeterminado</span>}
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
              </Link>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
