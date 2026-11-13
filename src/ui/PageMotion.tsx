import { useLayoutEffect, useRef, type ReactNode } from 'react'
import { useLocation } from 'react-router-dom'
import { enterFrames, motion, reducedMotion } from './motion'

// Standard page transition: every route change fades the new page in while it rises.
// Query-string changes (filters, tabs) do not count as a new page.
export function PageMotion({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)
  const { pathname } = useLocation()
  useLayoutEffect(() => {
    if (reducedMotion()) return
    ref.current?.animate(enterFrames(12), { duration: motion.slow, easing: motion.easeOut })
  }, [pathname])
  return <div className="m-page" ref={ref}>{children}</div>
}
