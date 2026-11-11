import { z } from 'zod'
import { formatCLP, parseCLP } from '../../lib/money'
import type { BillingCycle, Plan } from '../../lib/database.types'
import type { PlanPayload } from './api'

export type PlanForm = {
  name: string
  specialty_id: string
  price: string
  enrollment_fee: string
  billing_cycle: BillingCycle
  duration_days: string
  sessions_per_week: string
  class_count: string
  description: string
  is_trial: boolean
  is_default: boolean
  active: boolean
}

export const emptyPlan: PlanForm = {
  name: '', specialty_id: '', price: '', enrollment_fee: '', billing_cycle: 'mensual', duration_days: '30',
  sessions_per_week: '', class_count: '', description: '', is_trial: false, is_default: false, active: true,
}

export const formFromPlan = (p: Plan): PlanForm => ({
  name: p.name, specialty_id: p.specialty_id ?? '', price: formatCLP(p.price),
  enrollment_fee: p.enrollment_fee ? formatCLP(p.enrollment_fee) : '', billing_cycle: p.billing_cycle,
  duration_days: p.duration_days?.toString() ?? '', sessions_per_week: p.sessions_per_week?.toString() ?? '',
  class_count: p.class_count?.toString() ?? '', description: p.description ?? '',
  is_trial: p.is_trial, is_default: p.is_default, active: p.active,
})

const text = z.string().trim()
const money = (required: boolean) =>
  text.transform((v, ctx) => {
    const n = parseCLP(v)
    if (n === null) {
      if (required) ctx.addIssue({ code: 'custom', message: 'Indica el precio (puede ser $0).' })
      return required ? z.NEVER : 0
    }
    if (Number.isNaN(n) || n > 100_000_000) {
      ctx.addIssue({ code: 'custom', message: 'Monto inválido: usa solo pesos enteros, ej: 35.000.' })
      return z.NEVER
    }
    return n
  })
const optionalInt = (min: number, max: number, msg: string) =>
  text.transform((v, ctx) => {
    if (v === '') return null
    const n = Number(v)
    if (!Number.isInteger(n) || n < min || n > max) {
      ctx.addIssue({ code: 'custom', message: msg })
      return z.NEVER
    }
    return n
  })

const schema = z
  .object({
    name: text.min(1, 'Escribe el nombre del plan.').max(80, 'Máximo 80 caracteres.'),
    specialty_id: text.transform((v) => (v === '' ? null : v)),
    price: money(true),
    enrollment_fee: money(false),
    billing_cycle: z.enum(['mensual', 'trimestral', 'semestral', 'anual', 'unico']),
    duration_days: optionalInt(1, 730, 'Entre 1 y 730 días.'),
    sessions_per_week: optionalInt(1, 14, 'Entre 1 y 14 clases por semana.'),
    class_count: optionalInt(1, 500, 'Entre 1 y 500 clases.'),
    description: text.max(400, 'Máximo 400 caracteres.').transform((v) => (v === '' ? null : v)),
    is_trial: z.boolean(),
    is_default: z.boolean(),
    active: z.boolean(),
  })
  .refine((v) => !(v.is_default && !v.active), { message: 'El plan predeterminado debe estar activo.', path: ['active'] })

export function parsePlan(form: PlanForm): { ok: true; data: PlanPayload } | { ok: false; errors: Partial<Record<keyof PlanForm, string>> } {
  const r = schema.safeParse(form)
  if (r.success) return { ok: true, data: r.data }
  const errors: Partial<Record<keyof PlanForm, string>> = {}
  for (const issue of r.error.issues) errors[issue.path[0] as keyof PlanForm] ??= issue.message
  return { ok: false, errors }
}
