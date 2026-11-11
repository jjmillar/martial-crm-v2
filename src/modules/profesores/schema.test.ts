import { describe, expect, it } from 'vitest'
import { emptyTeacher, parseTeacher } from './schema'

describe('teacher schema', () => {
  it('normalizes and nulls optionals', () => {
    const r = parseTeacher({ ...emptyTeacher, first_name: ' Rorion ', first_last_name: 'Gracie', rut: '7.654.321-6', belt_degree: '6', user_id: '' })
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.data.first_name).toBe('Rorion')
      expect(r.data.rut).toBe('7654321-6')
      expect(r.data.belt_degree).toBe(6)
      expect(r.data.user_id).toBeNull()
      expect(r.data.bio).toBeNull()
    }
  })
  it('reports Spanish errors', () => {
    const r = parseTeacher({ ...emptyTeacher, rut: '1-1', belt_degree: '2.5', bio: 'x'.repeat(601) })
    expect(r.ok).toBe(false)
    if (!r.ok) {
      expect(r.errors.first_name).toMatch(/nombre/)
      expect(r.errors.rut).toMatch(/RUT/)
      expect(r.errors.belt_degree).toMatch(/0 a 12/)
      expect(r.errors.bio).toMatch(/600/)
    }
  })
})
