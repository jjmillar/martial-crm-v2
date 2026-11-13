import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import type { ModuleManifest } from '../modules/types'
import { Icon } from '../ui/Icon'

// Mobile navigation (S4): a draggable floating hamburger button that opens a sheet with every module,
// plus account and logout. Released, it snaps to the nearest side edge; the position is remembered per device.

type Props = { nav: ModuleManifest[]; who: string; roleText: string; onSignOut: () => void; pending?: number }
type Spot = { side: 'left' | 'right'; y: number } // y = fraction of the usable height (0 top … 1 bottom)

const SIZE = 56
const EDGE = 12
const DRAG_THRESHOLD = 6
const STORE_KEY = 'mcrm.menuFab'

function loadSpot(): Spot {
  try {
    const s = JSON.parse(localStorage.getItem(STORE_KEY) ?? 'null') as Spot | null
    if (s && (s.side === 'left' || s.side === 'right') && typeof s.y === 'number') return { side: s.side, y: Math.min(1, Math.max(0, s.y)) }
  } catch { /* storage unavailable */ }
  return { side: 'right', y: 1 }
}

function saveSpot(s: Spot) {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(s)) } catch { /* storage unavailable */ }
}

// Usable vertical band: below the top bar area, above the bottom safe area.
function band() {
  const top = 72
  const bottom = window.innerHeight - SIZE - EDGE - 8
  return { top, bottom: Math.max(top, bottom) }
}

function spotToXY(s: Spot) {
  const { top, bottom } = band()
  return { x: s.side === 'left' ? EDGE : window.innerWidth - SIZE - EDGE, y: top + s.y * (bottom - top) }
}

export function MobileMenu({ nav, who, roleText, onSignOut, pending = 0 }: Props) {
  const sheet = useRef<HTMLDialogElement>(null)
  const { pathname } = useLocation()
  const [spot, setSpot] = useState<Spot>(loadSpot)
  const [drag, setDrag] = useState<{ x: number; y: number } | null>(null)
  const [, setTick] = useState(0)
  const [ready, setReady] = useState(false)
  const start = useRef<{ px: number; py: number; x: number; y: number; moved: boolean } | null>(null)
  // Latest drag position in a ref: pointerup can arrive before React re-renders with the drag state.
  const dragPos = useRef<{ x: number; y: number } | null>(null)
  // A drag must never end up as a tap: the click that follows the release is swallowed.
  const swallowClick = useRef(false)

  // Close the sheet whenever navigation happens.
  useEffect(() => {
    sheet.current?.close()
  }, [pathname])

  // Enable the snap animation only after the first paint, so it doesn't fly in from the corner.
  useEffect(() => {
    const id = requestAnimationFrame(() => setReady(true))
    return () => cancelAnimationFrame(id)
  }, [])

  // Re-place the button when the viewport changes (rotation, keyboard).
  useEffect(() => {
    const onResize = () => setTick((t) => t + 1)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  const open = useCallback(() => sheet.current?.showModal(), [])

  function onPointerDown(e: ReactPointerEvent<HTMLButtonElement>) {
    if (e.button !== 0) return
    const { x, y } = spotToXY(spot)
    start.current = { px: e.clientX, py: e.clientY, x, y, moved: false }
    dragPos.current = null
    swallowClick.current = false
    e.currentTarget.setPointerCapture(e.pointerId)
  }

  function onPointerMove(e: ReactPointerEvent<HTMLButtonElement>) {
    const s = start.current
    if (!s) return
    const dx = e.clientX - s.px
    const dy = e.clientY - s.py
    if (!s.moved && Math.hypot(dx, dy) < DRAG_THRESHOLD) return
    s.moved = true
    const maxX = window.innerWidth - SIZE - EDGE
    const { top, bottom } = band()
    dragPos.current = { x: Math.min(maxX, Math.max(EDGE, s.x + dx)), y: Math.min(bottom, Math.max(top, s.y + dy)) }
    setDrag(dragPos.current)
  }

  function onPointerUp(e: ReactPointerEvent<HTMLButtonElement>) {
    const s = start.current
    start.current = null
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId)
    const p = dragPos.current
    dragPos.current = null
    if (!s || !s.moved || !p) { setDrag(null); return } // a tap: the click handler opens the menu
    swallowClick.current = true
    const { top, bottom } = band()
    const next: Spot = {
      side: p.x + SIZE / 2 < window.innerWidth / 2 ? 'left' : 'right',
      y: bottom > top ? (p.y - top) / (bottom - top) : 1,
    }
    setDrag(null)
    setSpot(next)
    saveSpot(next)
  }

  function onPointerCancel() {
    start.current = null
    dragPos.current = null
    setDrag(null)
  }

  const pos = drag ?? spotToXY(spot)
  const anyActive = nav.some((m) => pathname.startsWith(`/app/${m.path}`))

  return (
    <>
      <button
        type="button"
        className={`menu-fab${ready ? ' is-ready' : ''}${drag ? ' is-dragging' : ''}${anyActive ? ' active' : ''}`}
        style={{ transform: `translate3d(${pos.x}px, ${pos.y}px, 0)` }}
        aria-haspopup="dialog"
        aria-label="Abrir menú"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerCancel}
        onClick={() => {
          if (swallowClick.current) { swallowClick.current = false; return }
          open()
        }}
      >
        <Icon name="menu" size={24} />
        {pending > 0 && <span className="menu-fab__badge" aria-label={`${pending} pendientes`}>{pending}</span>}
      </button>

      <dialog
        ref={sheet}
        className="sheet"
        aria-label="Menú"
        onClick={(e) => { if (e.target === e.currentTarget) sheet.current?.close() }}
      >
        <div className="sheet__body">
          <div className="sheet__head">
            <span className="eyebrow">Menú</span>
            <button type="button" className="icon-btn" onClick={() => sheet.current?.close()} aria-label="Cerrar">
              <Icon name="close" />
            </button>
          </div>

          <nav className="sheet__grid" aria-label="Secciones">
            {nav.map((m) => (
              <NavLink key={m.id} to={m.path} className="sheet__link">
                {m.icon && <Icon name={m.icon} size={22} />}
                <span>{m.label}</span>
                {m.id === 'pendientes' && pending > 0 && <span className="nav-badge sheet__badge">{pending}</span>}
              </NavLink>
            ))}
          </nav>

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
