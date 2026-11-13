import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import { fetchLanding, landingPhotoUrl } from '@/lib/landing-server'

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const s = await fetchLanding(slug)
  if (!s) return { title: 'Página no disponible · Martial CRM', robots: { index: false } }
  const title = `${s.name} · Martial CRM`
  const description = s.tagline || s.about || s.description || [s.name, s.city].filter(Boolean).join(', ')
  const image = s.photos[0] ? landingPhotoUrl(s.photos[0].path) : s.logo_url || undefined
  return {
    title,
    description,
    openGraph: { title: s.name, description, type: 'website', locale: 'es_CL', images: image ? [image] : undefined },
    twitter: { card: image ? 'summary_large_image' : 'summary', title: s.name, description, images: image ? [image] : undefined },
  }
}

export default function SchoolLayout({ children }: { children: ReactNode }) {
  return children
}
