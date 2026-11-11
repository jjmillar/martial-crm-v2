import type { ModuleManifest } from '../types'
import { ProfesoresRoutes } from './ProfesoresRoutes'

export const profesores: ModuleManifest = {
  id: 'profesores',
  label: 'Profesores',
  path: 'profesores',
  roles: ['ceo', 'admin', 'user'],
  element: <ProfesoresRoutes />,
  icon: 'teacher',
  navGroup: 'principal',
}
