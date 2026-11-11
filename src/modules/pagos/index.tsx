import type { ModuleManifest } from '../types'
import { PagosRoutes } from './PagosRoutes'

export const pagos: ModuleManifest = {
  id: 'pagos',
  label: 'Pagos',
  path: 'pagos',
  roles: ['ceo', 'admin', 'user'],
  element: <PagosRoutes />,
  icon: 'wallet',
  navGroup: 'principal',
}
