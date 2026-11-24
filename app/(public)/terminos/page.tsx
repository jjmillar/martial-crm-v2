import type { Metadata } from 'next'
import { LegalPageClient } from './client'

export const metadata: Metadata = { title: 'Términos y condiciones · Martial CRM' }

export default function Page() {
  return <LegalPageClient />
}
