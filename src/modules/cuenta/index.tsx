import type { ModuleManifest } from '../types'

export const cuenta: ModuleManifest = {
  id: 'cuenta',
  label: 'Mi cuenta',
  path: 'cuenta',
  roles: ['ceo', 'admin', 'user', 'alumno'],  icon: 'user',
  navGroup: 'gestion',
  hidden: true,
}
