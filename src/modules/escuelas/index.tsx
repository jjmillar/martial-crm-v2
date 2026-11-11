import type { ModuleManifest } from '../types'
import { EscuelasPage } from './EscuelasPage'

export const escuelas: ModuleManifest = {
  id: 'escuelas',
  label: 'Escuelas',
  path: 'escuelas',
  roles: ['ceo'],
  element: <EscuelasPage />,
  icon: 'school',
  navGroup: 'gestion',
}
