import type { ModuleManifest } from '../types'

export const pagos: ModuleManifest = {
  id: 'pagos',
  label: 'Pagos',
  path: 'pagos',
  roles: ['ceo', 'admin', 'user'],
  icon: 'wallet',
  navGroup: 'principal',
}
