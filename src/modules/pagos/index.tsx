import type { ModuleManifest } from '../types'

export const pagos: ModuleManifest = {
  id: 'pagos',
  label: 'Pagos y planes',
  path: 'pagos',
  roles: ['ceo', 'admin', 'user', 'alumno'],
  icon: 'wallet',
  navGroup: 'principal',
  also: ['planes', 'pagar'],
}
