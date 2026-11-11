import { supabase } from '../../lib/supabase'
import type { ClassLevel, ClassRow, ClassSchedule } from '../../lib/database.types'

export type ClassFull = ClassRow & {
  schedules: Pick<ClassSchedule, 'id' | 'weekday' | 'start_time' | 'end_time'>[]
  tag_ids: string[]
  teacher: { id: string; full_name: string | null } | null
  specialty: { id: string; name: string } | null
}

export const classesKey = (schoolId: string | undefined) => ['classes', schoolId] as const

const select =
  '*, schedules:class_schedules(id, weekday, start_time, end_time), class_tags(tag_id), teacher:teachers(id, full_name), specialty:specialties(id, name)'

type Raw = ClassRow & { schedules: ClassFull['schedules']; class_tags: { tag_id: string }[]; teacher: ClassFull['teacher']; specialty: ClassFull['specialty'] }
const shape = ({ class_tags, ...c }: Raw): ClassFull => ({
  ...c,
  tag_ids: class_tags.map((t) => t.tag_id),
  schedules: [...c.schedules].sort((a, b) => a.weekday - b.weekday || a.start_time.localeCompare(b.start_time)),
})

export async function listClasses(schoolId: string): Promise<ClassFull[]> {
  const { data, error } = await supabase.from('classes').select(select).eq('school_id', schoolId).order('name')
  if (error) throw error
  return (data as unknown as Raw[]).map(shape)
}

export async function getClass(id: string): Promise<ClassFull | null> {
  const { data, error } = await supabase.from('classes').select(select).eq('id', id).maybeSingle()
  if (error) throw error
  return data ? shape(data as unknown as Raw) : null
}

export async function listTags(schoolId: string) {
  const { data, error } = await supabase.from('tags').select('*').eq('school_id', schoolId).order('label')
  if (error) throw error
  return data
}

function friendly(message: string): string {
  if (message.includes('class_schedules_teacher_overlap')) return 'El profesor ya tiene otra clase que se cruza con uno de estos horarios.'
  if (message.includes('class_schedules_time_order')) return 'Cada horario debe terminar después de empezar.'
  if (message.includes('only admins') || message.includes('row-level security')) return 'Solo los administradores pueden editar clases.'
  return 'No se pudo guardar. Revisa los datos e intenta de nuevo.'
}

export type ClassInput = {
  name: string
  specialty_id: string | null
  teacher_id: string | null
  room: string | null
  capacity: number | null
  level: ClassLevel
  color: string
  notes: string | null
  active: boolean
}
export type Block = { weekday: number; start_time: string; end_time: string }

/** Saves the class row, then tags + schedule atomically through set_class_details. */
export async function saveClass(schoolId: string, id: string | null, input: ClassInput, tagIds: string[], blocks: Block[]): Promise<ClassRow> {
  const q = id ? supabase.from('classes').update(input).eq('id', id) : supabase.from('classes').insert({ ...input, school_id: schoolId })
  const { data, error } = await q.select('*').single()
  if (error) throw new Error(friendly(error.message))
  const { error: dErr } = await supabase.rpc('set_class_details', { p_class_id: data.id, p_tag_ids: tagIds, p_blocks: blocks })
  if (dErr) {
    // A brand-new class whose schedule failed would be left half-saved; remove it so the form can be retried.
    if (!id) await supabase.from('classes').delete().eq('id', data.id)
    throw new Error(friendly(dErr.message))
  }
  return data
}

export async function deleteClass(id: string): Promise<void> {
  const { error, count } = await supabase.from('classes').delete({ count: 'exact' }).eq('id', id)
  if (error) throw new Error(friendly(error.message))
  if (count === 0) throw new Error('Solo los administradores pueden eliminar clases.')
}

export const levelLabel: Record<ClassLevel, string> = {
  todos: 'Todos los niveles', principiante: 'Principiante', intermedio: 'Intermedio', avanzado: 'Avanzado', ninos: 'Niños', competicion: 'Competición',
}

export const classColors = ['#e0492c', '#e8873a', '#e8c547', '#3fb27f', '#3d9be0', '#3d5be0', '#8a5cd6', '#d65c9e']
