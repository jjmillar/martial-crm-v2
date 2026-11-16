import type { Metadata } from 'next'
import { fetchStudentProfile } from '@/lib/landing-server'
import { StudentProfilePage } from '@/screens/perfil/StudentProfilePage'

type Params = { params: Promise<{ slug: string; handle: string }> }

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug, handle } = await params
  const p = await fetchStudentProfile(slug, handle)
  if (!p) return { title: 'Perfil no disponible · Martial CRM', robots: { index: false } }
  const title = `${p.name} · ${p.school.name}`
  const description = p.headline || p.bio || `${p.name}, alumno de ${p.school.name}.`
  return {
    title,
    description,
    robots: { index: true },
    icons: p.school.logo_url ? { icon: p.school.logo_url, apple: p.school.logo_url } : undefined,
    openGraph: { title, description, type: 'profile', locale: 'es_CL', images: p.school.logo_url ? [p.school.logo_url] : undefined },
    twitter: { card: 'summary', title, description },
  }
}

export default async function Page({ params }: Params) {
  const { slug, handle } = await params
  return <StudentProfilePage p={await fetchStudentProfile(slug, handle)} />
}
