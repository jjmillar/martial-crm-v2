import type { ModuleManifest } from '../types'
import { MiembrosPage } from './MiembrosPage'

export const miembros: ModuleManifest = {
  id: 'miembros',
  label: 'Miembros',
  path: 'miembros',
  roles: ['ceo', 'admin'],
  element: <MiembrosPage />,
  icon: 'users',
  navGroup: 'gestion',
}
