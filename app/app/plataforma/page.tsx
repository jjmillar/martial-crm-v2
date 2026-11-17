'use client'
import { Navigate } from '@/lib/nav'

// The console itself is rendered by the operator's shell (app/app/layout.tsx). A school account landing here
// goes back to its own home.
export default function Page() {
  return <Navigate to="/app/inicio" replace />
}
