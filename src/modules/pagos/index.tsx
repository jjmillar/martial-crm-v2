import type { ModuleManifest } from '../types'

export const pagos: ModuleManifest = {
  id: 'pagos',
  label: 'Pagos y planes',
  path: 'pagos',
  roles: ['ceo', 'admin', 'user', 'alumno'],
  icon: 'wallet',
  navGroup: 'principal',
  also: ['planes', 'pagar'],
  /** Staff see payments in Contabilidad; students keep this menu for their own payments and plans. */
  navFor: ['alumno'],
}
