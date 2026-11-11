import { useEffect, useRef } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import type { ModuleManifest } from '../modules/types'
import { Icon } from '../ui/Icon'

// Mobile navigation: the first DOCK_SLOTS modules stay in the dock; everything else (plus account and logout)
// lives in the "Más" sheet, so the dock never overflows however many modules get added (S4).
const DOCK_SLOTS = 4

type Props = { nav: ModuleManifest[]; who: string; roleText: string; onSignOut: () => void }

export function MobileDock({ nav, who, roleText, onSignOut }: Props) {
  const sheet = useRef<HTMLDialogElement>(null)
  const { pathname } = useLocation()
  const primary = nav.slice(0, DOCK_SLOTS)
  const rest = nav.slice(DOCK_SLOTS)
  const moreActive = rest.some((m) => pathname.startsWith(`/app/${m.path}`))

  // Close the sheet whenever navigation happens.
  useEffect(() => {
    sheet.current?.close()
  }, [pathname])

  return (
    <>
      <nav className="dock" aria-label="Secciones">
        {primary.map((m) => (
          <NavLink key={m.id} to={m.path} className="dock__link">
            {m.icon && <Icon name={m.icon} size={20} />}
            <span>{m.label}</span>
          </NavLink>
        ))}
        <button
          type="button"
          className={`dock__link${moreActive ? ' active' : ''}`}
          aria-haspopup="dialog"
          onClick={() => sheet.current?.showModal()}
        >
          <Icon name="more" size={20} />
          <span>Más</span>
        </button>
      </nav>

      <dialog
        ref={sheet}
        className="sheet"
        aria-label="Más secciones"
        onClick={(e) => { if (e.target === e.currentTarget) sheet.current?.close() }}
      >
        <div className="sheet__body">
          <div className="sheet__head">
            <span className="eyebrow">Más</span>
            <button type="button" className="icon-btn" onClick={() => sheet.current?.close()} aria-label="Cerrar">
              <Icon name="close" />
            </button>
          </div>

          {rest.length > 0 && (
            <nav className="sheet__grid" aria-label="Otras secciones">
              {rest.map((m) => (
                <NavLink key={m.id} to={m.path} className="sheet__link">
                  {m.icon && <Icon name={m.icon} size={22} />}
                  <span>{m.label}</span>
                </NavLink>
              ))}
            </nav>
          )}

          <div className="sheet__account">
            <div className="sheet__who">
              <strong>{who}</strong>
              <span className="hint">{roleText}</span>
            </div>
            <button type="button" className="btn btn--ghost" onClick={onSignOut}>
              <Icon name="logout" size={16} /> Salir
            </button>
          </div>
        </div>
      </dialog>
    </>
  )
}
