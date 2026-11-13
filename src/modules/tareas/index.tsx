import type { ModuleManifest } from '../types'

export const tareas: ModuleManifest = {
  id: 'tareas',
  label: 'Tareas',
  path: 'tareas',
  roles: ['ceo', 'admin', 'user'],
  icon: 'board',
  navGroup: 'gestion',
}

// Old name of the module: keep links working.
export const pendientes: ModuleManifest = {
  id: 'pendientes',
  label: 'Pendientes',
  path: 'pendientes',
  roles: ['ceo', 'admin', 'user'],
  hidden: true,
}
