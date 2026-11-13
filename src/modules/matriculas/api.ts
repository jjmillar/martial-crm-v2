import { supabase } from '../../lib/supabase'
import { daysUntil } from '../../lib/dates'
import type { Enrollment, EnrollmentStatus } from '../../lib/database.types'

export type EnrollmentRow = Enrollment & {
  student: { id: string; full_name: string | null; email: string | null; phone: string | null } | null
  plan: { id: string; name: string; billing_cycle: string; duration_days: number | null } | null
}

export const enrollmentsKey = (schoolId: string | undefined) => ['enrollments', schoolId] as const

const select = '*, student:students(id, full_name, email, phone), plan:plans(id, name, billing_cycle, duration_days)'

export async function listEnrollments(schoolId: string): Promise<EnrollmentRow[]> {
  const { data, error } = await supabase.from('enrollments').select(select).eq('school_id', schoolId).order('ends_at', { ascending: true, nullsFirst: false })
  if (error) throw error
  return data as EnrollmentRow[]
}

export async function listStudentEnrollments(studentId: string): Promise<EnrollmentRow[]> {
  const { data, error } = await supabase.from('enrollments').select(select).eq('student_id', studentId).order('start_date', { ascending: false })
  if (error) throw error
  return data as EnrollmentRow[]
}

export async function getEnrollment(id: string): Promise<EnrollmentRow | null> {
  const { data, error } = await supabase.from('enrollments').select(select).eq('id', id).maybeSingle()
  if (error) throw error
  return data as EnrollmentRow | null
}

function friendly(message: string): string {
  if (message.includes('enrollments_one_active')) return 'Este alumno ya tiene una inscripción activa en ese plan.'
  if (message.includes('enrollments_dates')) return 'El vencimiento no puede ser anterior al inicio.'
  if (message.includes('row-level security')) return 'No tienes permiso para esta acción.'
  return 'No se pudo guardar. Revisa los datos e intenta de nuevo.'
}

export type EnrollmentInput = {
  student_id: string
  plan_id: string
  start_date: string
  ends_at: string | null
  price: number
  enrollment_fee: number
  notes: string | null
  status?: EnrollmentStatus
}

export async function createEnrollment(schoolId: string, input: EnrollmentInput): Promise<Enrollment> {
  const { data, error } = await supabase.from('enrollments').insert({ ...input, school_id: schoolId }).select('*').single()
  if (error) throw new Error(friendly(error.message))
  return data
}

export async function updateEnrollment(id: string, patch: Partial<EnrollmentInput> & { status?: EnrollmentStatus }): Promise<Enrollment> {
  const { data, error } = await supabase.from('enrollments').update(patch).eq('id', id).select('*').single()
  if (error) throw new Error(friendly(error.message))
  return data
}

export async function deleteEnrollment(id: string): Promise<void> {
  const { error, count } = await supabase.from('enrollments').delete({ count: 'exact' }).eq('id', id)
  if (error) throw new Error(friendly(error.message))
  if (count === 0) throw new Error('Solo los administradores pueden eliminar inscripciones.')
}

/** What the UI shows: the stored status plus "por vencer" / "vencida" derived from ends_at. */
export type Phase = 'activa' | 'por_vencer' | 'vencida' | 'pausada' | 'cancelada'
export const SOON_DAYS = 7

export function phaseOf(e: Pick<Enrollment, 'status' | 'ends_at'>, today?: string): Phase {
  if (e.status !== 'activa') return e.status
  if (!e.ends_at) return 'activa'
  const d = daysUntil(e.ends_at, today)
  if (d < 0) return 'vencida'
  if (d <= SOON_DAYS) return 'por_vencer'
  return 'activa'
}

export const phaseLabel: Record<Phase, string> = {
  activa: 'Activa', por_vencer: 'Por vencer', vencida: 'Vencida', pausada: 'Pausada', cancelada: 'Cancelada',
}
