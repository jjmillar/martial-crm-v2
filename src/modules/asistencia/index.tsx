import type { ModuleManifest } from '../types'
import { AsistenciaPage } from './AsistenciaPage'

export const asistencia: ModuleManifest = {
  id: 'asistencia',
  label: 'Asistencia',
  path: 'asistencia',
  roles: ['ceo', 'admin', 'user', 'alumno'],
  element: <AsistenciaPage />,
  icon: 'check',
  navGroup: 'principal',
}
