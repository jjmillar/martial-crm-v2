'use client'
import type { ReactNode } from 'react'
import { AppLayout } from '@/shell/AppLayout'
import { ClientOnly } from '@/shell/ClientOnly'
import { RequireAuth } from '@/shell/RequireAuth'
import { MfaGate } from '@/shell/MfaGate'
import { PlatformShell } from '@/modules/plataforma/PlatformShell'
import { useAuth } from '@/lib/auth'

// The signed-in app renders in the browser only (it is private: nothing to index), exactly as before.
export default function AppShell({ children }: { children: ReactNode }) {
  return (
    <ClientOnly>
      <RequireAuth>
        <MfaGate>
          <Shell>{children}</Shell>
        </MfaGate>
      </RequireAuth>
    </ClientOnly>
  )
}

// The platform operator ("el CRM del CRM") gets its own console, never the school app.
function Shell({ children }: { children: ReactNode }) {
  const { platform } = useAuth()
  return platform ? <PlatformShell /> : <AppLayout>{children}</AppLayout>
}
