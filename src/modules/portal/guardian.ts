import { supabase } from '../../lib/supabase'

// Apoderados: a student account asks for its children (the school approves them), sees and acts for them, and
// later hands each one their own account with a one-time code.
export type ChildRequest = {
  id: string
  school_id: string
  first_name: string
  middle_name: string | null
  first_last_name: string
  second_last_name: string
  rut: string
  email: string
  birth_date: string
  address: string
  status: 'pendiente' | 'aprobada' | 'rechazada'
  reject_reason: string | null
  student_id: string | null
  created_at: string
  decided_at: string | null
}
export type Ward = { id: string; full_name: string | null; first_name: string; rut: string | null; email: string | null; birth_date: string | null; address: string | null; phone: string | null; belt: string | null }

export const childRequestsKey = (schoolId: string | undefined) => ['child-requests', schoolId] as const
export const wardsKey = (schoolId: string | undefined) => ['wards', schoolId] as const

export async function myChildRequests(schoolId: string): Promise<ChildRequest[]> {
  const { data: u } = await supabase.auth.getUser()
  const { data, error } = await supabase.from('child_requests').select('*').eq('school_id', schoolId).eq('guardian_id', u.user?.id ?? '').order('created_at', { ascending: false }).limit(20)
  if (error) throw error
  return data as ChildRequest[]
}

export async function myWards(ids: string[]): Promise<Ward[]> {
  if (!ids.length) return []
  const { data, error } = await supabase.from('students').select('id, full_name, first_name, rut, email, birth_date, address, phone, belt').in('id', ids).order('first_name')
  if (error) throw error
  return data as Ward[]
}

export type ChildInput = { first_name: string; middle_name: string; first_last_name: string; second_last_name: string; rut: string; email: string; birth_date: string; address: string }
export async function requestChild(schoolId: string, v: ChildInput) {
  const { error } = await supabase.rpc('request_child', {
    p_school_id: schoolId, p_first_name: v.first_name, p_middle_name: v.middle_name, p_first_last_name: v.first_last_name,
    p_second_last_name: v.second_last_name, p_rut: v.rut, p_email: v.email, p_birth_date: v.birth_date, p_address: v.address,
  })
  if (error) {
    if (error.message.includes('already a student')) throw new Error('Ya hay un alumno con ese RUT en la escuela. Si es tu hijo, pide a la escuela que lo vincule contigo.')
    if (error.message.includes('already requested')) throw new Error('Ya hay una solicitud pendiente con ese RUT.')
    if (error.message.includes('too many')) throw new Error('Tienes 5 solicitudes esperando aprobación. Espera a que la escuela las revise.')
    if (error.message.includes('rut_valid')) throw new Error('RUT inválido. Ej: 12.345.678-5')
    throw new Error('No se pudo enviar la solicitud. Revisa los datos e intenta de nuevo.')
  }
}

export async function cancelChildRequest(id: string) {
  const { error } = await supabase.rpc('cancel_child_request', { p_id: id })
  if (error) throw new Error('No se pudo cancelar.')
}

export type Claim = { code: string; expires_at: string; slug: string }
export async function createClaim(studentId: string): Promise<Claim> {
  const { data, error } = await supabase.rpc('create_student_claim', { p_student_id: studentId })
  if (error) throw new Error(error.message.includes('already has') ? 'Esta ficha ya tiene su propia cuenta.' : 'No se pudo generar el código.')
  return data as unknown as Claim
}

/** Someone who already has a login enters the code from their guardian. */
export async function claimStudent(code: string) {
  const { error } = await supabase.rpc('claim_student', { p_code: code })
  if (error) throw new Error(error.message.includes('already a student') ? 'Tu cuenta ya es alumno de esta escuela.' : 'El código no es válido o ya venció. Pide uno nuevo a tu apoderado.')
}

// Staff side: children waiting for approval (the school's CEO and administrators).
export type PendingChild = ChildRequest & { guardian_name: string | null }
export const pendingChildrenKey = ['child-requests', 'pending'] as const
export async function pendingChildren(): Promise<PendingChild[]> {
  const { data, error } = await supabase.from('child_requests').select('*').eq('status', 'pendiente').order('created_at')
  if (error) throw error
  const rows = data as (ChildRequest & { guardian_id: string })[]
  if (!rows.length) return []
  const { data: g } = await supabase.from('students').select('user_id, school_id, full_name').in('user_id', [...new Set(rows.map((r) => r.guardian_id))])
  const name = new Map((g ?? []).map((x) => [`${x.user_id}|${x.school_id}`, x.full_name]))
  return rows.map((r) => ({ ...r, guardian_name: name.get(`${r.guardian_id}|${r.school_id}`) ?? null }))
}

export async function decideChild(id: string, approve: boolean, reason?: string) {
  const { error } = await supabase.rpc('decide_child_request', { p_id: id, p_approve: approve, p_reason: reason ?? undefined })
  if (error) {
    if (error.message.includes('students_school_rut_key')) throw new Error('Ya existe un alumno con ese RUT en la escuela.')
    throw new Error('No se pudo guardar la decisión.')
  }
}
