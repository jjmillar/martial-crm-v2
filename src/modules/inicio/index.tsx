import type { ModuleManifest } from '../types'
import { InicioPage } from './InicioPage'

export const inicio: ModuleManifest = {
  id: 'inicio',
  label: 'Inicio',
  path: 'inicio',
  roles: ['ceo', 'admin', 'user', 'alumno'],
  element: <InicioPage />,
  icon: 'home',
  navGroup: 'principal',
}
