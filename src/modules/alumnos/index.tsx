import type { ModuleManifest } from '../types'

export const alumnos: ModuleManifest = {
  id: 'alumnos',
  label: 'Alumnos',
  path: 'alumnos',
  roles: ['ceo', 'admin', 'user'],
  icon: 'user',
  navGroup: 'principal',
  /** Listed inside Miembros (accordion); the route stays for the student's page. */
  hidden: true,
}
