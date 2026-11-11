import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useSchool } from '../../lib/school'
import { formatDate, daysUntil } from '../../lib/dates'
import { formatCLP } from '../../lib/money'
import { Icon } from '../../ui/Icon'
import { enrollmentsKey, listEnrollments, phaseLabel, phaseOf, type Phase } from './api'

type Filter = 'vigentes' | 'por_vencer' | 'vencida' | 'pausada' | 'cancelada' | 'todas'
const filters: { id: Filter; label: string }[] = [
  { id: 'vigentes', label: 'Vigentes' },
  { id: 'por_vencer', label: 'Por vencer' },
  { id: 'vencida', label: 'Vencidas' },
  { id: 'pausada', label: 'Pausadas' },
  { id: 'cancelada', label: 'Canceladas' },
  { id: 'todas', label: 'Todas' },
]
const matches = (f: Filter, p: Phase) =>
  f === 'todas' || (f === 'vigentes' ? p === 'activa' || p === 'por_vencer' : f === p)

const normalize = (s: string) => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()

export function MatriculasList() {
  const { activeSchool } = useSchool()
  const schoolId = activeSchool?.id
  const q = useQuery({ queryKey: enrollmentsKey(schoolId), queryFn: () => listEnrollments(schoolId!), enabled: Boolean(schoolId) })
  const [filter, setFilter] = useState<Filter>('vigentes')
  const [search, setSearch] = useState('')

  const withPhase = useMemo(() => (q.data ?? []).map((e) => ({ ...e, phase: phaseOf(e) })), [q.data])
  const counts = useMemo(() => Object.fromEntries(filters.map((f) => [f.id, withPhase.filter((e) => matches(f.id, e.phase)).length])) as Record<Filter, number>, [withPhase])
  const rows = useMemo(() => {
    const needle = normalize(search.trim())
    return withPhase.filter((e) => matches(filter, e.phase) && (!needle || normalize(`${e.student?.full_name ?? ''} ${e.plan?.name ?? ''}`).includes(needle)))
  }, [withPhase, filter, search])

  if (!activeSchool) return <p className="page-note">Selecciona una escuela para ver sus matrículas.</p>

  return (
    <div className="matriculas">
      <header className="page-head page-head--row">
        <div>
          <span className="eyebrow">{activeSchool.name}</span>
          <h1>Matrículas</h1>
        </div>
        {Boolean(q.data?.length) && <Link className="fab" to="nueva" aria-label="Nueva matrícula" title="Nueva matrícula"><Icon name="plus" size={22} /></Link>}
      </header>

      {q.isLoading && <p className="hint">Cargando…</p>}
      {q.isError && <p className="alert">No se pudieron cargar las matrículas.</p>}
      {q.data?.length === 0 && (
        <div className="card empty">
          <h2>Aún no hay matrículas</h2>
          <p className="hint">Una matrícula une a un alumno con un plan: fija su precio y calcula el vencimiento.</p>
          <Link className="btn" to="nueva"><Icon name="plus" size={16} /> Matricular alumno</Link>
        </div>
      )}

      {Boolean(q.data?.length) && (
        <>
          <div className="toolbar">
            <label className="search">
              <Icon name="search" size={16} />
              <span className="sr-only">Buscar matrícula</span>
              <input className="input" type="search" placeholder="Buscar por alumno o plan" value={search} onChange={(e) => setSearch(e.target.value)} />
            </label>
          </div>
          <div className="segmented segmented--wrap segmented--scroll" role="group" aria-label="Filtrar por estado">
            {filters.map((f) => (
              <button key={f.id} type="button" aria-pressed={filter === f.id} onClick={() => setFilter(f.id)}>
                {f.label} <span>{counts[f.id]}</span>
              </button>
            ))}
          </div>
        </>
      )}
      {Boolean(q.data?.length) && rows.length === 0 && <p className="hint">No hay matrículas en este filtro.</p>}

      <ul className="student-list">
        {rows.map((e) => {
          const left = e.ends_at ? daysUntil(e.ends_at) : null
          return (
            <li key={e.id}>
              <Link className="card student-row" to={e.id}>
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
    </div>
  )
}
