import { describe, expect, it } from 'vitest'
import { expenseStats, periodLabel, ruleSummary, whenLabel } from './api'

describe('egresos', () => {
  const today = '2026-11-27'
  it('sums what was paid this month and what is pending', () => {
    const s = expenseStats([
      { status: 'pagado', amount: 1000, date: '2026-10-30', paid_at: '2026-11-02T15:00:00Z' },
      { status: 'pagado', amount: 500, date: '2026-11-01', paid_at: '2026-10-31T15:00:00Z' },
      { status: 'pendiente', amount: 300, date: '2026-12-05', paid_at: null },
      { status: 'pendiente', amount: 200, date: '2026-11-05', paid_at: null },
      { status: 'anulado', amount: 9999, date: '2026-11-05', paid_at: null },
    ], today)
    expect(s).toEqual({ paid: 1000, paidCount: 1, pending: 500, pendingCount: 2 })
  })
  it('describes rules', () => {
    expect(ruleSummary({ kind: 'por_clase', amount: 15000, day_of_month: 5 })).toBe('$15.000 por clase · se paga el 5 del mes siguiente')
    expect(ruleSummary({ kind: 'fijo', amount: 500000, day_of_month: 1 })).toBe('$500.000 al mes · el día 1')
  })
  it('labels when and where from', () => {
    expect(whenLabel({ status: 'pendiente', date: '2026-11-20', paid_at: null }, today)).toBe('Venció el 20 nov')
    expect(whenLabel({ status: 'pendiente', date: today, paid_at: null }, today)).toBe('Vence hoy')
    expect(whenLabel({ status: 'pendiente', date: '2026-12-05', paid_at: null }, today)).toBe('Vence el 5 dic')
    expect(whenLabel({ status: 'pagado', date: '2026-11-05', paid_at: '2026-11-03T15:00:00Z' }, today)).toBe('Pagado el 3 nov')
    expect(periodLabel({ period: '2026-10-01', classes: 12 })).toBe('Octubre de 2026 · 12 clases')
    expect(periodLabel({ period: '2026-10-01', classes: null })).toBe('Octubre de 2026')
    expect(periodLabel({ period: null, classes: null })).toBeNull()
  })
})
