import type { ModuleManifest } from '../types'
import { PlanesRoutes } from './PlanesRoutes'

export const planes: ModuleManifest = {
  id: 'planes',
  label: 'Planes',
  path: 'planes',
  roles: ['ceo', 'admin', 'user'],
  element: <PlanesRoutes />,
  icon: 'plan',
  navGroup: 'principal',
}
