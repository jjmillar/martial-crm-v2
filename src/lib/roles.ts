import type { AppRole } from '../modules/types'

// UI labels for roles (S3): the CEO is a platform role, admin/user are per school.
export const roleLabel: Record<AppRole, string> = {
  ceo: 'CEO',
  admin: 'Administrador',
  user: 'Usuario',
}
