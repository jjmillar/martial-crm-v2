import type { ModuleManifest } from '../types'

export const planes: ModuleManifest = {
  id: 'planes',
  label: 'Planes',
  path: 'planes',
  roles: ['ceo', 'admin', 'user', 'alumno'],
  icon: 'plan',
  navGroup: 'principal',
  // Shown inside "Pagos y planes" (tab), not as its own menu item.
  hidden: true,
}
