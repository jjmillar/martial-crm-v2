import type { ModuleManifest } from '../types'
import { ClasesRoutes } from './ClasesRoutes'

export const clases: ModuleManifest = {
  id: 'clases',
  label: 'Clases',
  path: 'clases',
  roles: ['ceo', 'admin', 'user'],
  element: <ClasesRoutes />,
  icon: 'clock',
  navGroup: 'principal',
}
