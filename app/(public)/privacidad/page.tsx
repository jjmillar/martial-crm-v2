import type { Metadata } from 'next'
import { LegalPageClient } from './client'

export const metadata: Metadata = { title: 'Política de privacidad · Martial CRM' }

export default function Page() {
  return <LegalPageClient />
}
