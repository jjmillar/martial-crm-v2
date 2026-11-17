'use client'
import { ModulePage } from '@/shell/ModulePage'
import { RequireRole } from '@/shell/RequireRole'
import { PagoEditor } from '@/modules/pagos/PagoForm'

// Students pay from the gateway (/app/pagar); editing payments stays with the staff.
export default function Page() {
  return <ModulePage id="pagos"><RequireRole roles={['ceo', 'admin', 'user']}><PagoEditor /></RequireRole></ModulePage>
}
