import { Navigate } from 'react-router-dom'
import type { ModuleManifest } from '../types'
import { TareasPage } from './TareasPage'

export const tareas: ModuleManifest = {
  id: 'tareas',
  label: 'Tareas',
  path: 'tareas',
  roles: ['ceo', 'admin', 'user'],
  element: <TareasPage />,
  icon: 'board',
  navGroup: 'gestion',
}

// Old name of the module: keep links working.
export const pendientes: ModuleManifest = {
  id: 'pendientes',
  label: 'Pendientes',
  path: 'pendientes',
  roles: ['ceo', 'admin', 'user'],
  element: <Navigate to="/app/tareas" replace />,
  hidden: true,
}
