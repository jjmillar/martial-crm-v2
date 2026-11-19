import { useSchool } from '../../lib/school'

// Guardian: who the student portal is showing. One compact row on top of every page; the choice is remembered.
export function PersonSwitcher() {
  const { role, wards, myStudent, student, setViewing } = useSchool()
  if (role !== 'alumno' || wards.length === 0) return null
  const people = [...(myStudent ? [{ id: myStudent.id, label: 'Yo' }] : []), ...wards.map((w) => ({ id: w.id, label: (w.full_name ?? 'Hijo').split(' ')[0] }))]
  return (
    <div className="person-switch" role="group" aria-label="Estás viendo a">
      <span className="hint">Viendo</span>
      <div className="segmented">
        {people.map((p) => <button key={p.id} type="button" aria-pressed={student?.id === p.id} onClick={() => setViewing(p.id)}>{p.label}</button>)}
      </div>
    </div>
  )
}
