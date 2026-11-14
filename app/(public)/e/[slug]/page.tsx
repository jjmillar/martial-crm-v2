import { SchoolLanding } from '@/screens/escuela/SchoolLanding'
import { fetchLanding } from '@/lib/landing-server'

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  return <SchoolLanding initial={await fetchLanding(slug)} />
}
