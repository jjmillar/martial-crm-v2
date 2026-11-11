import type { ModuleManifest } from '../types'
import { AlumnosRoutes } from './AlumnosRoutes'

export const alumnos: ModuleManifest = {
  id: 'alumnos',
  label: 'Alumnos',
  path: 'alumnos',
  roles: ['ceo', 'admin', 'user'],
  element: <AlumnosRoutes />,
  icon: 'user',
  navGroup: 'principal',
}
