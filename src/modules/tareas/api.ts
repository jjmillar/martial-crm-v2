import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { useSchool } from '../../lib/school'

// Account requests from the open sign-up (/registro). Only the CEO sees and decides them.
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

// Task board (fixed columns). Automatic tasks (trial bookings) arrive in "Por hacer".
export type TaskStatus = 'por_hacer' | 'en_curso' | 'hecho'
export type Task = {
  id: string; school_id: string; title: string; notes: string | null; status: TaskStatus
  kind: 'manual' | 'clase_prueba'; position: number; created_at: string
}

export const columns: { id: TaskStatus; label: string }[] = [
  { id: 'por_hacer', label: 'Por hacer' },
  { id: 'en_curso', label: 'En curso' },
  { id: 'hecho', label: 'Hecho' },
]

export const tasksKey = (schoolId: string | undefined) => ['tasks', schoolId] as const

export async function listTasks(schoolId: string): Promise<Task[]> {
  const { data, error } = await supabase.from('tasks')
    .select('id, school_id, title, notes, status, kind, position, created_at')
    .eq('school_id', schoolId).order('position', { ascending: false }).limit(300)
  if (error) throw error
  return data as Task[]
}

/** Badge for Tareas: accounts to approve (CEO) + automatic tasks still in "Por hacer". */
export function usePendingCount() {
  const { role, activeSchool } = useSchool()
  const staff = role === 'ceo' || role === 'admin' || role === 'user'
  const reqs = useQuery({ queryKey: pendingKey, queryFn: listPending, enabled: role === 'ceo', refetchInterval: 60_000 })
  const tasks = useQuery({ queryKey: tasksKey(activeSchool?.id), queryFn: () => listTasks(activeSchool!.id), enabled: staff && Boolean(activeSchool), refetchInterval: 60_000 })
  const approvals = role === 'ceo' ? reqs.data?.length ?? 0 : 0
  const fresh = staff ? (tasks.data ?? []).filter((t) => t.status === 'por_hacer' && t.kind !== 'manual').length : 0
  return approvals + fresh
}

/** Only the account requests (for the dashboard tile). */
export function useApprovalsCount() {
  const { role } = useSchool()
  const q = useQuery({ queryKey: pendingKey, queryFn: listPending, enabled: role === 'ceo', refetchInterval: 60_000 })
  return role === 'ceo' ? q.data?.length ?? 0 : 0
}
