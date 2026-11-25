import type { ModuleManifest } from '../types'

export const planes: ModuleManifest = {
  id: 'planes',
  label: 'Planes',
  path: 'planes',
  roles: ['ceo', 'admin', 'user', 'alumno'],
  icon: 'plan',
  navGroup: 'principal',
  // A section of Contabilidad (staff) and of "Pagos y planes" (students), not its own menu item.
  hidden: true,
}
