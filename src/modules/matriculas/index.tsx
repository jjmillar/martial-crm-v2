import type { ModuleManifest } from '../types'
import { MatriculasRoutes } from './MatriculasRoutes'

export const matriculas: ModuleManifest = {
  id: 'matriculas',
  label: 'Matrículas',
  path: 'matriculas',
  roles: ['ceo', 'admin', 'user'],
  element: <MatriculasRoutes />,
  icon: 'enroll',
  navGroup: 'principal',
}
