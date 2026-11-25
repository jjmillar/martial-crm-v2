import type { ModuleManifest } from '../types'

export const asistencia: ModuleManifest = {
  id: 'asistencia',
  label: 'Asistencia',
  path: 'asistencia',
  roles: ['ceo', 'admin', 'user', 'alumno'],
  icon: 'check',
  navGroup: 'principal',
  /** Staff take attendance in Escuelas → Asistencia; students keep this menu for their own attendance. */
  navFor: ['alumno'],
}
