import { useEffect, useMemo } from 'react'
import { usePersisted } from '../../lib/persist'
import { Link, useNavigate } from '../../lib/nav'
import { formatDate, daysUntil } from '../../lib/dates'
import { formatCLP } from '../../lib/money'
import { Icon } from '../../ui/Icon'
import { ShowMore } from '../../ui/ShowMore'
import { useShowMore } from '../../ui/useShowMore'
import { phaseLabel } from './api'
import { countPhase, ENROLL_FILTERS as filters, matches, useSchoolEnrollments, type EnrollFilter } from './data'

const normalize = (s: string) => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()

/** /app/matriculas: Inscripciones lives in Contabilidad now; old links land there. */
export function MatriculasList() {
  const navigate = useNavigate()
  useEffect(() => { navigate('/app/contabilidad#inscripciones', { replace: true }) }, [navigate])
  return null
}

/** Contabilidad → Inscripciones: search, filter by phase, 10 at a time, "Nueva inscripción". */
export function InscripcionesSection({ filter, setFilter }: { filter: EnrollFilter; setFilter: (f: EnrollFilter) => void }) {
  const { q, withPhase } = useSchoolEnrollments()
  const [search, setSearch] = usePersisted('inscripciones.q', '', 'session')
  const { shown, more } = useShowMore('inscripciones.mostrar', 10)

  const counts = useMemo(() => Object.fromEntries(filters.map((f) => [f.id, countPhase(withPhase, f.id)])) as Record<EnrollFilter, number>, [withPhase])
  const rows = useMemo(() => {
    const needle = normalize(search.trim())
    return withPhase.filter((e) => matches(filter, e.phase) && (!needle || normalize(`${e.student?.full_name ?? ''} ${e.plan?.name ?? ''}`).includes(needle)))
  }, [withPhase, filter, search])

  return (
    <div className="conta-list">
      {q.isLoading && <p className="hint">Cargando…</p>}
      {q.isError && <p className="alert">No se pudieron cargar las inscripciones.</p>}
      {q.data?.length === 0 && (
        <div className="card empty">
          <h2>Aún no hay inscripciones</h2>
          <p className="hint">Una inscripción une a un alumno con un plan: fija su precio y calcula el vencimiento.</p>
          <Link className="btn" to="/app/matriculas/nueva"><Icon name="plus" size={16} /> Matricular alumno</Link>
        </div>
      )}

      {Boolean(q.data?.length) && (
        <>
          <div className="toolbar">
            <label className="search">
              <Icon name="search" size={16} />
              <span className="sr-only">Buscar inscripción</span>
              <input className="input" type="search" placeholder="Buscar por alumno o plan" value={search} onChange={(e) => setSearch(e.target.value)} />
            </label>
            <Link className="btn" to="/app/matriculas/nueva"><Icon name="plus" size={16} /> Nueva inscripción</Link>
          </div>
          <div className="segmented segmented--wrap segmented--scroll" role="group" aria-label="Filtrar inscripciones por estado">
            {filters.map((f) => (
              <button key={f.id} type="button" aria-pressed={filter === f.id} onClick={() => setFilter(f.id)}>
                {f.label} <span>{counts[f.id]}</span>
              </button>
            ))}
          </div>
        </>
      )}
      {Boolean(q.data?.length) && rows.length === 0 && <p className="hint">No hay inscripciones en este filtro.</p>}

      <ul className="student-list">
        {rows.slice(0, shown).map((e) => {
          const left = e.ends_at ? daysUntil(e.ends_at) : null
          return (
            <li key={e.id}>
              <Link className="card student-row" to={`/app/matriculas/${e.id}`}>
                <span className="student-row__main">
                  <strong>{e.student?.full_name ?? 'Alumno'}</strong>
                  <span className="hint">
                    {e.plan?.name} · {formatCLP(e.price)} · {formatDate(e.start_date)}{e.ends_at ? ` → ${formatDate(e.ends_at)}` : ''}
                  </span>
                </span>
                <span className={`tag tag--phase-${e.phase}`}>
                  {phaseLabel[e.phase]}
                  {e.phase === 'por_vencer' && left !== null && ` · ${left === 0 ? 'hoy' : `${left} d`}`}
                </span>
              </Link>
            </li>
          )
        })}
      </ul>
      <ShowMore shown={shown} total={rows.length} onMore={more} label="Mostrar más" />
    </div>
  )
}
