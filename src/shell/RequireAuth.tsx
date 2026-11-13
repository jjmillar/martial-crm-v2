import type { ReactNode } from 'react'
import { Navigate, useLocation } from '../lib/nav'
import { useAuth } from '../lib/auth'

export function RequireAuth({ children }: { children: ReactNode }) {
  const { session, loading } = useAuth()
  const location = useLocation()

  if (loading) return <p className="center-screen">Cargando…</p>
  if (!session) return <Navigate to="/login" replace state={{ from: location }} />
  return <>{children}</>
}
