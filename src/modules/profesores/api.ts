import { supabase } from '../../lib/supabase'
import type { Specialty, Teacher, TeacherInsert } from '../../lib/database.types'

export type TeacherWithSpecialties = Teacher & { specialty_ids: string[] }

export const teachersKey = (schoolId: string | undefined) => ['teachers', schoolId] as const
// Distinct from the Ajustes catalog key, which caches a different (mapped) shape.
export const specialtiesKey = (schoolId: string | undefined) => ['specialties', schoolId] as const

export async function listTeachers(schoolId: string): Promise<TeacherWithSpecialties[]> {
  const { data, error } = await supabase
    .from('teachers')
    .select('*, teacher_specialties(specialty_id)')
    .eq('school_id', schoolId)
    .order('full_name')
  if (error) throw error
  return data.map(({ teacher_specialties, ...t }) => ({ ...t, specialty_ids: teacher_specialties.map((x) => x.specialty_id) }))
}

export async function getTeacher(id: string): Promise<TeacherWithSpecialties | null> {
  const { data, error } = await supabase.from('teachers').select('*, teacher_specialties(specialty_id)').eq('id', id).maybeSingle()
  if (error) throw error
  if (!data) return null
  const { teacher_specialties, ...t } = data
  return { ...t, specialty_ids: teacher_specialties.map((x) => x.specialty_id) }
}

export async function listSpecialties(schoolId: string): Promise<Specialty[]> {
  const { data, error } = await supabase.from('specialties').select('*').eq('school_id', schoolId).order('name')
  if (error) throw error
  return data
}

function friendly(message: string): string {
  if (message.includes('teachers_school_rut_key')) return 'Ya existe un profesor con ese RUT en esta escuela.'
  if (message.includes('teachers_school_user_key')) return 'Esa cuenta ya está vinculada a otro profesor.'
  if (message.includes('member of the school')) return 'La cuenta vinculada debe ser miembro de la escuela.'
  if (message.includes('teachers_rut_valid')) return 'El RUT no es válido.'
  if (message.includes('row-level security')) return 'Solo los administradores pueden editar profesores.'
  return 'No se pudo guardar. Revisa los datos e intenta de nuevo.'
}

export type TeacherPayload = Omit<TeacherInsert, 'school_id'>

/** Creates or updates the teacher, then replaces its specialties. */
export async function saveTeacher(schoolId: string, id: string | null, payload: TeacherPayload, specialtyIds: string[]): Promise<Teacher> {
  const q = id
    ? supabase.from('teachers').update(payload).eq('id', id)
    : supabase.from('teachers').insert({ ...payload, school_id: schoolId })
  const { data, error } = await q.select('*').single()
  if (error) throw new Error(friendly(error.message))
  const { error: spErr } = await supabase.rpc('set_teacher_specialties', { p_teacher_id: data.id, p_specialty_ids: specialtyIds })
  if (spErr) throw new Error('El profesor se guardó, pero no sus especialidades. Intenta guardar de nuevo.')
  return data
}

export async function deleteTeacher(id: string): Promise<void> {
  const { error, count } = await supabase.from('teachers').delete({ count: 'exact' }).eq('id', id)
  if (error) throw new Error(friendly(error.message))
  if (count === 0) throw new Error('Solo los administradores pueden eliminar profesores.')
}
