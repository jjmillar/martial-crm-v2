import { supabase } from './supabase'
import type { School } from './database.types'

// The school's coordinates come from its own address (OpenStreetMap's geocoder, no key): used by the QR check-in
// to see whether the student is at the school. Only the school's address is sent, never anything about people.

const query = (s: Pick<School, 'address' | 'city'>) => [s.address?.trim(), s.city?.trim(), 'Chile'].filter(Boolean).join(', ')

/** The address text the coordinates belong to; null when the school has no street address. */
export const geoKey = (s: Pick<School, 'address' | 'city'>) => (s.address?.trim() ? query(s) : null)

export async function geocode(q: string): Promise<{ lat: number; lng: number } | null> {
  const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&accept-language=es&q=${encodeURIComponent(q)}`
  const r = await fetch(url, { headers: { Accept: 'application/json' } })
  if (!r.ok) throw new Error('geocoder unavailable')
  const [hit] = (await r.json()) as { lat: string; lon: string }[]
  return hit ? { lat: Number(hit.lat), lng: Number(hit.lon) } : null
}

/**
 * Makes sure the school's stored coordinates match its current address (admins only: RLS). Returns 'ok',
 * 'no_address' or 'not_found'. Skips the lookup when they already match.
 */
export async function ensureSchoolGeo(s: School): Promise<'ok' | 'no_address' | 'not_found'> {
  const key = geoKey(s)
  if (!key) return 'no_address'
  if (s.geo_address === key && s.geo_lat != null) return 'ok'
  const hit = await geocode(key)
  if (!hit) return 'not_found'
  const { data, error } = await supabase.from('schools').update({ geo_lat: hit.lat, geo_lng: hit.lng, geo_address: key }).eq('id', s.id).select('id')
  if (error || !data?.length) throw error ?? new Error('not allowed')
  return 'ok'
}
