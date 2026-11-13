import type { ReactNode } from 'react'
import { Navigate } from '../lib/nav'
import { useAuth } from '../lib/auth'

// Landing and login are for visitors: a signed-in user goes straight to the app (S11).
export function RedirectIfAuthed({ children }: { children: ReactNode }) {
  const { session, loading } = useAuth()
  if (!loading && session) return <Navigate to="/app" replace />
  return <>{children}</>
}
