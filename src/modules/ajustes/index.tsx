import type { ModuleManifest } from '../types'

export const ajustes: ModuleManifest = {
  id: 'ajustes',
  label: 'Ajustes',
  path: 'ajustes',
  roles: ['ceo', 'admin', 'user', 'alumno'],  icon: 'settings',
  navGroup: 'gestion',
}
