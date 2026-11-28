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
import { Avatar } from '../ui/Avatar'
import { Flash } from '../ui/Flash'
import { MobileMenu } from './MobileMenu'
import { SchoolSwitcher } from './SchoolSwitcher'
import { PendingSignup } from '../modules/portal/PendingSignup'
import { PersonSwitcher } from '../modules/portal/PersonSwitcher'
import { usePendingCount } from '../modules/tareas/api'
import { GuidedTour } from '../modules/ayuda/GuidedTour'

/** 'Academia Norte Jiu-jitsu' → 'AN' */
const initials = (name: string) => name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase()

export function AppLayout({ children }: { children: ReactNode }) {
  const { profile, user, signOut } = useAuth()
  const { role, loading, activeSchool, myStudent } = useSchool()
  const nav = modulesFor(role)
  const pending = usePendingCount()
  const year = new Date().getFullYear()
  // My photo: a student's is the one on their student record; everyone else's is on their account.
  const me = role === 'alumno' && myStudent
    ? { path: myStudent.avatar_url ?? null, name: myStudent.full_name ?? profile?.full_name ?? '', to: '/app/ajustes#perfil' }
    : { path: profile?.avatar_url ?? null, name: profile?.full_name || user?.email || '', to: '/app/ajustes#perfil' }

  return (
    <div className="shell">
      <aside className="sidebar sidebar--school">
        <div className="sidebar__top">
          {/* Mobile: my photo, top left (opens my profile) */}
          <Link to={me.to} className="me-chip" aria-label="Mi perfil">
            <Avatar path={me.path} name={me.name} size={44} />
          </Link>
          {/* Desktop without a school yet: the CRM wordmark */}
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
          {/* Desktop: the CRM's name, a quiet signature just above the line over the user (not a link) */}
          <div className="sidebar__crm"><Wordmark plain /></div>
          <div className="sidebar__user">
            {/* My name opens my profile in Ajustes */}
            <div className="sidebar__who">
              <Link to={me.to} className="sidebar__name" title="Ver mi perfil">{profile?.full_name || user?.email}</Link>
              <span className="hint">{role ? roleLabel[role] : 'Sin rol asignado'}</span>
            </div>
            <div className="sidebar__actions">
              <ThemeToggle />
              <button type="button" className="icon-btn" onClick={signOut} aria-label="Cerrar sesión" title="Cerrar sesión">
                <Icon name="logout" />
              </button>
            </div>
          </div>
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
      {/* First-run guided tour for a new account (and replays from Ajustes → Ayuda) */}
      <GuidedTour />

      <MobileMenu nav={nav} pending={pending} who={profile?.full_name || user?.email || ''} roleText={role ? roleLabel[role] : 'Sin rol asignado'} onSignOut={signOut} />
    </div>
  )
}
