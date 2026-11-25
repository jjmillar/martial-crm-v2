import type { ModuleManifest } from '../types'

export const escuelas: ModuleManifest = {
  id: 'escuelas',
  label: 'Escuelas',
  path: 'escuelas',
  roles: ['ceo'],
  icon: 'school',
  navGroup: 'gestion',
  /** Lives in Ajustes → Escuelas now; the route only redirects there. */
  hidden: true,
}
