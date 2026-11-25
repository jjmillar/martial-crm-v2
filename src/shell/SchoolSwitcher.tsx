import { useSchool } from '../lib/school'
import { Icon } from '../ui/Icon'

/**
 * The active school, under the Martial CRM wordmark. With one school it is just its name; with several it is a
 * dropdown that switches the school the whole CRM shows (remembered on this device).
 */
export function SchoolSwitcher() {
  const { schools, activeSchool, setActiveSchool } = useSchool()
  if (schools.length === 0) return null
  if (schools.length === 1) return <span className="school-switch school-switch--one" title={activeSchool?.name}>{activeSchool?.name ?? schools[0].name}</span>
  return (
    // The name and arrow are what you see; the real select sits on top, invisible, so the arrow hugs the name
    // (a visible select is as wide as its longest option).
    <label className="school-switch">
      <span className="sr-only">Escuela activa</span>
      <span className="school-switch__name" aria-hidden="true">{activeSchool?.name ?? 'Elige una escuela'}</span>
      <select value={activeSchool?.id ?? ''} onChange={(e) => setActiveSchool(e.target.value)}>
        {!activeSchool && <option value="" disabled>Elige una escuela</option>}
        {schools.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
      </select>
      <Icon name="down" size={14} />
    </label>
  )
}
