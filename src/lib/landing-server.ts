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

export type StudentProfile = {
  handle: string; name: string; initials: string; headline: string | null; bio: string | null; since: string
  belt: string | null; belt_degree: number | null
  stats: { xp: number; level: number; level_xp: number; next_level_xp?: number; attended: number } | null
  skills: { label: string; icon: string | null; xp: number }[] | null
  /** Belt per art (when show_belt). Absent in profiles cached before 2026-11-24. */
  arts?: { art: string; belt: string | null; color: string | null; stripe: string | null; bar?: string | null; pattern?: string | null; degree: number; degree_text: string | null; rank: string | null; track: string | null }[] | null
  /** Approved achievements and computed milestones (when show_achievements). */
  achievements?: { kind: 'graduacion' | 'torneo' | 'escuela'; title: string; detail: string | null; date: string; medal: string | null; category: string | null; art: string | null; color: string | null; stripe: string | null; bar?: string | null; pattern?: string | null; icon: string | null }[] | null
  milestones?: { key: string; kind: string; title: string; icon: string; date: string }[] | null
  school: { slug: string; name: string; logo_url: string | null; city: string | null; theme: string; primary: string | null; accent: string | null; landing: boolean }
}

// Server-side read of a student's public profile (only what the student chose to publish).
export async function fetchStudentProfile(slug: string, handle: string): Promise<StudentProfile | null> {
  if (!url || !key) return null
  try {
    const r = await fetch(`${url}/rest/v1/rpc/student_public_profile`, {
      method: 'POST',
      headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ p_slug: slug, p_handle: handle }),
      cache: 'no-store', // the student's changes show at once
    })
    if (!r.ok) return null
    return ((await r.json()) as StudentProfile | null) ?? null
  } catch {
    return null
  }
}
