import type { ReactNode } from 'react'
import { useSchool } from '../lib/school'
import type { AppRole } from '../modules/types'

export function RequireRole({ roles, children }: { roles: AppRole[]; children: ReactNode }) {
  const { role, loading } = useSchool()
  if (loading) return <p className="page-note">Cargando…</p>
  if (!role || !roles.includes(role)) return <p className="page-note">No tienes acceso a esta sección.</p>
  return <>{children}</>
}
