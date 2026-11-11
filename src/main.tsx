import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider } from 'react-router-dom'
import { AuthProvider } from './lib/auth'
import { SchoolProvider } from './lib/school'
import { router } from './app/router'
import './index.css'

const queryClient = new QueryClient({ defaultOptions: { queries: { staleTime: 30_000, retry: 1 } } })

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <SchoolProvider>
          <RouterProvider router={router} />
        </SchoolProvider>
      </AuthProvider>
    </QueryClientProvider>
  </StrictMode>,
)
