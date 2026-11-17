'use client'
import type { ReactNode } from 'react'
import { AppLayout } from '@/shell/AppLayout'
import { ClientOnly } from '@/shell/ClientOnly'
import { RequireAuth } from '@/shell/RequireAuth'
import { MfaGate } from '@/shell/MfaGate'

// The signed-in app renders in the browser only (it is private: nothing to index), exactly as before.
export default function AppShell({ children }: { children: ReactNode }) {
  return (
    <ClientOnly>
      <RequireAuth>
        <MfaGate>
          <AppLayout>{children}</AppLayout>
        </MfaGate>
      </RequireAuth>
    </ClientOnly>
  )
}
