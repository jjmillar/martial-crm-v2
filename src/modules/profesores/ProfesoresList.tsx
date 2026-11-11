import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useSchool } from '../../lib/school'
import { beltSwatch } from '../../lib/belts'
import { Icon } from '../../ui/Icon'
import { listSpecialties, listTeachers, specialtiesKey, teachersKey } from './api'

const normalize = (s: string) => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()

export function ProfesoresList() {
  const { activeSchool, role } = useSchool()
  const schoolId = activeSchool?.id
  const canEdit = role === 'admin' || role === 'ceo'
  const teachers = useQuery({ queryKey: teachersKey(schoolId), queryFn: () => listTeachers(schoolId!), enabled: Boolean(schoolId) })
  const specialties = useQuery({ queryKey: specialtiesKey(schoolId), queryFn: () => listSpecialties(schoolId!), enabled: Boolean(schoolId) })
  const [q, setQ] = useState('')
  const [specialty, setSpecialty] = useState('')
  const [showInactive, setShowInactive] = useState(false)

  const spName = useMemo(() => new Map((specialties.data ?? []).map((s) => [s.id, s.name])), [specialties.data])

  const rows = useMemo(() => {
    const needle = normalize(q.trim())
    return (teachers.data ?? []).filter((t) =>
      (showInactive || t.active) &&
      (!specialty || t.specialty_ids.includes(specialty)) &&
      (!needle || normalize(t.full_name ?? '').includes(needle) || normalize(t.email ?? '').includes(needle)),
    )
  }, [teachers.data, q, specialty, showInactive])

  if (!activeSchool) return <p className="page-note">Selecciona una escuela para ver sus profesores.</p>

  const inactiveCount = (teachers.data ?? []).filter((t) => !t.active).length

  return (
    <div className="profesores">
      <header className="page-head page-head--row">
        <div>
          <span className="eyebrow">{activeSchool.name}</span>
          <h1>Profesores</h1>
        </div>
        {canEdit && (
          <Link className="fab" to="nuevo" aria-label="Nuevo profesor" title="Nuevo profesor"><Icon name="plus" size={22} /></Link>
        )}
      </header>

      {Boolean(teachers.data?.length) && (
        <div className="toolbar">
          <label className="search">
            <Icon name="search" size={16} />
            <span className="sr-only">Buscar profesor</span>
            <input className="input" type="search" placeholder="Buscar por nombre o correo" value={q} onChange={(e) => setQ(e.target.value)} />
          </label>
          {Boolean(specialties.data?.length) && (
            <select className="input toolbar__select" aria-label="Filtrar por especialidad" value={specialty} onChange={(e) => setSpecialty(e.target.value)}>
              <option value="">Todas las especialidades</option>
              {specialties.data!.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          )}
          {inactiveCount > 0 && (
            <label className="switch switch--inline">
              <input type="checkbox" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} />
              <span>Mostrar inactivos ({inactiveCount})</span>
            </label>
          )}
        </div>
      )}

      {teachers.isLoading && <p className="hint">Cargando…</p>}
      {teachers.isError && <p className="alert">No se pudieron cargar los profesores.</p>}
      {teachers.data?.length === 0 && (
        <div className="card empty">
          <h2>Aún no hay profesores</h2>
          {canEdit ? (
            <>
              <p className="hint">Agrega a tu equipo con su cinturón y especialidades. Las especialidades se definen en Ajustes → Catálogos.</p>
              <Link className="btn" to="nuevo"><Icon name="plus" size={16} /> Crear profesor</Link>
            </>
          ) : (
            <p className="hint">Un administrador de la escuela puede agregarlos.</p>
          )}
        </div>
      )}
      {Boolean(teachers.data?.length) && rows.length === 0 && <p className="hint">Ningún profesor coincide con los filtros.</p>}

      <ul className="teacher-grid">
        {rows.map((t) => {
          const swatch = beltSwatch(t.belt)
          return (
            <li key={t.id}>
              <Link className={`card teacher-card${t.active ? '' : ' is-off'}`} to={t.id}>
                <div className="teacher-card__top">
                  <span className="avatar avatar--lg" aria-hidden="true">{`${t.first_name[0] ?? ''}${t.first_last_name[0] ?? ''}`.toUpperCase()}</span>
                  {!t.active && <span className="tag">Inactivo</span>}
                  {t.user_id && <span className="tag" title="Tiene cuenta en Martial CRM">Con cuenta</span>}
                </div>
                <strong className="teacher-card__name">{t.full_name}</strong>
                {t.belt && (
                  <span className="belt">
                    {swatch && <i style={{ background: swatch }} aria-hidden="true" />}
                    {t.belt}{t.belt_degree ? ` · ${t.belt_degree}°` : ''}
                  </span>
                )}
                {t.specialty_ids.length > 0 && (
                  <ul className="chips">
                    {t.specialty_ids.map((id) => spName.get(id) && <li key={id}>{spName.get(id)}</li>)}
                  </ul>
                )}
                <span className="hint teacher-card__contact">{[t.phone, t.email].filter(Boolean).join(' · ') || 'Sin datos de contacto'}</span>
              </Link>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
