import { supabase } from '../../lib/supabase'

// Check-in by QR. The school's code (only CEO/admin can read it) goes into a link printed as a QR in the room;
// a signed-in student opening /app/qr/<code> gets today's class confirmed (1 h before the start until the end).

export const qrCodeKey = (schoolId: string | undefined) => ['check-in-code', schoolId] as const

export async function getCheckInCode(schoolId: string): Promise<{ token: string; created_at: string } | null> {
  const { data, error } = await supabase.from('school_check_in_codes').select('token, created_at').eq('school_id', schoolId).maybeSingle()
  if (error) throw error
  return data
}

export async function rotateCheckInCode(schoolId: string): Promise<string> {
  const { data, error } = await supabase.rpc('rotate_check_in_code', { p_school_id: schoolId })
  if (error) throw new Error('No se pudo generar el código. Solo el CEO o un administrador pueden hacerlo.')
  return data
}

export const checkInUrl = (token: string) => `${window.location.origin}/app/qr/${token}`

export type QrResult =
  | { ok: true; already: boolean; student: string; class: string; start: string; end: string; date: string }
  | { choose: { id: string; name: string }[] }
  | { error: 'not_signed_in' | 'too_many' | 'invalid_code' | 'not_student'; student?: string }
  | { error: 'no_class'; student?: string; next: { name: string; start: string } | null }

export async function qrCheckIn(token: string, studentId?: string): Promise<QrResult> {
  const { data, error } = await supabase.rpc('qr_check_in', { p_token: token, p_student_id: studentId })
  if (error) throw new Error('No pudimos marcar la asistencia. Revisa tu conexión e intenta de nuevo.')
  return data as unknown as QrResult
}

export const qrErrorText: Record<string, string> = {
  not_signed_in: 'Inicia sesión para marcar tu asistencia.',
  too_many: 'Demasiados intentos seguidos. Espera un rato e intenta de nuevo.',
  invalid_code: 'Este QR ya no es válido. Pide a tu escuela el QR nuevo.',
  not_student: 'Tu cuenta no es alumno de la escuela de este QR.',
}
