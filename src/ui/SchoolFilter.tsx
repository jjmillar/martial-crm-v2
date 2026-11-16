import { useSchool } from '../lib/school'
import { Icon } from './Icon'

/**
 * School filter shown at the top of each section. With one school it is just the school's name; with several it
 * is a dropdown that switches the school every section shows (the choice is remembered on this device).
 */
export function SchoolFilter({ fallback = '' }: { fallback?: string }) {
  const { schools, activeSchool, setActiveSchool } = useSchool()
  if (schools.length < 2) return <span className="eyebrow">{activeSchool?.name ?? fallback}</span>
  return (
    <label className="school-filter">
      <span className="sr-only">Escuela</span>
      <select className="school-filter__select" value={activeSchool?.id ?? ''} onChange={(e) => setActiveSchool(e.target.value)}>
        {!activeSchool && <option value="" disabled>Elige una escuela</option>}
        {schools.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
      </select>
      <Icon name="down" size={14} />
    </label>
  )
}
