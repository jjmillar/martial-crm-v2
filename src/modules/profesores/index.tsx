import type { ModuleManifest } from '../types'

export const profesores: ModuleManifest = {
  id: 'profesores',
  label: 'Profesores',
  path: 'profesores',
  roles: ['ceo', 'admin', 'user'],
  icon: 'teacher',
  navGroup: 'principal',
}
