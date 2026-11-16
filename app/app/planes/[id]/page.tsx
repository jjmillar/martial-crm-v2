'use client'
import { ModulePage } from '@/shell/ModulePage'
import { RequireRole } from '@/shell/RequireRole'
import { PlanEditor } from '@/modules/planes/PlanForm'

// Students see the plan list only; editing stays with the staff.
export default function Page() {
  return <ModulePage id="planes"><RequireRole roles={['ceo', 'admin', 'user']}><PlanEditor /></RequireRole></ModulePage>
}
