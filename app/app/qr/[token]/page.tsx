'use client'
import { use } from 'react'
import { QrCheckInPage } from '@/modules/asistencia/QrCheckInPage'

// The printed QR in the room points here. The /app layout signs the visitor in first (and comes back).
export default function Page({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params)
  return <QrCheckInPage token={token} />
}
