import type { ModuleManifest } from '../types'

// The payment gateway: route only (reached from every "Pagar" button), never in the navigation.
export const pagar: ModuleManifest = {
  id: 'pagar',
  label: 'Pagar',
  path: 'pagar',
  roles: ['alumno'],
  hidden: true,
}
