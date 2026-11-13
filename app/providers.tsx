'use client'
import { Suspense, useEffect, useState, type ReactNode } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AuthProvider } from '@/lib/auth'
import { SchoolProvider } from '@/lib/school'
import { installMotion } from '@/ui/motion'

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(() => new QueryClient({ defaultOptions: { queries: { staleTime: 30_000, retry: 1 } } }))
  useEffect(() => installMotion(), [])
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <SchoolProvider>
          <Suspense fallback={<p className="center-screen">Cargando…</p>}>{children}</Suspense>
        </SchoolProvider>
      </AuthProvider>
    </QueryClientProvider>
  )
}
