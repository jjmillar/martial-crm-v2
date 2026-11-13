import type { ReactNode } from 'react'
import type { IconName } from '../ui/Icon'

// 'alumno': a student with a portal account (students.user_id), not a staff member.
export type AppRole = 'ceo' | 'admin' | 'user' | 'alumno'

// Contract every feature module exports (S4). The registry turns manifests into routes and nav entries.
export type ModuleManifest = {
  id: string
  label: string
  path: string
  roles: AppRole[]
  element: ReactNode
  icon?: IconName
  navGroup?: 'principal' | 'gestion'
}
