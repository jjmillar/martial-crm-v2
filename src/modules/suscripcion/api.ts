import { supabase } from '../../lib/supabase'
import { formatDate } from '../../lib/dates'
import { normalizeCode, type CodeInput, type CodeLike } from '../descuentos/api'

// Paying Martial CRM (migration 20261126000001_platform_billing). The customer (a school owner) reads their
// subscription and pays by transfer; the platform operator confirms the transfers and manages the discount codes.
// Untyped until the generated types include these tables and functions (scripts/regen-types.sh after the push).
type Res<T> = Promise<{ data: T | null; error: { message: string } | null }>
type Q<T> = Res<T> & {
  select: (c?: string) => Q<T>; eq: (c: string, v: unknown) => Q<T>; order: (c: string, o?: object) => Q<T>
  update: (v: object) => Q<T>; insert: (v: object) => Q<T>; delete: () => Q<T>; maybeSingle: () => Q<T>
}
const db = supabase as unknown as { rpc: <T>(fn: string, args?: object) => Res<T>; from: <T>(t: string) => Q<T> }

export type SubStatus = 'prueba' | 'activa' | 'suspendida' | 'cancelada'
export type InvoiceStatus = 'pendiente' | 'por_confirmar' | 'pagada' | 'anulada'
export type BillPlan = { id: string; name: string; price_clp: number; period: 'mensual' | 'anual'; max_schools: number | null; max_students: number | null }
export type Invoice = {
  id: string; plan_id: string | null; plan_name: string; period: 'mensual' | 'anual'; period_start: string; period_end: string
  base_amount: number; discount_code: string | null; discount_amount: number; amount: number; status: InvoiceStatus
  reference: string | null; reported_at: string | null; reject_reason: string | null; decided_at: string | null; created_at: string
}
export type Transfer = { bank: string | null; account_type: string | null; account_number: string; holder: string | null; rut: string | null; email: string | null }
export type MySubscription = {
  status: SubStatus | null; trial_ends: string | null; period_end: string | null
  plan: BillPlan | null; plans: BillPlan[]
  discount: { code: string; percent: number | null; fixed: number | null } | null
  usage: { schools: number; students: number }
  transfer: Transfer | null
  invoices: Invoice[]
}

export const subStatusLabel: Record<SubStatus, string> = { prueba: 'En prueba', activa: 'Activa', suspendida: 'Suspendida', cancelada: 'Cancelada' }
export const invoiceStatusLabel: Record<InvoiceStatus, string> = { pendiente: 'Por pagar', por_confirmar: 'Por confirmar', pagada: 'Pagada', anulada: 'Anulada' }
export const perLabel = (p: 'mensual' | 'anual') => (p === 'anual' ? '/año' : '/mes')

export const mySubKey = ['my-subscription'] as const
export async function fetchMySubscription(): Promise<MySubscription> {
  const { data, error } = await db.rpc<MySubscription>('my_subscription')
  if (error || !data) throw new Error('No se pudo cargar tu suscripción.')
  return data
}

export async function checkout(planId: string): Promise<string> {
  const { data, error } = await db.rpc<string>('subscription_checkout', { p_plan: planId })
  if (error) throw new Error(error.message.includes('in review') ? 'Tu transferencia está en revisión: espera la confirmación antes de cambiar el plan.' : 'No se pudo preparar el pago. Intenta de nuevo.')
  return data!
}

const codeErrors: Record<string, string> = {
  invalid: 'Ese código no existe o no está activo.',
  not_yet: 'Ese código aún no está vigente.',
  expired: 'Ese código ya venció.',
  used: 'Ya usaste este código.',
  exhausted: 'Ese código ya no tiene usos disponibles.',
  plan: 'Ese código es para otro plan.',
  has_discount: 'Este cobro ya tiene un descuento.',
  in_review: 'Tu transferencia está en revisión.',
  no_invoice: 'Elige primero el plan que vas a pagar.',
  too_many: 'Demasiados intentos. Prueba de nuevo en una hora.',
}
export async function applyCode(code: string): Promise<{ discount: number; amount: number; scope: 'pago' | 'plan'; code: string }> {
  const { data, error } = await db.rpc<{ ok?: boolean; error?: string; discount: number; amount: number; scope: 'pago' | 'plan'; code: string }>('subscription_apply_code', { p_code: normalizeCode(code) })
  if (error) throw new Error('No se pudo aplicar el código.')
  if (!data?.ok) throw new Error(codeErrors[data?.error ?? ''] ?? 'No se pudo aplicar el código.')
  return data
}

export async function reportTransfer(reference: string): Promise<void> {
  const { error } = await db.rpc<null>('subscription_report_transfer', { p_reference: reference.trim() || null })
  if (error) throw new Error(error.message.includes('transfer not configured') ? 'Aún no están los datos de transferencia. Escríbenos para pagar.' : 'No se pudo avisar la transferencia. Intenta de nuevo.')
}

// ---- Operator ----------------------------------------------------------------------------------------------------
export type OpInvoice = Invoice & { owner_id: string; customer: string | null; email: string | null }
export const opInvoicesKey = ['platform', 'invoices'] as const
export async function fetchOpInvoices(): Promise<OpInvoice[]> {
  const { data, error } = await db.rpc<OpInvoice[]>('platform_invoices_list', { p_limit: 300 })
  if (error) throw new Error('No se pudieron cargar los pagos.')
  return data ?? []
}
export async function decideInvoice(id: string, approve: boolean, reason?: string): Promise<void> {
  const { error } = await db.rpc<null>('platform_decide_invoice', { p_id: id, p_approve: approve, p_reason: reason?.trim() || null })
  if (error) throw new Error('No se pudo guardar la decisión.')
}

export type TransferSettings = {
  transfer_bank: string | null; transfer_account_type: string | null; transfer_account_number: string | null
  transfer_holder: string | null; transfer_rut: string | null; transfer_email: string | null
}
export const opSettingsKey = ['platform', 'settings'] as const
export async function fetchSettings(): Promise<TransferSettings> {
  const { data, error } = await db.from<TransferSettings>('platform_settings')
    .select('transfer_bank, transfer_account_type, transfer_account_number, transfer_holder, transfer_rut, transfer_email').maybeSingle()
  if (error || !data) throw new Error('No se pudieron cargar los datos de transferencia.')
  return data
}
export async function saveSettings(v: TransferSettings): Promise<void> {
  const { error } = await db.from('platform_settings').update(v).eq('id', true).select('transfer_bank')
  if (error) throw new Error('No se pudieron guardar los datos de transferencia.')
}

export const opCodesKey = ['platform', 'codes'] as const
export async function fetchOpCodes(): Promise<CodeLike[]> {
  const [codes, uses] = await Promise.all([
    db.from<(CodeInput & { id: string })[]>('platform_discount_codes').select('*').order('created_at', { ascending: false }),
    db.rpc<{ code_id: string; uses: number; saved: number }[]>('platform_discount_uses'),
  ])
  if (codes.error || uses.error) throw new Error('No se pudieron cargar los códigos.')
  const by = new Map((uses.data ?? []).map((u) => [u.code_id, u]))
  return (codes.data ?? []).map((c) => ({ ...c, uses: by.get(c.id)?.uses ?? 0, saved: Number(by.get(c.id)?.saved ?? 0) }))
}
export async function saveOpCode(id: string | null, input: CodeInput): Promise<void> {
  const { error } = id ? await db.from('platform_discount_codes').update(input).eq('id', id) : await db.from('platform_discount_codes').insert(input)
  if (!error) return
  const m = error.message
  if (m.includes('platform_discount_codes_code_key')) throw new Error('Ya existe un código con ese nombre.')
  if (m.includes('platform_discount_codes_dates')) throw new Error('La fecha de término no puede ser anterior a la de inicio.')
  if (m.includes('code_check')) throw new Error('El código debe tener entre 3 y 24 letras, números o guiones.')
  throw new Error('No se pudo guardar el código.')
}
export async function deleteOpCode(id: string): Promise<void> {
  const { error } = await db.from('platform_discount_codes').delete().eq('id', id)
  if (error) throw new Error(error.message.includes('foreign key') ? 'Este código ya se usó: desactívalo en vez de eliminarlo.' : 'No se pudo eliminar.')
}

/** One line about where the subscription stands (trial end, paid until, overdue). */
export function subSummary(s: MySubscription): string {
  const plan = s.plan ? `Plan ${s.plan.name}` : 'Sin plan'
  if (s.status === 'prueba') return `${plan} · prueba hasta el ${s.trial_ends ? formatDate(s.trial_ends) : '—'}`
  if (s.status === 'activa') return `${plan} · ${s.period_end ? `pagado hasta el ${formatDate(s.period_end)}` : 'activa'}`
  return `${plan} · ${s.status ? subStatusLabel[s.status].toLowerCase() : 'sin suscripción'}`
}
