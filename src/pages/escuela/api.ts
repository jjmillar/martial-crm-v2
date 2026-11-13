import type { CSSProperties } from 'react'
import { useQuery } from '@tanstack/react-query'
import { onColor, themeColors } from '../../lib/landingThemes'
import { supabase } from '../../lib/supabase'

export type Landing = {
  id: string; slug: string; name: string; logo_url: string | null; city: string | null; address: string | null
  phone: string | null; email: string | null; description: string | null
  theme: string; primary: string | null; accent: string | null; tagline: string | null; about: string | null
  instagram: string | null; whatsapp: string | null; enrollment_fee: number
  photos: { path: string; caption: string | null }[]
  schedule: { weekday: number; start: string; end: string; name: string; color: string; level: string; discipline: string | null }[] | null
  plans: { name: string; price: number; cycle: string; description: string | null; trial: boolean }[] | null
}

export function useLanding(slug: string | undefined) {
  return useQuery({
    queryKey: ['landing', slug],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('school_landing', { p_slug: slug! })
      if (error) throw error
      return (data as unknown as Landing | null) ?? null
    },
    enabled: Boolean(slug),
  })
}

export const photoUrl = (path: string) => supabase.storage.from('landing').getPublicUrl(path).data.publicUrl
export const waLink = (phone: string, text?: string) => `https://wa.me/${phone.replace(/\D/g, '')}${text ? `?text=${encodeURIComponent(text)}` : ''}`
export const igLink = (handle: string) => `https://instagram.com/${handle.replace(/^@/, '').replace(/^https?:\/\/(www\.)?instagram\.com\//, '')}`

// CSS variables for a school's brand colors (landing and its login/sign-up pages).
export function brandStyle(s: Pick<Landing, 'theme' | 'primary' | 'accent'>): CSSProperties {
  const c = themeColors(s.theme, s.primary, s.accent)
  return { ['--brand' as string]: c.primary, ['--brand-2' as string]: c.accent, ['--on-brand' as string]: onColor(c.primary) }
}
