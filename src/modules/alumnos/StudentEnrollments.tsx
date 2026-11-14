import { Link } from '../../lib/nav'
import { useQuery } from '@tanstack/react-query'
import { formatDate } from '../../lib/dates'
import { formatCLP } from '../../lib/money'
import { Icon } from '../../ui/Icon'
import { listStudentEnrollments, phaseLabel, phaseOf } from '../matriculas/api'

/** Enrollments of one student, shown inside the student form. */
export function StudentEnrollments({ studentId }: { studentId: string }) {
  const q = useQuery({ queryKey: ['student-enrollments', studentId], queryFn: () => listStudentEnrollments(studentId) })
  return (
    <section className="card form-section">
      <div className="ajustes__section-head">
        <h2>Inscripciones</h2>
        <Link className="btn btn--ghost" to={`/app/matriculas/nueva?alumno=${studentId}`}><Icon name="plus" size={16} /> Matricular</Link>
      </div>
      {q.isLoading && <p className="hint">Cargando…</p>}
      {q.data?.length === 0 && <p className="hint">Sin inscripciones todavía.</p>}
      {Boolean(q.data?.length) && (
        <ul className="email-log">
          {q.data!.map((e) => {
            const phase = phaseOf(e)
            return (
              <li key={e.id} className="email-log__row">
                <Link className="email-log__main link-plain" to={`/app/matriculas/${e.id}`}>
                  <strong>{e.plan?.name}</strong>
                  <span className="hint">{formatCLP(e.price)} · {formatDate(e.start_date)}{e.ends_at ? ` → ${formatDate(e.ends_at)}` : ''}</span>
                </Link>
                <span className={`tag tag--phase-${phase}`}>{phaseLabel[phase]}</span>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
