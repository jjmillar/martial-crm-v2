import type { ModuleManifest } from '../types'

// The school in one place (accordions, like Miembros): Escuelas (CEO: create and edit), Asistencia and Clases.
export const escuelas: ModuleManifest = {
  id: 'escuelas',
  label: 'Escuelas',
  path: 'escuelas',
  roles: ['ceo', 'admin', 'user'],
  icon: 'school',
  navGroup: 'principal',
  also: ['asistencia', 'clases'],
}
