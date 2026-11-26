import { supabase } from '../../lib/supabase'

// Student portal (card item 7): the signed-in student's own progress, attendance and check-in.

export type Skill = { tag_id: string; label: string; icon: string | null; xp: number }
export type Progress = {
  xp: number
  level: number
  level_xp: number
  next_level_xp: number
  attended: number
  pending: number
  skills: Skill[]
}

export { XP_PER_CLASS, levelOf } from './xp'

export const progressKey = (studentId: string | undefined) => ['student-progress', studentId] as const
export async function studentProgress(studentId: string): Promise<Progress> {
  const { data, error } = await supabase.rpc('student_progress', { p_student_id: studentId })
  if (error) throw error
  return data as unknown as Progress
}

export type MyAttendance = { id: string; date: string; class_id: string; self_marked: boolean; confirmed_at: string | null; class: { name: string; color: string } | null }
export const myAttendanceKey = (studentId: string | undefined) => ['my-attendance', studentId] as const
export async function myAttendance(studentId: string): Promise<MyAttendance[]> {
  const { data, error } = await supabase
    .from('attendance')
    .select('id, date, class_id, self_marked, confirmed_at, class:classes(name, color)')
    .eq('student_id', studentId)
    .order('date', { ascending: false })
    .limit(60)
  if (error) throw error
  return data as unknown as MyAttendance[]
}

/** Check-in for the student shown in the portal: the user's own record or, for a guardian, a child's. */
export async function checkIn(studentId: string, classId: string, date: string) {
  const { error } = await supabase.rpc('check_in_for', { p_student_id: studentId, p_class_id: classId, p_date: date })
  if (error) {
    if (error.message.includes('not scheduled')) throw new Error('Esa clase no tenía horario ese día.')
    if (error.message.includes('date out of range')) throw new Error('Solo puedes marcar clases de los últimos 7 días.')
    if (error.message.includes('class not started')) throw new Error('La asistencia se marca cuando empieza la clase.')
    if (error.message.includes('not a student')) throw new Error('Esta cuenta no puede marcar asistencia para ese alumno.')
    throw new Error('No se pudo marcar la asistencia. Intenta de nuevo.')
  }
}

export async function undoCheckIn(studentId: string, classId: string, date: string) {
  const { error } = await supabase.rpc('undo_check_in_for', { p_student_id: studentId, p_class_id: classId, p_date: date })
  if (error) throw new Error('No se pudo deshacer.')
}

export type MyEnrollment = { id: string; plan_id: string; status: string; ends_at: string | null; start_date: string; plan: { name: string } | null }
export async function myEnrollments(studentId: string): Promise<MyEnrollment[]> {
  const { data, error } = await supabase
    .from('enrollments')
    .select('id, plan_id, status, ends_at, start_date, plan:plans(name)')
    .eq('student_id', studentId)
    .neq('status', 'cancelada')
    .order('start_date', { ascending: false })
  if (error) throw error
  return data as unknown as MyEnrollment[]
}

export async function myPendingPayments(studentId: string) {
  const { data, error } = await supabase
    .from('payments')
    .select('id, concept, amount, due_date')
    .eq('student_id', studentId)
    .eq('status', 'pendiente')
    .order('due_date', { ascending: true })
  if (error) throw error
  return data
}
