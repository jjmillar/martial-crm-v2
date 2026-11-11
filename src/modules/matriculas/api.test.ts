import { describe, expect, it } from 'vitest'
import { phaseOf } from './api'

describe('phaseOf', () => {
  const today = '2026-11-11'
  it('derives por vencer / vencida from ends_at for active enrollments', () => {
    expect(phaseOf({ status: 'activa', ends_at: '2026-12-31' }, today)).toBe('activa')
    expect(phaseOf({ status: 'activa', ends_at: '2026-11-18' }, today)).toBe('por_vencer')
    expect(phaseOf({ status: 'activa', ends_at: '2026-11-11' }, today)).toBe('por_vencer')
    expect(phaseOf({ status: 'activa', ends_at: '2026-11-10' }, today)).toBe('vencida')
    expect(phaseOf({ status: 'activa', ends_at: null }, today)).toBe('activa')
  })
  it('keeps paused/cancelled as stored', () => {
    expect(phaseOf({ status: 'pausada', ends_at: '2020-01-01' }, today)).toBe('pausada')
    expect(phaseOf({ status: 'cancelada', ends_at: null }, today)).toBe('cancelada')
  })
})
