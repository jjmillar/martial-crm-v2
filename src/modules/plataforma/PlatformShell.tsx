import { useEffect } from 'react'
import { NavLink, useLocation, useNavigate } from '../../lib/nav'
import { useAuth } from '../../lib/auth'
import { PageMotion } from '../../ui/PageMotion'
import { Icon } from '../../ui/Icon'
import { ThemeToggle } from '../../ui/ThemeToggle'
import { Wordmark } from '../../ui/Wordmark'
import { Flash } from '../../ui/Flash'
import { Acc } from '../../ui/Accordion'
import { MobileMenu } from '../../shell/MobileMenu'
import type { ModuleManifest } from '../types'
import { Seguridad } from '../cuenta/Seguridad'
import { PlataformaPage } from './PlataformaPage'

// The operator account's whole app: no schools, no school menu. Two-step verification is mandatory: until the
// session is verified (aal2) the only thing on screen is setting up the authenticator; the database refuses
// every platform call without it anyway.
const NAV: ModuleManifest[] = [{ id: 'plataforma', label: 'Suscripciones', path: 'plataforma', roles: [], icon: 'wallet' }]

export function PlatformShell() {
  const { platform, signOut } = useAuth()
  const { pathname } = useLocation()
  const navigate = useNavigate()
  useEffect(() => {
    if (!pathname.startsWith('/app/plataforma')) navigate('/app/plataforma', { replace: true })
  }, [pathname, navigate])
  const who = platform?.username ?? ''
  const year = new Date().getFullYear()

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="sidebar__top">
          <Wordmark to="/app/plataforma" />
          <ThemeToggle />
        </div>
        <nav className="nav" aria-label="Secciones">
          {NAV.map((m) => (
            <NavLink key={m.id} to={`/app/${m.path}`} className="nav__link">
              {m.icon && <Icon name={m.icon} />}<span>{m.label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="sidebar__user">
          <div className="sidebar__who">
            <strong>{who}</strong>
            <span className="hint">Administrador de la plataforma</span>
          </div>
          <button type="button" className="icon-btn" onClick={signOut} aria-label="Cerrar sesión" title="Cerrar sesión">
            <Icon name="logout" />
          </button>
        </div>
      </aside>

      <div className="main">
        <main className="content">
          <Flash />
          <PageMotion>
            {platform?.verified ? (
              <>
                <PlataformaPage />
                <section className="pp-section" aria-label="Mi cuenta">
                  <Acc id="seguridad" title="Verificación en dos pasos" hint="Obligatoria para esta cuenta" icon="lock">
                    <Seguridad />
                  </Acc>
                </section>
              </>
            ) : (
              <div className="plataforma">
                <header className="page-head">
                  <span className="eyebrow">Plataforma</span>
                  <h1>Activa la verificación en dos pasos</h1>
                  <p className="hint">Esta cuenta controla todas las suscripciones de Martial CRM, así que siempre pide un código además de la contraseña. Configúrala una sola vez con tu app de autenticación; al confirmarla entras a la consola.</p>
                </header>
                <section className="card platform-mfa"><Seguridad /></section>
              </div>
            )}
          </PageMotion>
        </main>
        <footer className="app-footer">© {year} Martial CRM</footer>
      </div>

      <MobileMenu nav={NAV} who={who} roleText="Administrador de la plataforma" onSignOut={signOut} />
    </div>
  )
}
