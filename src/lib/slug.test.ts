import { describe, expect, it } from 'vitest'
import { isValidSlug, slugify } from './slug'

describe('slugify', () => {
  it('normalises accents, spaces and symbols', () => {
    expect(slugify('Academia Muramasa – Los Ángeles!')).toBe('academia-muramasa-los-angeles')
  })
  it('produces slugs the DB check accepts', () => {
    expect(isValidSlug(slugify('Dojo Ñuñoa'))).toBe(true)
    expect(slugify('x'.repeat(80)).length).toBeLessThanOrEqual(48)
  })
  it('rejects invalid slugs', () => {
    expect(isValidSlug('ab')).toBe(false)
    expect(isValidSlug('Con Mayus')).toBe(false)
  })
})
