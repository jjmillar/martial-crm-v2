import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { useSchool } from '../../lib/school'

// Account requests from the open sign-up (/registro). The CEO sees every school; admins see theirs.
export type Req = {
  id: string; school_id: string; kind: 'alumno' | 'miembro'; first_name: string; first_last_name: string
  rut: string | null; email: string; phone: string | null; created_at: string
}

export const pendingKey = ['account-requests', 'pendiente'] as const

export async function listPending(): Promise<Req[]> {
  const { data, error } = await supabase.from('account_requests')
    .select('id, school_id, kind, first_name, first_last_name, rut, email, phone, created_at')
    .eq('status', 'pendiente').order('created_at')
  if (error) throw error
  return data as Req[]
}

/** Number of pending requests the signed-in staff can decide (for nav badges and the dashboard). */
export function usePendingCount() {
  const { role } = useSchool()
  const can = role === 'ceo' || role === 'admin'
  const q = useQuery({ queryKey: pendingKey, queryFn: listPending, enabled: can, refetchInterval: 60_000 })
  return can ? q.data?.length ?? 0 : 0
}

