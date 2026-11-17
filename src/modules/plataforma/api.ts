import { supabase } from '../../lib/supabase'
import { todayIso, addDays } from '../../lib/dates'

// Platform console ("el CRM del CRM"). Every call runs as the operator with a two-step-verified session; the
// database refuses anything else (is_platform_operator()).
export type SubStatus = 'prueba' | 'activa' | 'suspendida' | 'cancelada'
export type CustomerSchool = { id: string; name: string; slug: string; students: number }
export type Customer = {
  owner_id: string
  full_name: string | null
  email: string
  created_at: string
  last_sign_in_at: string | null
  schools: CustomerSchool[]
  students: number
  plan_id: string | null
  plan_name: string | null
  price_clp: number | null
  period: 'mensual' | 'anual' | null
  status: SubStatus | null
  trial_ends: string | null
  period_end: string | null
  notes: string | null
  updated_at: string | null
}
export type PlatformPlan = {
  id: string
  name: string
  price_clp: number
  period: 'mensual' | 'anual'
  max_schools: number | null
  max_students: number | null
  active: boolean
}
export type PlatformEvent = { id: number; at: string; owner_id: string; customer: string | null; details: Record<string, unknown> }

export const statusLabel: Record<SubStatus, string> = { prueba: 'En prueba', activa: 'Activa', suspendida: 'Suspendida', cancelada: 'Cancelada' }
export const STATUSES: SubStatus[] = ['prueba', 'activa', 'suspendida', 'cancelada']

export const customersKey = ['platform', 'customers'] as const
export const plansKey = ['platform', 'plans'] as const
export const eventsKey = ['platform', 'events'] as const

export async function fetchCustomers(): Promise<Customer[]> {
  const { data, error } = await supabase.rpc('platform_customers')
  if (error) throw error
  return (data ?? []) as unknown as Customer[]
}

export async function fetchPlans(): Promise<PlatformPlan[]> {
  const { data, error } = await supabase.from('platform_plans').select('id, name, price_clp, period, max_schools, max_students, active').order('price_clp')
  if (error) throw error
  return (data ?? []) as PlatformPlan[]
}

export async function fetchEvents(): Promise<PlatformEvent[]> {
  const { data, error } = await supabase.rpc('platform_events', { p_limit: 300 })
  if (error) throw error
  return (data ?? []) as unknown as PlatformEvent[]
}

export type SubscriptionInput = { plan_id: string | null; status: SubStatus; trial_ends: string | null; period_end: string | null; notes: string }
export async function updateSubscription(owner: string, v: SubscriptionInput) {
  const { error } = await supabase.rpc('platform_update_subscription', {
    p_owner: owner,
    p_plan: v.plan_id as string,
    p_status: v.status,
    p_trial_ends: v.trial_ends as string,
    p_period_end: v.period_end as string,
    p_notes: v.notes,
  })
  if (error) throw new Error('No se pudo guardar la suscripción. Revisa los datos e intenta de nuevo.')
}

export type PlanInput = Omit<PlatformPlan, 'id'>
export async function savePlan(id: string | null, v: PlanInput) {
  const { error } = id
    ? await supabase.from('platform_plans').update(v).eq('id', id)
    : await supabase.from('platform_plans').insert(v)
  if (error) throw new Error('No se pudo guardar el plan.')
}

/** Monthly revenue a customer represents (annual plans count as 1/12). Only active subscriptions bring money. */
export function monthly(c: Pick<Customer, 'status' | 'price_clp' | 'period'>): number {
  if (c.status !== 'activa' || !c.price_clp) return 0
  return c.period === 'anual' ? Math.round(c.price_clp / 12) : c.price_clp
}

/** What needs attention: a trial ending within 7 days or a period already over. */
export function dueInfo(c: Customer, today = todayIso()): { text: string; late: boolean } | null {
  if (c.status === 'prueba' && c.trial_ends) {
    const late = c.trial_ends < today
    return { text: late ? `Prueba vencida el ${fmt(c.trial_ends)}` : `Prueba hasta el ${fmt(c.trial_ends)}`, late: late || c.trial_ends <= addDays(today, 7) }
  }
  if (c.status === 'activa' && c.period_end) {
    const late = c.period_end < today
    return { text: late ? `Venció el ${fmt(c.period_end)}` : `Vence el ${fmt(c.period_end)}`, late }
  }
  return null
}
const fmt = (iso: string) => `${iso.slice(8, 10)}-${iso.slice(5, 7)}-${iso.slice(0, 4)}`
