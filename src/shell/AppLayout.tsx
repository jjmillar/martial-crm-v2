import type { ReactNode } from 'react'
import { Link, NavLink } from '../lib/nav'
import { PageMotion } from '../ui/PageMotion'
import { useAuth } from '../lib/auth'
import { useSchool } from '../lib/school'
import { roleLabel } from '../lib/roles'
import { modulesFor } from '../modules/registry'
import { Icon } from '../ui/Icon'
import { ThemeToggle } from '../ui/ThemeToggle'
import { Wordmark } from '../ui/Wordmark'
import { Flash } from '../ui/Flash'
import { MobileMenu } from './MobileMenu'
import { SchoolSwitcher } from './SchoolSwitcher'
import { PendingSignup } from '../modules/portal/PendingSignup'
import { PersonSwitcher } from '../modules/portal/PersonSwitcher'
import { usePendingCount } from '../modules/tareas/api'

/** 'Academia Norte Jiu-jitsu' → 'AN' */
const initials = (name: string) => name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase()

export function AppLayout({ children }: { children: ReactNode }) {
  const { profile, user, signOut } = useAuth()
  const { role, loading, activeSchool } = useSchool()
  const nav = modulesFor(role)
  const pending = usePendingCount()
  const year = new Date().getFullYear()

  return (
    <div className="shell">
      <aside className="sidebar sidebar--school">
        <div className="sidebar__top">
          {/* Mobile top bar: the CRM wordmark with the school under it */}
          <div className="brand">
            <Wordmark to="/app" />
            <SchoolSwitcher />
          </div>
          {/* Desktop: the school's logo, then its name (a dropdown with several schools) */}
          {activeSchool && (
            <div className="sidebar__school">
              <Link to="/app" className="school-mark" aria-label={`${activeSchool.name}, inicio`}>
                {activeSchool.logo_url ? <img src={activeSchool.logo_url} alt="" /> : <span aria-hidden="true">{initials(activeSchool.name)}</span>}
              </Link>
              <SchoolSwitcher />
            </div>
          )}
        </div>

        <div className="sidebar__menu">
          <nav className="nav" aria-label="Secciones">
            {nav.map((m) => (
              <NavLink key={m.id} to={`/app/${m.path}`} also={m.also?.map((p) => `/app/${p}`)} className="nav__link">
                {m.icon && <Icon name={m.icon} />}
                <span>{m.label}</span>
                {m.id === 'tareas' && pending > 0 && <span className="nav-badge" aria-label={`${pending} pendientes`}>{pending}</span>}
              </NavLink>
            ))}
          </nav>
        </div>

        <div className="sidebar__end">
          <div className="sidebar__user">
            <span className="sidebar__avatar" aria-hidden="true">{initials(profile?.full_name || user?.email || '?')}</span>
            <div className="sidebar__who">
              <strong>{profile?.full_name || user?.email}</strong>
              <span className="hint">{role ? roleLabel[role] : 'Sin rol asignado'}</span>
            </div>
            <div className="sidebar__actions">
              <ThemeToggle />
              <button type="button" className="icon-btn" onClick={signOut} aria-label="Cerrar sesión" title="Cerrar sesión">
                <Icon name="logout" />
              </button>
            </div>
          </div>
          {/* Desktop: the CRM's name, a quiet signature at the foot of the bar (not a link) */}
          <div className="sidebar__crm"><Wordmark plain /></div>
        </div>
      </aside>

      <div className="main">
        <main className="content">
          <Flash />
          <PersonSwitcher />
          {/* No role anywhere yet (e.g. a self-signup waiting for approval): one screen instead of empty pages. */}
          <PageMotion>{!loading && !role ? <PendingSignup /> : children}</PageMotion>
        </main>
        <footer className="app-footer">© {year} Martial CRM</footer>
      </div>

      {/* Mobile: draggable floating menu button + sheet with every module, account and logout */}
      <MobileMenu nav={nav} pending={pending} who={profile?.full_name || user?.email || ''} roleText={role ? roleLabel[role] : 'Sin rol asignado'} onSignOut={signOut} />
    </div>
  )
}
