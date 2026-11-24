import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { useSchool } from '../../lib/school'
import type { School } from '../../lib/database.types'

// Paying, like attendance, has a confirmation: the student (or guardian) reports a transfer or a cash payment ("Ya
// pagué") and the school's admins approve it → paid with a double check (✓✓: the student reported it and the school
// confirmed it). An admin can also mark it paid directly (✓: confirmed by the school). Online gateways come later.
export type PayMethod = 'transferencia' | 'efectivo'

export type Transfer = { bank: string | null; type: string | null; number: string; holder: string | null; rut: string | null; email: string | null }

/** The school's transfer data, or null while it is not configured (account number is the minimum). */
export const transferOf = (s: School | null | undefined): Transfer | null =>
  s?.transfer_account_number
    ? { bank: s.transfer_bank, type: s.transfer_account_type, number: s.transfer_account_number, holder: s.transfer_holder, rut: s.transfer_rut, email: s.transfer_email }
    : null

export const payHref = (paymentId: string) => `/app/pagar/${paymentId}`

export type Submission = {
  id: string; payment_id: string; school_id: string; student_id: string; method: string; amount: number; reference: string | null
  status: 'pendiente' | 'aprobada' | 'rechazada'; reject_reason: string | null; created_at: string; decided_at: string | null
}
const subCols = 'id, payment_id, school_id, student_id, method, amount, reference, status, reject_reason, created_at, decided_at'

/** Latest submission per payment ("paymentId" → submission). */
export async function latestSubmissions(filter: { studentId?: string; schoolId?: string }): Promise<Map<string, Submission>> {
  let q = supabase.from('payment_submissions').select(subCols).order('created_at', { ascending: false }).limit(500)
  if (filter.studentId) q = q.eq('student_id', filter.studentId)
  if (filter.schoolId) q = q.eq('school_id', filter.schoolId)
  const { data, error } = await q
  if (error) throw error
  const m = new Map<string, Submission>()
  for (const s of data as Submission[]) if (!m.has(s.payment_id)) m.set(s.payment_id, s)
  return m
}
export const submissionsKey = (k: string | undefined) => ['payment-submissions', k] as const

/** Every transfer report of a student, with the payment's concept (for the payment history). */
export async function listMySubmissions(studentId: string): Promise<(Submission & { concept: string })[]> {
  const { data, error } = await supabase.from('payment_submissions').select(`${subCols}, payment:payments(concept)`)
    .eq('student_id', studentId).order('created_at', { ascending: false }).limit(200)
  if (error) throw error
  return (data as unknown as (Submission & { payment: { concept: string } | null })[]).map((s) => ({ ...s, concept: s.payment?.concept ?? 'Pago' }))
}

export async function submitPayment(paymentId: string, method: PayMethod, reference: string): Promise<void> {
  const { error } = await supabase.rpc('submit_payment', { p_payment_id: paymentId, p_method: method, p_reference: reference.trim().slice(0, 120) })
  if (!error) return
  if (error.message.includes('already submitted')) throw new Error('Este pago ya está en revisión.')
  if (error.message.includes('not pending')) throw new Error('Este pago ya no está pendiente.')
  if (error.message.includes('not configured')) throw new Error('Tu escuela aún no configura sus datos de transferencia.')
  throw new Error('No se pudo enviar el pago. Intenta de nuevo.')
}

// Admins' review queue ------------------------------------------------------------------------------------------
export type Review = Submission & { payment: { concept: string; due_date: string | null } | null; student: { full_name: string | null } | null }
export const reviewsKey = ['payment-reviews'] as const
export async function listReviews(): Promise<Review[]> {
  const { data, error } = await supabase.from('payment_submissions')
    .select(`${subCols}, payment:payments(concept, due_date), student:students(full_name)`)
    .eq('status', 'pendiente').order('created_at')
  if (error) throw error
  return data as unknown as Review[]
}
export function useReviewsCount() {
  const { role } = useSchool()
  const admin = role === 'ceo' || role === 'admin'
  const q = useQuery({ queryKey: reviewsKey, queryFn: listReviews, enabled: admin, refetchInterval: 60_000 })
  return admin ? q.data?.length ?? 0 : 0
}

/** Ids of paid payments with a double check (the student reported them and the school approved). */
export const doubleChecked = (subs: Map<string, Submission> | undefined) =>
  new Set([...(subs?.values() ?? [])].filter((s) => s.status === 'aprobada').map((s) => s.payment_id))
export async function decideSubmission(id: string, approve: boolean, reason?: string): Promise<void> {
  const { error } = await supabase.rpc('decide_payment_submission', { p_id: id, p_approve: approve, p_reason: reason ?? '' })
  if (error) throw new Error(error.message.includes('already decided') ? 'Este pago ya fue revisado.' : 'No se pudo guardar la revisión.')
}
