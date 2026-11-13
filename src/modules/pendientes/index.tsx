import type { ModuleManifest } from '../types'
import { PendientesPage } from './PendientesPage'

export const pendientes: ModuleManifest = {
  id: 'pendientes',
  label: 'Pendientes',
  path: 'pendientes',
  roles: ['ceo'],
  element: <PendientesPage />,
  icon: 'mail',
  navGroup: 'gestion',
}
