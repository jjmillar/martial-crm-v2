import type { BillingCycle, Plan } from '../../lib/database.types'

export const cycles: { value: BillingCycle; label: string; per: string; days: number | null }[] = [
  { value: 'mensual', label: 'Mensual', per: '/ mes', days: 30 },
  { value: 'trimestral', label: 'Trimestral', per: '/ trimestre', days: 90 },
  { value: 'semestral', label: 'Semestral', per: '/ semestre', days: 180 },
  { value: 'anual', label: 'Anual', per: '/ año', days: 365 },
  { value: 'unico', label: 'Pago único', per: 'pago único', days: null },
]

export const cycleInfo = (c: BillingCycle) => cycles.find((x) => x.value === c)!

/** Short human lines describing what a plan includes. */
export function planFeatures(p: Pick<Plan, 'sessions_per_week' | 'class_count' | 'duration_days' | 'billing_cycle'>): string[] {
  const out: string[] = []
  if (p.class_count) out.push(`Pack de ${p.class_count} ${p.class_count === 1 ? 'clase' : 'clases'}`)
  if (p.sessions_per_week) out.push(`${p.sessions_per_week} ${p.sessions_per_week === 1 ? 'clase' : 'clases'} por semana`)
  else if (!p.class_count) out.push('Clases ilimitadas')
  // Only mention the duration when it differs from what the cycle implies (one-time plans imply none).
  if (p.duration_days && p.duration_days !== cycleInfo(p.billing_cycle).days) out.push(`Vigencia de ${p.duration_days} días`)
  return out
}
