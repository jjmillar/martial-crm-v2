import type { ModuleManifest } from '../types'
import { AjustesPage } from './AjustesPage'

export const ajustes: ModuleManifest = {
  id: 'ajustes',
  label: 'Ajustes',
  path: 'ajustes',
  roles: ['ceo', 'admin', 'user', 'alumno'],
  element: <AjustesPage />,
  icon: 'settings',
  navGroup: 'gestion',
}
