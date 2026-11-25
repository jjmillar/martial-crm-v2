import type { ModuleManifest } from '../types'

export const clases: ModuleManifest = {
  id: 'clases',
  label: 'Clases',
  path: 'clases',
  roles: ['ceo', 'admin', 'user'],
  icon: 'clock',
  navGroup: 'principal',
  /** Lives in Escuelas → Clases; the route keeps the class forms (/app/clases/nueva, /app/clases/<id>). */
  hidden: true,
}
