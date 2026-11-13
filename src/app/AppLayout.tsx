import { NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { useSchool } from '../lib/school'
import { roleLabel } from '../lib/roles'
import { modulesFor } from '../modules/registry'
import { Icon } from '../ui/Icon'
import { ThemeToggle } from '../ui/ThemeToggle'
import { Wordmark } from '../ui/Wordmark'
import { Flash } from '../ui/Flash'
import { MobileMenu } from './MobileMenu'
import { PendingSignup } from '../modules/portal/PendingSignup'
import { usePendingCount } from '../modules/pendientes/api'
import './app.css'

export function AppLayout() {
  const { profile, user, signOut } = useAuth()
  const { schools, activeSchool, setActiveSchool, role, loading } = useSchool()
  const nav = modulesFor(role)
  const pending = usePendingCount()
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
              {m.id === 'pendientes' && pending > 0 && <span className="nav-badge" aria-label={`${pending} pendientes`}>{pending}</span>}
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
          <Flash />
          {/* No role anywhere yet (e.g. a self-signup waiting for approval): one screen instead of empty pages. */}
          {!loading && !role ? <PendingSignup /> : <Outlet />}
        </main>
        <footer className="app-footer">© {year} Martial CRM</footer>
      </div>

      {/* Mobile: draggable floating menu button + sheet with every module, account and logout */}
      <MobileMenu nav={nav} pending={pending} who={profile?.full_name || user?.email || ''} roleText={role ? roleLabel[role] : 'Sin rol asignado'} onSignOut={signOut} />
    </div>
  )
}
