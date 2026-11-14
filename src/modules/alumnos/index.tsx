import type { ModuleManifest } from '../types'

export const alumnos: ModuleManifest = {
  id: 'alumnos',
  label: 'Alumnos',
  path: 'alumnos',
  roles: ['ceo', 'admin', 'user'],
  icon: 'user',
  navGroup: 'principal',
}
