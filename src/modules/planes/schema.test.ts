import { describe, expect, it } from 'vitest'
import { emptyPlan, parsePlan } from './schema'
import { planFeatures } from './cycles'

describe('plan schema', () => {
  it('parses CLP and nulls optionals', () => {
    const r = parsePlan({ ...emptyPlan, name: ' Mensual BJJ ', price: '$35.000', sessions_per_week: '3' })
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.data.name).toBe('Mensual BJJ')
      expect(r.data.price).toBe(35000)
      expect(r.data.enrollment_fee).toBe(0)
      expect(r.data.sessions_per_week).toBe(3)
      expect(r.data.class_count).toBeNull()
      expect(r.data.specialty_id).toBeNull()
    }
  })
  it('accepts a free plan but requires a price', () => {
    expect(parsePlan({ ...emptyPlan, name: 'Prueba', price: '0' }).ok).toBe(true)
    const r = parsePlan({ ...emptyPlan, name: 'X', price: '' })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.errors.price).toMatch(/precio/)
  })
  it('rejects decimals, bad ranges and an inactive default', () => {
    const r = parsePlan({ ...emptyPlan, name: 'X', price: '35,5', sessions_per_week: '20', is_default: true, active: false })
    expect(r.ok).toBe(false)
    if (!r.ok) {
      expect(r.errors.price).toMatch(/pesos enteros/)
      expect(r.errors.sessions_per_week).toMatch(/1 y 14/)
      expect(r.errors.active).toMatch(/predeterminado/)
    }
  })
})

describe('planFeatures', () => {
  it('describes sessions, packs and custom duration', () => {
    expect(planFeatures({ sessions_per_week: null, class_count: null, duration_days: 30, billing_cycle: 'mensual' })).toEqual(['Clases ilimitadas'])
    expect(planFeatures({ sessions_per_week: 2, class_count: null, duration_days: 45, billing_cycle: 'mensual' })).toEqual(['2 clases por semana', 'Vigencia de 45 días'])
    expect(planFeatures({ sessions_per_week: null, class_count: 10, duration_days: 60, billing_cycle: 'unico' })).toEqual(['Pack de 10 clases', 'Vigencia de 60 días'])
  })
})
