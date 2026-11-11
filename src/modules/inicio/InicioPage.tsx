import { Link } from 'react-router-dom'
import { useAuth } from '../../lib/auth'
import { useSchool } from '../../lib/school'
import { roleLabel } from '../../lib/roles'
import './inicio.css'

// Modules from the v1 template still to be built (spec S6, tasks T3-T13).
const upcoming = ['Planes', 'Matrículas', 'Clases', 'Calendario', 'Asistencia', 'Pagos']

export function InicioPage() {
  const { profile } = useAuth()
  const { activeSchool, role, schools } = useSchool()
  const firstName = profile?.full_name?.split(' ')[0]

  return (
    <div className="bento">
      <section className="tile tile--hero rise">
        <span className="eyebrow">{role ? roleLabel[role] : 'Sin rol'}</span>
        <h1>Hola{firstName ? `, ${firstName}` : ''}.</h1>
        <p className="tile__lead">
          {activeSchool ? `Estás trabajando en ${activeSchool.name}.` : 'Todavía no tienes una escuela seleccionada.'}
        </p>
      </section>

      <section className="tile rise" style={{ animationDelay: '60ms' }}>
        <span className="eyebrow">Escuela activa</span>
        <p className="tile__big">{activeSchool?.name ?? 'Ninguna'}</p>
        <p className="hint">{activeSchool?.city ?? 'Sin ciudad registrada'}</p>
      </section>

      {role === 'ceo' && (
        <section className="tile rise" style={{ animationDelay: '120ms' }}>
          <span className="eyebrow">Plataforma</span>
          <p className="tile__big">{schools.length}</p>
          <p className="hint">{schools.length === 1 ? 'escuela registrada' : 'escuelas registradas'}</p>
          <Link className="btn btn--ghost tile__cta" to="/app/escuelas">Gestionar escuelas</Link>
        </section>
      )}

      <section className="tile tile--wide rise" style={{ animationDelay: '180ms' }}>
        <span className="eyebrow">En construcción</span>
        <p className="tile__lead">Estos módulos llegan en las próximas entregas:</p>
        <ul className="chips">
          {upcoming.map((m) => <li key={m}>{m}</li>)}
        </ul>
      </section>
    </div>
  )
}
