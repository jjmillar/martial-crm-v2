import { useMemo, useState } from 'react'
import { Link } from '../../lib/nav'
import { useQuery } from '@tanstack/react-query'
import { useSchool } from '../../lib/school'
import { hhmm, weekdayShort, weekdays } from '../../lib/weekdays'
import { Icon } from '../../ui/Icon'
import { Toggle } from '../../ui/Toggle'
import { classesKey, levelLabel, listClasses, listTags } from './api'

const normalize = (s: string) => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()

export function ClasesList() {
  const { activeSchool, role } = useSchool()
  const schoolId = activeSchool?.id
  const canEdit = role === 'admin' || role === 'ceo'
  const classes = useQuery({ queryKey: classesKey(schoolId), queryFn: () => listClasses(schoolId!), enabled: Boolean(schoolId) })
  const tags = useQuery({ queryKey: ['tags', schoolId], queryFn: () => listTags(schoolId!), enabled: Boolean(schoolId) })
  const [q, setQ] = useState('')
  const [day, setDay] = useState(0)
  const [showInactive, setShowInactive] = useState(false)

  const tagById = useMemo(() => new Map((tags.data ?? []).map((t) => [t.id, t])), [tags.data])
  const rows = useMemo(() => {
    const needle = normalize(q.trim())
    return (classes.data ?? []).filter((c) =>
      (showInactive || c.active) &&
      (!day || c.schedules.some((s) => s.weekday === day)) &&
      (!needle || normalize(`${c.name} ${c.teacher?.full_name ?? ''} ${c.specialty?.name ?? ''}`).includes(needle)),
    )
  }, [classes.data, q, day, showInactive])
  const inactiveCount = (classes.data ?? []).filter((c) => !c.active).length

  if (!activeSchool) return <p className="page-note">Selecciona una escuela para ver sus clases.</p>

  return (
    <div className="matriculas">
      <header className="page-head page-head--row">
        <div>
          <span className="eyebrow">{activeSchool.name}</span>
          <h1>Clases</h1>
        </div>
        {canEdit && Boolean(classes.data?.length) && <Link className="fab" to="nueva" aria-label="Nueva clase" title="Nueva clase"><Icon name="plus" size={22} /></Link>}
      </header>

      {classes.isLoading && <p className="hint">Cargando…</p>}
      {classes.isError && <p className="alert">No se pudieron cargar las clases.</p>}
      {classes.data?.length === 0 && (
        <div className="card empty">
          <h2>Aún no hay clases</h2>
          {canEdit ? (
            <>
              <p className="hint">Crea tus clases con profesor, nivel y horarios semanales. Aparecerán en el calendario y en asistencia.</p>
              <Link className="btn" to="nueva"><Icon name="plus" size={16} /> Crear clase</Link>
            </>
          ) : <p className="hint">Un administrador de la escuela puede crearlas.</p>}
        </div>
      )}

      {Boolean(classes.data?.length) && (
        <>
          <div className="toolbar">
            <label className="search">
              <Icon name="search" size={16} />
              <span className="sr-only">Buscar clase</span>
              <input className="input" type="search" placeholder="Buscar por clase, profesor o disciplina" value={q} onChange={(e) => setQ(e.target.value)} />
            </label>
            {inactiveCount > 0 && (
              <Toggle inline checked={showInactive} onChange={setShowInactive} label={`Mostrar inactivas (${inactiveCount})`} />
            )}
          </div>
          <div className="segmented segmented--wrap segmented--scroll" role="group" aria-label="Filtrar por día">
            <button type="button" aria-pressed={day === 0} onClick={() => setDay(0)}>Todos</button>
            {weekdays.map((w) => (
              <button key={w.n} type="button" aria-pressed={day === w.n} onClick={() => setDay(w.n)}>{w.short}</button>
            ))}
          </div>
        </>
      )}
      {Boolean(classes.data?.length) && rows.length === 0 && <p className="hint">Ninguna clase coincide con los filtros.</p>}

      <ul className="class-grid">
        {rows.map((c) => (
          <li key={c.id}>
            <Link className={`card class-card${c.active ? '' : ' is-off'}`} to={c.id} style={{ ['--class-color' as string]: c.color }}>
              <div className="plan-card__tags">
                <span className="eyebrow">{c.specialty?.name ?? 'Clase'}</span>
                <span className="tag">{levelLabel[c.level]}</span>
                {!c.active && <span className="tag">Inactiva</span>}
              </div>
              <strong className="teacher-card__name">{c.name}</strong>
              <span className="hint">{[c.teacher?.full_name ?? 'Sin profesor', c.room, c.capacity ? `cupo ${c.capacity}` : null].filter(Boolean).join(' · ')}</span>
              {c.schedules.length > 0 ? (
                <ul className="slots">
                  {c.schedules.map((s) => <li key={s.id}><b>{weekdayShort(s.weekday)}</b> {hhmm(s.start_time)}–{hhmm(s.end_time)}</li>)}
                </ul>
              ) : <span className="hint">Sin horarios</span>}
              {c.tag_ids.length > 0 && (
                <ul className="chips">
                  {c.tag_ids.map((id) => tagById.get(id) && <li key={id}>{tagById.get(id)!.icon} {tagById.get(id)!.label}</li>)}
                </ul>
              )}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}
