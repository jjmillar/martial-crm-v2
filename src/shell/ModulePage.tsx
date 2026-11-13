'use client'
import type { ReactNode } from 'react'
import { modules } from '../modules/registry'
import { RequireRole } from './RequireRole'

/** A section of the app: only the roles its manifest allows can open it. */
export function ModulePage({ id, children }: { id: string; children: ReactNode }) {
  const m = modules.find((x) => x.id === id)
  if (!m) throw new Error(`Unknown module ${id}`)
  return <RequireRole roles={m.roles}>{children}</RequireRole>
}
