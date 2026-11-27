import { supabase } from '../../lib/supabase'
import { formatCLP } from '../../lib/money'
import { dayMonth, monthTitle, todayIso } from '../../lib/dates'
import type { Expense, ExpenseCategory, ExpenseRule, ExpenseRuleKind, ExpenseStatus, PaymentMethod, TeacherPayMode } from '../../lib/database.types'

// Contabilidad → Egresos (admins only: the tables are admin-only in the DB too).

export const expensesKey = (schoolId: string | undefined) => ['expenses', schoolId] as const
export const rulesKey = (schoolId: string | undefined) => ['expense-rules', schoolId] as const

/** Creates the month's expenses of the active rules first (idempotent), then lists the expenses. */
export async function listExpenses(schoolId: string): Promise<Expense[]> {
  await supabase.rpc('sync_expenses', { p_school_id: schoolId })
  const { data, error } = await supabase.from('expenses').select('*').eq('school_id', schoolId).order('date', { ascending: false }).order('created_at', { ascending: false }).limit(1000)
  if (error) throw error
  return data
}

export type RulesData = { rules: ExpenseRule[]; modes: Map<string, TeacherPayMode>; month: Map<string, { classes: number; amount: number }> }

export async function listRules(schoolId: string): Promise<RulesData> {
  const [rules, modes, month] = await Promise.all([
    supabase.from('expense_rules').select('*').eq('school_id', schoolId).order('created_at'),
    supabase.from('teacher_pay').select('teacher_id, mode').eq('school_id', schoolId),
    supabase.rpc('expense_rules_month', { p_school_id: schoolId }),
  ])
  if (rules.error) throw rules.error
  if (modes.error) throw modes.error
  if (month.error) throw month.error
  return {
    rules: rules.data,
    modes: new Map(modes.data.map((m) => [m.teacher_id, m.mode])),
    month: new Map((month.data ?? []).map((m) => [m.rule_id, { classes: m.classes, amount: Number(m.amount) }])),
  }
}

export type ExpenseInput = {
  concept: string
  amount: number
  category: ExpenseCategory
  date: string
  status: ExpenseStatus
  method: PaymentMethod | null
  /** Day it was paid (timestamp); only when status is 'pagado'. */
  paid_at: string | null
  teacher_id: string | null
  notes: string | null
}

/** A calendar day as a timestamp at noon in Chile (the same date whatever the summer time). */
export const dayStamp = (iso: string) => `${iso}T12:00:00-04:00`

export async function saveExpense(schoolId: string, id: string | null, input: ExpenseInput): Promise<void> {
  const q = id ? supabase.from('expenses').update(input).eq('id', id) : supabase.from('expenses').insert({ ...input, school_id: schoolId })
  const { error } = await q
  if (error) throw new Error(error.message.includes('row-level security') ? 'Solo un administrador puede registrar egresos.' : 'No se pudo guardar el egreso.')
}

export async function deleteExpense(id: string): Promise<void> {
  const { error, count } = await supabase.from('expenses').delete({ count: 'exact' }).eq('id', id)
  if (error || count === 0) throw new Error('No se pudo eliminar.')
}

export type RuleInput = {
  kind: ExpenseRuleKind
  concept: string
  category: ExpenseCategory
  teacher_id: string | null
  amount: number
  day_of_month: number
  starts_on: string
  ends_on: string | null
  active: boolean
}

export async function saveRule(schoolId: string, id: string | null, input: RuleInput): Promise<void> {
  const q = id ? supabase.from('expense_rules').update(input).eq('id', id) : supabase.from('expense_rules').insert({ ...input, school_id: schoolId })
  const { error } = await q
  if (!error) return
  if (error.message.includes('expense_rules_dates')) throw new Error('La fecha de término no puede ser anterior a la de inicio.')
  throw new Error('No se pudo guardar la regla.')
}

export async function deleteRule(id: string): Promise<void> {
  const { error } = await supabase.from('expense_rules').delete().eq('id', id)
  if (error) throw new Error('No se pudo eliminar la regla.')
}

export async function setPayMode(schoolId: string, teacherId: string, mode: TeacherPayMode): Promise<void> {
  const { error } = await supabase.from('teacher_pay').upsert({ teacher_id: teacherId, school_id: schoolId, mode }, { onConflict: 'teacher_id' })
  if (error) throw new Error('No se pudo cambiar el modo de pago.')
}

// Labels and sums ------------------------------------------------------------------------------------------------
export const categoryLabel: Record<ExpenseCategory, string> = {
  comision_profesor: 'Comisión de profesor',
  sueldo: 'Sueldo',
  arriendo: 'Arriendo',
  servicios: 'Servicios básicos',
  insumos: 'Insumos y equipamiento',
  marketing: 'Marketing',
  impuestos: 'Impuestos',
  otro: 'Otro',
}
export const expenseStatusLabel: Record<ExpenseStatus, string> = { pendiente: 'Pendiente', pagado: 'Pagado', anulado: 'Anulado' }

/** The month as 'aaaa-mm' of an ISO date. */
const ym = (iso: string) => iso.slice(0, 7)

/** Paid this month (by payment date), and what is still pending. */
export function expenseStats(list: Pick<Expense, 'status' | 'amount' | 'date' | 'paid_at'>[], today = todayIso()) {
  let paid = 0, paidCount = 0, pending = 0, pendingCount = 0
  for (const e of list) {
    if (e.status === 'pagado' && ym(e.paid_at ? todayIso(new Date(e.paid_at)) : e.date) === ym(today)) { paid += e.amount; paidCount++ }
    if (e.status === 'pendiente') { pending += e.amount; pendingCount++ }
  }
  return { paid, paidCount, pending, pendingCount }
}

/** '$15.000 por clase · se paga el 5 del mes siguiente' / '$500.000 al mes · el día 5'. */
export function ruleSummary(r: Pick<ExpenseRule, 'kind' | 'amount' | 'day_of_month'>): string {
  return r.kind === 'por_clase'
    ? `${formatCLP(r.amount)} por clase · se paga el ${r.day_of_month} del mes siguiente`
    : `${formatCLP(r.amount)} al mes · el día ${r.day_of_month}`
}

/** What a generated expense came from: 'Octubre de 2026 · 12 clases'. */
export function periodLabel(e: Pick<Expense, 'period' | 'classes'>): string | null {
  if (!e.period) return null
  return [monthTitle(e.period), e.classes != null ? `${e.classes} ${e.classes === 1 ? 'clase' : 'clases'}` : null].filter(Boolean).join(' · ')
}

/** 'Vence el 5 dic' / 'Pagado el 3 nov' / 'Anulado'. */
export function whenLabel(e: Pick<Expense, 'status' | 'date' | 'paid_at'>, today = todayIso()): string {
  if (e.status === 'pagado') return `Pagado el ${dayMonth(e.paid_at ? todayIso(new Date(e.paid_at)) : e.date)}`
  if (e.status === 'anulado') return `Del ${dayMonth(e.date)}`
  return e.date < today ? `Venció el ${dayMonth(e.date)}` : e.date === today ? 'Vence hoy' : `Vence el ${dayMonth(e.date)}`
}
