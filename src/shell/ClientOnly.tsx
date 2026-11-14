'use client'
import { useEffect, useState, type ReactNode } from 'react'

/** Renders its children only in the browser; the server sends the same "Cargando…" the app shows while it starts. */
export function ClientOnly({ children }: { children: ReactNode }) {
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  return mounted ? <>{children}</> : <p className="center-screen">Cargando…</p>
}
