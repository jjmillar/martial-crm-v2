import type { ModuleManifest } from '../types'

export const asistencia: ModuleManifest = {
  id: 'asistencia',
  label: 'Asistencia',
  path: 'asistencia',
  roles: ['ceo', 'admin', 'user', 'alumno'],
  icon: 'check',
  navGroup: 'principal',
}
