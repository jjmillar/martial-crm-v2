import type { ReactNode } from 'react'

export type AppRole = 'ceo' | 'admin' | 'user'

export type ModuleManifest = {
  id: string
  label: string
  path: string
  roles: AppRole[]
  element: ReactNode
  navGroup?: 'principal' | 'gestion'
}
