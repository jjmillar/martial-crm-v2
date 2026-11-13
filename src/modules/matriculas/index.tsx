import type { ModuleManifest } from '../types'

export const matriculas: ModuleManifest = {
  id: 'matriculas',
  label: 'Inscripciones',
  path: 'matriculas',
  roles: ['ceo', 'admin', 'user'],
  icon: 'enroll',
  navGroup: 'principal',
}
