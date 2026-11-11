import type { ModuleManifest } from '../types'
import { CuentaPage } from './CuentaPage'

export const cuenta: ModuleManifest = {
  id: 'cuenta',
  label: 'Mi cuenta',
  path: 'cuenta',
  roles: ['ceo', 'admin', 'user'],
  element: <CuentaPage />,
  icon: 'user',
  navGroup: 'gestion',
}
