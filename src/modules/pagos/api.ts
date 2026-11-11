import { supabase } from '../../lib/supabase'
import type { Payment, PaymentMethod, PaymentStatus } from '../../lib/database.types'

export type PaymentRow = Payment & {
  student: { id: string; full_name: string | null; email: string | null } | null
  enrollment: { id: string; plan: { name: string } | null } | null
}

export const paymentsKey = (schoolId: string | undefined) => ['payments', schoolId] as const

const select = '*, student:students(id, full_name, email), enrollment:enrollments(id, plan:plans(name))'

export async function listPayments(schoolId: string): Promise<PaymentRow[]> {
  const { data, error } = await supabase.from('payments').select(select).eq('school_id', schoolId).order('created_at', { ascending: false }).limit(1000)
  if (error) throw error
  return data as unknown as PaymentRow[]
}

export async function listStudentPayments(studentId: string): Promise<PaymentRow[]> {
  const { data, error } = await supabase.from('payments').select(select).eq('student_id', studentId).order('created_at', { ascending: false })
  if (error) throw error
  return data as unknown as PaymentRow[]
}

export async function getPayment(id: string): Promise<PaymentRow | null> {
  const { data, error } = await supabase.from('payments').select(select).eq('id', id).maybeSingle()
  if (error) throw error
  return data as unknown as PaymentRow | null
}

function friendly(message: string): string {
  if (message.includes('row-level security')) return 'No tienes permiso para esta acción. Los pagos los confirma un administrador.'
  return 'No se pudo guardar. Revisa los datos e intenta de nuevo.'
}

export type PaymentInput = {
  student_id: string
  enrollment_id: string | null
  concept: string
  amount: number
  method: PaymentMethod
  status: PaymentStatus
  due_date: string | null
  notes: string | null
}

/** id/receipt_path let the caller upload the receipt first and create the payment already linked to it. */
export async function createPayment(schoolId: string, input: PaymentInput & { id?: string; receipt_path?: string | null }): Promise<Payment> {
  const { data, error } = await supabase.from('payments').insert({ ...input, school_id: schoolId }).select('*').single()
  if (error) throw new Error(friendly(error.message))
  return data
}

export async function updatePayment(id: string, patch: Partial<PaymentInput> & { receipt_path?: string | null }): Promise<Payment> {
  const { data, error } = await supabase.from('payments').update(patch).eq('id', id).select('*').single()
  if (error) throw new Error(friendly(error.message))
  return data
}

export async function deletePayment(id: string, receiptPath: string | null): Promise<void> {
  const { error, count } = await supabase.from('payments').delete({ count: 'exact' }).eq('id', id)
  if (error) throw new Error(friendly(error.message))
  if (count === 0) throw new Error('Solo los administradores pueden eliminar pagos.')
  if (receiptPath) await supabase.storage.from('receipts').remove([receiptPath])
}

/** Links an uploaded receipt (members: while pending or empty; admins: always). */
export async function attachReceipt(paymentId: string, path: string): Promise<void> {
  const { error } = await supabase.rpc('attach_payment_receipt', { p_payment_id: paymentId, p_path: path })
  if (error) throw new Error(error.message.includes('only admins') ? 'Solo un administrador puede reemplazar el comprobante de un pago confirmado.' : 'No se pudo adjuntar el comprobante.')
}

const MAX_RECEIPT = 5 * 1024 * 1024

/** Uploads a receipt to the private bucket under <school>/<payment>/ and returns its path. */
export async function uploadReceipt(schoolId: string, paymentId: string, file: File): Promise<string> {
  if (file.size > MAX_RECEIPT) throw new Error('El comprobante supera los 5 MB.')
  const ext = (file.name.split('.').pop() ?? 'bin').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 5) || 'bin'
  const path = `${schoolId}/${paymentId}/comprobante-${Date.now()}.${ext}`
  const { error } = await supabase.storage.from('receipts').upload(path, file, { contentType: file.type || undefined, upsert: false })
  if (error) throw new Error(error.message.includes('mime') ? 'Formato no permitido: usa JPG, PNG, WEBP, HEIC o PDF.' : 'No se pudo subir el comprobante.')
  return path
}

/** Short-lived link to view a private receipt. */
export async function receiptUrl(path: string): Promise<string> {
  const { data, error } = await supabase.storage.from('receipts').createSignedUrl(path, 60 * 10)
  if (error) throw new Error('No se pudo abrir el comprobante.')
  return data.signedUrl
}

export async function emailReceipt(schoolId: string, paymentId: string): Promise<void> {
  const { error } = await supabase.functions.invoke('send-email', { body: { template: 'payment_receipt', school_id: schoolId, payment_id: paymentId } })
  if (error) {
    const ctx = (error as { context?: Response }).context
    const body = ctx ? await ctx.json().catch(() => null) : null
    throw new Error(body?.error ?? 'No se pudo enviar el comprobante.')
  }
}

export const methodLabel: Record<PaymentMethod, string> = { transferencia: 'Transferencia', efectivo: 'Efectivo', tarjeta: 'Tarjeta', otro: 'Otro' }
export const statusLabel: Record<PaymentStatus, string> = { pendiente: 'Pendiente', pagado: 'Pagado', fallido: 'Fallido', reembolsado: 'Reembolsado' }
