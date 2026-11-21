import { supabase } from '../../lib/supabase'
import { formatCLP } from '../../lib/money'
import { formatDate, todayIso } from '../../lib/dates'
import type { DiscountCode, DiscountScope } from '../../lib/database.types'

// Discount codes. Admins manage them here; anyone redeems through the RPCs (students never read the table).

export type CodeRow = DiscountCode & { uses: number; saved: number }
export const codesKey = (schoolId: string | undefined) => ['discount-codes', schoolId] as const

export async function listCodes(schoolId: string): Promise<CodeRow[]> {
  const [codes, uses] = await Promise.all([
    supabase.from('discount_codes').select('*').eq('school_id', schoolId).order('created_at', { ascending: false }),
    supabase.rpc('discount_code_uses', { p_school_id: schoolId }),
  ])
  if (codes.error) throw codes.error
  if (uses.error) throw uses.error
  const by = new Map((uses.data ?? []).map((u) => [u.code_id, u]))
  return codes.data.map((c) => ({ ...c, uses: by.get(c.id)?.uses ?? 0, saved: Number(by.get(c.id)?.saved ?? 0) }))
}

export type CodeInput = {
  code: string
  description: string | null
  percent: number | null
  amount: number | null
  scope: DiscountScope
  plan_id: string | null
  max_uses: number | null
  valid_from: string | null
  valid_until: string | null
  active: boolean
}

export const normalizeCode = (s: string) => s.toUpperCase().replace(/\s+/g, '').replace(/[^A-Z0-9-]/g, '').slice(0, 24)

export async function saveCode(schoolId: string, id: string | null, input: CodeInput): Promise<void> {
  const q = id ? supabase.from('discount_codes').update(input).eq('id', id) : supabase.from('discount_codes').insert({ ...input, school_id: schoolId })
  const { error } = await q
  if (!error) return
  const m = error.message
  if (m.includes('discount_codes_school_id_code_key')) throw new Error('Ya existe un código con ese nombre.')
  if (m.includes('below uses')) throw new Error('Los usos máximos no pueden ser menos que los usos que ya tiene.')
  if (m.includes('discount_codes_dates')) throw new Error('La fecha de término no puede ser anterior a la de inicio.')
  if (m.includes('discount_codes_code_check')) throw new Error('El código debe tener entre 3 y 24 letras, números o guiones.')
  if (m.includes('row-level security')) throw new Error('Solo un administrador puede crear códigos.')
  throw new Error('No se pudo guardar el código.')
}

export async function deleteCode(id: string): Promise<void> {
  const { error } = await supabase.from('discount_codes').delete().eq('id', id)
  if (error) throw new Error(error.message.includes('foreign key') ? 'Este código ya se usó: desactívalo en vez de eliminarlo.' : 'No se pudo eliminar.')
}

const errors: Record<string, string> = {
  invalid: 'Ese código no existe o no está activo.',
  not_yet: 'Ese código aún no está vigente.',
  expired: 'Ese código ya venció.',
  used: 'Ya usaste este código.',
  exhausted: 'Ese código ya no tiene usos disponibles.',
  plan: 'Ese código es para otro plan.',
  plan_only: 'Ese código es un descuento de plan: úsalo en un pago de tu plan.',
  payment_only: 'Ese código es para un solo pago: aplícalo en el pago.',
  has_discount: 'Ya tiene un descuento aplicado.',
  not_pending: 'Este pago ya no está pendiente.',
  in_review: 'Este pago ya está en revisión.',
  too_many: 'Demasiados intentos. Prueba de nuevo en una hora.',
}

export type Redeemed = { ok: true; discount?: number; amount?: number; scope?: DiscountScope; code: string }

async function call(fn: 'redeem_discount' | 'redeem_discount_enrollment', args: Record<string, string>): Promise<Redeemed> {
  const { data, error } = await supabase.rpc(fn, args as never)
  if (error) throw new Error('No se pudo aplicar el código.')
  const r = data as { ok?: boolean; error?: string } & Redeemed
  if (!r?.ok) throw new Error(errors[r?.error ?? ''] ?? 'No se pudo aplicar el código.')
  return r
}

export const redeemOnPayment = (paymentId: string, code: string) => call('redeem_discount', { p_payment_id: paymentId, p_code: normalizeCode(code) })
export const redeemOnEnrollment = (enrollmentId: string, code: string) => call('redeem_discount_enrollment', { p_enrollment_id: enrollmentId, p_code: normalizeCode(code) })

export async function removeFromPayment(paymentId: string): Promise<void> {
  const { error } = await supabase.rpc('remove_discount', { p_payment_id: paymentId })
  if (error) throw new Error(error.message.includes('not pending') ? 'Solo se puede quitar el descuento de un pago pendiente.' : 'No se pudo quitar el descuento.')
}
export async function removeFromEnrollment(enrollmentId: string): Promise<void> {
  const { error } = await supabase.rpc('remove_enrollment_discount', { p_enrollment_id: enrollmentId })
  if (error) throw new Error('No se pudo quitar el descuento.')
}

// Labels ------------------------------------------------------------------------------------------------------
export const valueLabel = (c: { percent: number | null; amount: number | null }) => (c.percent ? `${c.percent} %` : formatCLP(c.amount ?? 0))
export const usesLabel = (c: { uses: number; max_uses: number | null }) =>
  c.max_uses === 1 ? (c.uses ? 'Uso único · usado' : 'Uso único') : c.max_uses ? `${c.uses} de ${c.max_uses} usos` : `${c.uses} ${c.uses === 1 ? 'uso' : 'usos'} · sin límite`

export type CodeState = 'activo' | 'inactivo' | 'vencido' | 'agotado' | 'programado'
export function codeState(c: CodeRow, today = todayIso()): CodeState {
  if (!c.active) return 'inactivo'
  if (c.valid_until && today > c.valid_until) return 'vencido'
  if (c.max_uses && c.uses >= c.max_uses) return 'agotado'
  if (c.valid_from && today < c.valid_from) return 'programado'
  return 'activo'
}
export const stateLabel: Record<CodeState, string> = { activo: 'Activo', inactivo: 'Inactivo', vencido: 'Vencido', agotado: 'Agotado', programado: 'Programado' }

export function validityLabel(c: { valid_from: string | null; valid_until: string | null }): string | null {
  if (c.valid_from && c.valid_until) return `${formatDate(c.valid_from)} – ${formatDate(c.valid_until)}`
  if (c.valid_until) return `Hasta el ${formatDate(c.valid_until)}`
  if (c.valid_from) return `Desde el ${formatDate(c.valid_from)}`
  return null
}
