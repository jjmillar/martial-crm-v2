import { useMemo } from 'react'
import { usePersisted } from '../../lib/persist'
import { Link } from '../../lib/nav'
import { useQuery } from '@tanstack/react-query'
import { useSchool } from '../../lib/school'
import { formatRut } from '../../lib/rut'
import { yearsSince } from '../../lib/dates'
import { Icon } from '../../ui/Icon'
import { Avatar } from '../../ui/Avatar'
import { useAvatarUrls } from '../../lib/avatars'
import { listStudents, studentsKey } from './api'
import { beltSwatch } from '../../lib/belts'
import { ShowMore } from '../../ui/ShowMore'
import { useShowMore } from '../../ui/useShowMore'
import { degreeText, listSchoolStudentArts, schoolStudentArtsKey } from '../artes/api'
import { BeltChip } from '../artes/Belt'

type Filter = 'activos' | 'inactivos' | 'todos'

const normalize = (s: string) => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()

/** Students directory: the "Alumnos" accordion in Miembros. First 10, then "Mostrar más". */
export function AlumnosList() {
  const { activeSchool } = useSchool()
  const schoolId = activeSchool?.id
  const students = useQuery({ queryKey: studentsKey(schoolId), queryFn: () => listStudents(schoolId!), enabled: Boolean(schoolId) })
  const arts = useQuery({ queryKey: schoolStudentArtsKey(schoolId), queryFn: () => listSchoolStudentArts(schoolId!), enabled: Boolean(schoolId) })
  const [q, setQ] = usePersisted('alumnos.q', '', 'session')
  const [filter, setFilter] = usePersisted<Filter>('alumnos.filtro', 'activos')
  const { shown, more } = useShowMore('alumnos.mostrar', 10)

  const rows = useMemo(() => {
    const needle = normalize(q.trim())
    const digits = q.replace(/[^0-9kK]/g, '')
    return (students.data ?? []).filter((s) => {
      if (filter === 'activos' && !s.active) return false
      if (filter === 'inactivos' && s.active) return false
      if (!needle) return true
      return (
        normalize(s.full_name ?? '').includes(needle) ||
        (digits.length >= 3 && (s.rut ?? '').replace('-', '').includes(digits.toUpperCase())) ||
        normalize(s.email ?? '').includes(needle)
      )
    })
  }, [students.data, q, filter])

  const counts = useMemo(() => {
    const all = students.data ?? []
    const active = all.filter((s) => s.active).length
    return { activos: active, inactivos: all.length - active, todos: all.length }
  }, [students.data])

  const photos = useAvatarUrls(rows.slice(0, shown).map((s) => s.avatar_url))

  if (!activeSchool) return null

  return (
    <div className="alumnos">
      <div className="toolbar">
        <label className="search">
          <Icon name="search" size={16} />
          <span className="sr-only">Buscar alumno</span>
          <input className="input" type="search" placeholder="Buscar por nombre, RUT o correo" value={q} onChange={(e) => setQ(e.target.value)} />
        </label>
        <div className="segmented" role="group" aria-label="Filtrar por estado">
          {(['activos', 'inactivos', 'todos'] as const).map((f) => (
            <button key={f} type="button" aria-pressed={filter === f} onClick={() => setFilter(f)}>
              {f[0].toUpperCase() + f.slice(1)} <span>{counts[f]}</span>
            </button>
          ))}
        </div>
        {Boolean(students.data?.length) && (
          <Link className="btn" to="/app/alumnos/nuevo"><Icon name="plus" size={16} /> Nuevo alumno</Link>
        )}
      </div>

      {students.isLoading && <p className="hint">Cargando…</p>}
      {students.isError && <p className="alert">No se pudieron cargar los alumnos.</p>}
      {students.data?.length === 0 && (
        <div className="card empty">
          <h2>Aún no hay alumnos</h2>
          <p className="hint">Crea la ficha del primero: nombre, RUT, cinturón y contacto de emergencia.</p>
          <Link className="btn" to="/app/alumnos/nuevo"><Icon name="plus" size={16} /> Crear alumno</Link>
        </div>
      )}
      {Boolean(students.data?.length) && rows.length === 0 && <p className="hint">Ningún alumno coincide con la búsqueda.</p>}

      <ul className="student-list">
        {rows.slice(0, shown).map((s) => {
          const age = yearsSince(s.birth_date)
          const swatch = beltSwatch(s.belt)
          const mine = (arts.data?.get(s.id) ?? []).filter((a) => a.belt)
          return (
            <li key={s.id}>
              <Link className="student-row card" to={`/app/alumnos/${s.id}`}>
                <Avatar url={photos.get(s.avatar_url ?? '') ?? null} name={`${s.first_name} ${s.first_last_name}`} />
                <span className="student-row__main">
                  <strong>{s.full_name}</strong>
                  <span className="hint">{[s.rut && formatRut(s.rut), age !== null && `${age} años`, s.phone].filter(Boolean).join(' · ') || 'Sin datos de contacto'}</span>
                </span>
                {mine.length > 0 ? (
                  <span className="student-row__belts">
                    {mine.map((a) => (
                      <BeltChip key={a.id} size="sm" name={a.belt!.name} color={a.belt!.color} stripe={a.belt!.stripe} bar={a.belt!.bar} pattern={a.belt!.pattern} degree={a.degree}
                        degreeText={degreeText(a.degree, a.belt!.degree_name)} art={mine.length > 1 ? a.art?.name : null} />
                    ))}
                  </span>
                ) : s.belt && (
                  <span className="belt">
                    {swatch && <i style={{ background: swatch }} aria-hidden="true" />}
                    {s.belt}{s.belt_degree ? ` · ${s.belt_degree}°` : ''}
                  </span>
                )}
                {!s.active && <span className="tag">Inactivo</span>}
              </Link>
            </li>
          )
        })}
      </ul>
      <ShowMore shown={shown} total={rows.length} onMore={more} label="Mostrar más" />
    </div>
  )
}
