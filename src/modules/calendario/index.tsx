import type { ModuleManifest } from '../types'
import { CalendarioPage } from './CalendarioPage'

export const calendario: ModuleManifest = {
  id: 'calendario',
  label: 'Calendario',
  path: 'calendario',
  roles: ['ceo', 'admin', 'user'],
  element: <CalendarioPage />,
  icon: 'calendar',
  navGroup: 'principal',
}
