import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useSchool } from '../../lib/school'
import { listPlans, plansKey } from '../planes/api'
import { CodesBoard } from './CodesBoard'
import { codesKey, deleteCode, listCodes, saveCode } from './api'

/** "Códigos de descuento", a section of Contabilidad for the school's admins. */
export function DescuentosSection() {
  const { activeSchool, role } = useSchool()
  const schoolId = activeSchool?.id
  const isAdmin = role === 'admin' || role === 'ceo'
  const qc = useQueryClient()
  const codes = useQuery({ queryKey: codesKey(schoolId), queryFn: () => listCodes(schoolId!), enabled: Boolean(schoolId) && isAdmin })
  const plans = useQuery({ queryKey: plansKey(schoolId), queryFn: () => listPlans(schoolId!), enabled: Boolean(schoolId) && isAdmin })
  if (!isAdmin || !activeSchool) return null
  const refresh = () => qc.invalidateQueries({ queryKey: codesKey(schoolId) })
  return (
    <CodesBoard audience="alumnos" codes={codes.data} loading={codes.isLoading} failed={codes.isError} plans={plans.data ?? []}
      persistKey="descuentos.inactivos"
      onSave={async (id, input) => { await saveCode(activeSchool.id, id, input); await refresh() }}
      onDelete={async (id) => { await deleteCode(id); await refresh() }} />
  )
}
