import { supabase } from '../../lib/supabase'
import type { Student, StudentInsert, StudentUpdate } from '../../lib/database.types'

export const studentsKey = (schoolId: string | undefined) => ['students', schoolId] as const

export async function listStudents(schoolId: string): Promise<Student[]> {
  const { data, error } = await supabase.from('students').select('*').eq('school_id', schoolId).order('full_name')
  if (error) throw error
  return data
}

export async function getStudent(id: string): Promise<Student | null> {
  const { data, error } = await supabase.from('students').select('*').eq('id', id).maybeSingle()
  if (error) throw error
  return data
}

function friendly(message: string): string {
  if (message.includes('students_school_rut_key')) return 'Ya existe un alumno con ese RUT en esta escuela.'
  if (message.includes('students_rut_valid')) return 'El RUT no es válido.'
  if (message.includes('payments_student_id_school_id_fkey')) return 'Este alumno tiene pagos registrados: márcalo como inactivo en vez de eliminarlo.'
  if (message.includes('row-level security')) return 'No tienes permiso para esta acción.'
  return 'No se pudo guardar. Revisa los datos e intenta de nuevo.'
}

export async function createStudent(input: StudentInsert): Promise<Student> {
  const { data, error } = await supabase.from('students').insert(input).select('*').single()
  if (error) throw new Error(friendly(error.message))
  return data
}

export async function updateStudent(id: string, input: StudentUpdate): Promise<Student> {
  const { data, error } = await supabase.from('students').update(input).eq('id', id).select('*').single()
  if (error) throw new Error(friendly(error.message))
  return data
}

export async function deleteStudent(id: string): Promise<void> {
  const { error, count } = await supabase.from('students').delete({ count: 'exact' }).eq('id', id)
  if (error) throw new Error(friendly(error.message))
  if (count === 0) throw new Error('No tienes permiso para eliminar alumnos.')
}
