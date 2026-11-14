import type { Landing } from '../screens/escuela/api'

// Server-side read of a school's public page (same RPC the browser uses, anon key, public fields only).
const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

export async function fetchLanding(slug: string): Promise<Landing | null> {
  if (!url || !key) return null
  try {
    const r = await fetch(`${url}/rest/v1/rpc/school_landing`, {
      method: 'POST',
      headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ p_slug: slug }),
      next: { revalidate: 60 },
    })
    if (!r.ok) return null
    return ((await r.json()) as Landing | null) ?? null
  } catch {
    return null
  }
}

export const landingPhotoUrl = (path: string) => `${url}/storage/v1/object/public/landing/${path}`
