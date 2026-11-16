import { describe, expect, it } from 'vitest'
import { emptyForm, parseStudent } from './schema'

const base = {
  ...emptyForm('2026-11-11'), first_name: ' Juan ', first_last_name: 'Pérez', second_last_name: 'Soto', rut: '12.345.678-5',
  email: 'jp@mail.cl', birth_date: '2000-05-01', address: 'Av. Siempre Viva 123',
}

describe('student schema', () => {
  it('trims, nulls empty optionals and normalizes RUT', () => {
    const r = parseStudent({ ...base, rut: '12.345.678-5', belt_degree: '2', weight_kg: '72,5', email: 'JP@Mail.cl' })
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.data.first_name).toBe('Juan')
      expect(r.data.middle_name).toBeNull()
      expect(r.data.rut).toBe('12345678-5')
      expect(r.data.belt_degree).toBe(2)
      expect(r.data.weight_kg).toBe(72.5)
      expect(r.data.email).toBe('jp@mail.cl')
      expect(r.data.gender).toBeNull()
    }
  })
  it('reports Spanish errors per field', () => {
    const r = parseStudent({ ...base, first_name: '', rut: '12.345.678-9', belt_degree: '20', email: 'x' })
    expect(r.ok).toBe(false)
    if (!r.ok) {
      expect(r.errors.first_name).toMatch(/primer nombre/)
      expect(r.errors.rut).toMatch(/RUT inválido/)
      expect(r.errors.belt_degree).toMatch(/0 a 12/)
      expect(r.errors.email).toMatch(/Correo/)
    }
  })
  it('requires names, RUT, email, birth date and address', () => {
    const r = parseStudent({ ...emptyForm('2026-11-11'), first_name: 'Ana', first_last_name: 'Rojas' })
    expect(r.ok).toBe(false)
    if (!r.ok) {
      expect(r.errors.second_last_name).toMatch(/segundo apellido/)
      expect(r.errors.rut).toMatch(/Escribe el RUT/)
      expect(r.errors.email).toMatch(/Escribe el correo/)
      expect(r.errors.birth_date).toMatch(/nacimiento/)
      expect(r.errors.address).toMatch(/dirección/)
      expect(r.errors.middle_name).toBeUndefined()
    }
  })
  it('rejects a birth date after enrollment', () => {
    const r = parseStudent({ ...base, birth_date: '2027-01-01' })
    expect(r.ok).toBe(false)
  })
})
