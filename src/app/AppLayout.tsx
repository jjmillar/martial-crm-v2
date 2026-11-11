import { NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { useSchool } from '../lib/school'
import { roleLabel } from '../lib/roles'
import { modulesFor } from '../modules/registry'
import { Icon } from '../ui/Icon'
import { ThemeToggle } from '../ui/ThemeToggle'
import { Wordmark } from '../ui/Wordmark'
import './app.css'

export function AppLayout() {
  const { profile, user, signOut } = useAuth()
  const { schools, activeSchool, setActiveSchool, role } = useSchool()
  const nav = modulesFor(role)
  const year = new Date().getFullYear()

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="sidebar__top">
          <Wordmark to="/app" />
          <ThemeToggle />
        </div>

        {schools.length > 1 ? (
          <div className="field">
            <label htmlFor="school-switch">Escuela</label>
            <select id="school-switch" className="input" value={activeSchool?.id ?? ''} onChange={(e) => setActiveSchool(e.target.value)}>
              {schools.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
        ) : (
          <p className="sidebar__school">{activeSchool?.name ?? 'Sin escuela'}</p>
        )}

        <nav className="nav" aria-label="Secciones">
          {nav.map((m) => (
            <NavLink key={m.id} to={m.path} className="nav__link">
              {m.icon && <Icon name={m.icon} />}
              <span>{m.label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="sidebar__user">
          <div className="sidebar__who">
            <strong>{profile?.full_name || user?.email}</strong>
            <span className="hint">{role ? roleLabel[role] : 'Sin rol asignado'}</span>
          </div>
          <button type="button" className="icon-btn" onClick={signOut} aria-label="Cerrar sesión" title="Cerrar sesión">
            <Icon name="logout" />
          </button>
        </div>
      </aside>

      <div className="main">
        <main className="content">
          <Outlet />
        </main>
        <footer className="app-footer">© {year} Martial CRM</footer>
      </div>

      {/* Mobile: floating dock with the same entries as the sidebar */}
      <nav className="dock" aria-label="Secciones">
        {nav.map((m) => (
          <NavLink key={m.id} to={m.path} className="dock__link">
            {m.icon && <Icon name={m.icon} size={20} />}
            <span>{m.label}</span>
          </NavLink>
        ))}
        <button type="button" className="dock__link" onClick={signOut}>
          <Icon name="logout" size={20} />
          <span>Salir</span>
        </button>
      </nav>
    </div>
  )
}
