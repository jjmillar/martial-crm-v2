import { supabase } from '../../lib/supabase'
import type { Plan, PlanInsert } from '../../lib/database.types'

export const plansKey = (schoolId: string | undefined) => ['plans', schoolId] as const

export async function listPlans(schoolId: string): Promise<Plan[]> {
  const { data, error } = await supabase
    .from('plans')
    .select('*')
    .eq('school_id', schoolId)
    .order('is_default', { ascending: false })
    .order('price')
  if (error) throw error
  return data
}

export async function getPlan(id: string): Promise<Plan | null> {
  const { data, error } = await supabase.from('plans').select('*').eq('id', id).maybeSingle()
  if (error) throw error
  return data
}

function friendly(message: string): string {
  if (message.includes('plans_school_id_name_key')) return 'Ya existe un plan con ese nombre.'
  if (message.includes('plans_default_active')) return 'El plan predeterminado debe estar activo. Marca otro como predeterminado antes de desactivarlo.'
  if (message.includes('row-level security')) return 'Solo los administradores pueden editar planes.'
  if (message.includes('violates foreign key') && message.includes('plans')) return 'Este plan tiene inscripciones asociadas: desactívalo en vez de eliminarlo.'
  return 'No se pudo guardar. Revisa los datos e intenta de nuevo.'
}

export type PlanPayload = Omit<PlanInsert, 'school_id'>

export async function savePlan(schoolId: string, id: string | null, payload: PlanPayload): Promise<Plan> {
  const q = id ? supabase.from('plans').update(payload).eq('id', id) : supabase.from('plans').insert({ ...payload, school_id: schoolId })
  const { data, error } = await q.select('*').single()
  if (error) throw new Error(friendly(error.message))
  return data
}

export async function deletePlan(id: string): Promise<void> {
  const { error, count } = await supabase.from('plans').delete({ count: 'exact' }).eq('id', id)
  if (error) throw new Error(friendly(error.message))
  if (count === 0) throw new Error('Solo los administradores pueden eliminar planes.')
}

// ---- Students contract or renew a plan themselves (contract_plan / withdraw_plan_contract RPCs) ----
export type Contract = { enrollment_id: string; payment_id?: string; kind: 'nuevo' | 'renovacion'; active?: boolean }
const contractErrors: Record<string, string> = {
  not_allowed: 'No puedes contratar planes para este alumno.',
  plan_unavailable: 'Este plan ya no está disponible.',
  already_active: 'Ya tienes este plan vigente. Podrás renovarlo cuando le queden 7 días o menos.',
  too_many: 'Demasiados intentos. Espera un rato e intenta de nuevo.',
  reported: 'Ya avisaste el pago: espera a que tu escuela lo confirme.',
  not_found: 'No hay nada pendiente que anular.',
}
const contractError = (key: string | undefined) => new Error(contractErrors[key ?? ''] ?? 'No se pudo completar. Intenta de nuevo.')

/** Contract a plan (or renew your own near its end): returns the payment to pay, or `active` for free plans. */
export async function contractPlan(studentId: string, planId: string): Promise<Contract> {
  const { data, error } = await supabase.rpc('contract_plan', { p_student_id: studentId, p_plan_id: planId })
  if (error) throw contractError(undefined)
  const r = data as unknown as Contract & { error?: string }
  if (r.error) throw contractError(r.error)
  return r
}

/** Drop a contract or renewal that is still unpaid and not reported. */
export async function withdrawPlanContract(studentId: string, enrollmentId: string): Promise<void> {
  const { data, error } = await supabase.rpc('withdraw_plan_contract', { p_student_id: studentId, p_enrollment_id: enrollmentId })
  if (error) throw contractError(undefined)
  const r = data as unknown as { ok?: boolean; error?: string }
  if (r.error) throw contractError(r.error)
}
