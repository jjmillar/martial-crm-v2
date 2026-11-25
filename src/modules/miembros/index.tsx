import type { ModuleManifest } from '../types'

// Alumnos, Profesores and Administrativos in one place (accordions). Administrativos only for CEO/admin.
export const miembros: ModuleManifest = {
  id: 'miembros',
  label: 'Miembros',
  path: 'miembros',
  roles: ['ceo', 'admin', 'user'],
  icon: 'users',
  navGroup: 'principal',
  also: ['alumnos', 'profesores'],
}
