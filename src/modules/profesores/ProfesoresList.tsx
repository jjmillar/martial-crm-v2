import { useMemo } from 'react'
import { usePersisted } from '../../lib/persist'
import { Link } from '../../lib/nav'
import { useQuery } from '@tanstack/react-query'
import { useSchool } from '../../lib/school'
import { beltSwatch } from '../../lib/belts'
import { artsKey, degreeText, listArts } from '../artes/api'
import { BeltChip } from '../artes/Belt'
import { Icon } from '../../ui/Icon'
import { Toggle } from '../../ui/Toggle'
import { listSpecialties, listTeachers, specialtiesKey, teachersKey } from './api'
import { ShowMore } from '../../ui/ShowMore'
import { useShowMore } from '../../ui/useShowMore'

const normalize = (s: string) => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()

/** Teachers directory: the "Profesores" accordion in Miembros. First 10, then "Mostrar más". */
export function ProfesoresList() {
  const { activeSchool, role } = useSchool()
  const schoolId = activeSchool?.id
  const canEdit = role === 'admin' || role === 'ceo'
  const teachers = useQuery({ queryKey: teachersKey(schoolId), queryFn: () => listTeachers(schoolId!), enabled: Boolean(schoolId) })
  const specialties = useQuery({ queryKey: specialtiesKey(schoolId), queryFn: () => listSpecialties(schoolId!), enabled: Boolean(schoolId) })
  const arts = useQuery({ queryKey: artsKey(schoolId), queryFn: () => listArts(schoolId!), enabled: Boolean(schoolId) })
  const beltById = useMemo(() => new Map((arts.data ?? []).flatMap((a) => a.belts.map((b) => [b.id, { b, art: a.name }] as const))), [arts.data])
  const [q, setQ] = usePersisted('profesores.q', '', 'session')
  const [specialty, setSpecialty] = usePersisted('profesores.especialidad', '')
  const [showInactive, setShowInactive] = usePersisted('profesores.inactivos', false)
  const { shown, more } = useShowMore('profesores.mostrar', 10)

  const spName = useMemo(() => new Map((specialties.data ?? []).map((s) => [s.id, s.name])), [specialties.data])

  const rows = useMemo(() => {
    const needle = normalize(q.trim())
    return (teachers.data ?? []).filter((t) =>
      (showInactive || t.active) &&
      (!specialty || t.specialty_ids.includes(specialty)) &&
      (!needle || normalize(t.full_name ?? '').includes(needle) || normalize(t.email ?? '').includes(needle)),
    )
  }, [teachers.data, q, specialty, showInactive])

  if (!activeSchool) return null

  const inactiveCount = (teachers.data ?? []).filter((t) => !t.active).length

  return (
    <div className="profesores">
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
            <Toggle inline checked={showInactive} onChange={setShowInactive} label={`Mostrar inactivos (${inactiveCount})`} />
          )}
          {canEdit && <Link className="btn" to="/app/profesores/nuevo"><Icon name="plus" size={16} /> Nuevo profesor</Link>}
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
              <Link className="btn" to="/app/profesores/nuevo"><Icon name="plus" size={16} /> Crear profesor</Link>
            </>
          ) : (
            <p className="hint">Un administrador de la escuela puede agregarlos.</p>
          )}
        </div>
      )}
      {Boolean(teachers.data?.length) && rows.length === 0 && <p className="hint">Ningún profesor coincide con los filtros.</p>}

      <ul className="student-list">
        {rows.slice(0, shown).map((t) => {
          const swatch = beltSwatch(t.belt)
          const real = t.belt_id ? beltById.get(t.belt_id) : undefined
          const sps = t.specialty_ids.map((id) => spName.get(id)).filter(Boolean)
          return (
            <li key={t.id}>
              <Link className={`student-row card${t.active ? '' : ' is-off'}`} to={`/app/profesores/${t.id}`}>
                <span className="avatar" aria-hidden="true">{`${t.first_name[0] ?? ''}${t.first_last_name[0] ?? ''}`.toUpperCase()}</span>
                <span className="student-row__main">
                  <strong>{t.full_name}</strong>
                  <span className="hint">{[sps.join(', '), t.phone, t.email].filter(Boolean).join(' · ') || 'Sin datos de contacto'}</span>
                </span>
                {real ? (
                  <span className="student-row__belts">
                    <BeltChip size="sm" name={real.b.name} color={real.b.color} stripe={real.b.stripe} bar={real.b.bar} pattern={real.b.pattern}
                      degree={t.belt_degree ?? 0} degreeText={t.belt_degree ? degreeText(t.belt_degree, real.b.degree_name) : null} art={real.art} />
                  </span>
                ) : t.belt && (
                  <span className="belt">
                    {swatch && <i style={{ background: swatch }} aria-hidden="true" />}
                    {t.belt}{t.belt_degree ? ` · ${t.belt_degree}°` : ''}
                  </span>
                )}
                {t.user_id && <span className="tag" title="Tiene cuenta en Martial CRM">Con cuenta</span>}
                {!t.active && <span className="tag">Inactivo</span>}
              </Link>
            </li>
          )
        })}
      </ul>
      <ShowMore shown={shown} total={rows.length} onMore={more} label="Mostrar más" />
    </div>
  )
}
