'use client'
import type { ReactNode } from 'react'
import { PageMotion } from '@/ui/PageMotion'

// Public pages share the standard page transition (the app shell has its own).
export default function PublicLayout({ children }: { children: ReactNode }) {
  return <PageMotion>{children}</PageMotion>
}
