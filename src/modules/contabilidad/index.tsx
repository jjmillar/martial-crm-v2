import type { ModuleManifest } from '../types'

// Money in one place (accordions): Pagos, Inscripciones, Historial, Egresos (admins), Planes and Códigos de descuento.
export const contabilidad: ModuleManifest = {
  id: 'contabilidad',
  label: 'Contabilidad',
  path: 'contabilidad',
  roles: ['ceo', 'admin', 'user'],
  icon: 'wallet',
  navGroup: 'principal',
  also: ['pagos', 'matriculas', 'planes'],
}
