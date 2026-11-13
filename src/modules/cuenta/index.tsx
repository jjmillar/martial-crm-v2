import type { ModuleManifest } from '../types'
import { CuentaPage } from './CuentaPage'

export const cuenta: ModuleManifest = {
  id: 'cuenta',
  label: 'Mi cuenta',
  path: 'cuenta',
  roles: ['ceo', 'admin', 'user', 'alumno'],
  element: <CuentaPage />,
  icon: 'user',
  navGroup: 'gestion',
}
