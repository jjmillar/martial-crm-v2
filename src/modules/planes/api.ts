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
