import { supabase } from '../../lib/supabase'

// Martial arts of a school (copied from the platform's original catalog, then edited by the school), each student's
// belts, and achievements ("Logros").

export type Track = 'adultos' | 'kids'
export type DegreeName = 'franja' | 'grado' | 'dan' | 'poom'
export type Belt = {
  id: string; art_id: string; school_id: string; track: Track; position: number; name: string; color: string
  stripe: string | null; bar: string | null; pattern: BeltPattern; max_degree: number; degree_name: DegreeName; rank_label: string | null
}
export type BeltPattern = 'banda' | 'punta' | 'paneles'
export type Art = { id: string; school_id: string; name: string; template_key: string | null; position: number; active: boolean; belts: Belt[] }
export type ArtTemplate = { key: string; name: string; position: number }

export const TRACKS: { id: Track; label: string }[] = [
  { id: 'adultos', label: 'Adultos' },
  { id: 'kids', label: 'Kids' },
]
export const DEGREE_NAMES: { id: DegreeName; label: string }[] = [
  { id: 'franja', label: 'Franjas' },
  { id: 'grado', label: 'Grados' },
  { id: 'dan', label: 'Dan' },
  { id: 'poom', label: 'Poom' },
]

/** "2 franjas", "3º dan"; null without degree. Same rule as public.degree_text in the database. */
export function degreeText(degree: number | null | undefined, name: DegreeName | string): string | null {
  if (!degree) return null
  if (name === 'franja') return `${degree} ${degree === 1 ? 'franja' : 'franjas'}`
  return `${degree}º ${name}`
}

function friendly(message: string): string {
  if (message.includes('art exists') || message.includes('school_arts_school_id_name_key')) return 'La escuela ya tiene esa arte marcial.'
  if (message.includes('school_belts_art_id_track_name_key')) return 'Ya hay un cinturón con ese nombre en esa categoría.'
  if (message.includes('student_arts_art_id_school_id_fkey')) return 'Hay alumnos con esta arte marcial: quítasela a ellos primero o desactívala.'
  if (message.includes('student_arts_belt_id_art_id_fkey')) return 'Hay alumnos con este cinturón: cámbiales el cinturón primero.'
  if (message.includes('degree out of range')) return 'Ese grado es mayor que el máximo del cinturón.'
  if (message.includes('student_arts_student_id_art_id_key')) return 'El alumno ya tiene esa arte marcial.'
  if (message.includes('row-level security') || message.includes('not allowed')) return 'No tienes permiso para esta acción.'
  return 'No se pudo guardar. Intenta de nuevo.'
}
const fail = (e: { message: string } | null) => { if (e) throw new Error(friendly(e.message)) }

// --- Catalog and the school's arts ---------------------------------------------------------------------------------
export const templatesKey = ['art-templates'] as const
export async function listTemplates(): Promise<ArtTemplate[]> {
  const { data, error } = await supabase.from('art_templates').select('key, name, position').order('position')
  if (error) throw error
  return data
}

export const artsKey = (schoolId: string | undefined) => ['school-arts', schoolId] as const
export async function listArts(schoolId: string): Promise<Art[]> {
  const { data, error } = await supabase.from('school_arts')
    .select('id, school_id, name, template_key, position, active, belts:school_belts(id, art_id, school_id, track, position, name, color, stripe, bar, pattern, max_degree, degree_name, rank_label)')
    .eq('school_id', schoolId).order('position').order('name')
  if (error) throw error
  return (data as unknown as Art[]).map((a) => ({
    ...a,
    belts: [...a.belts].sort((x, y) => (x.track === y.track ? x.position - y.position : x.track === 'adultos' ? -1 : 1)),
  }))
}

export async function addFromTemplate(schoolId: string, key: string): Promise<string> {
  const { data, error } = await supabase.rpc('add_school_art', { p_school_id: schoolId, p_template_key: key })
  fail(error)
  return data as string
}

export async function createArt(schoolId: string, name: string, position: number) {
  const { error } = await supabase.from('school_arts').insert({ school_id: schoolId, name: name.trim(), position })
  fail(error)
}

export async function updateArt(id: string, patch: { name?: string; active?: boolean }) {
  const { error } = await supabase.from('school_arts').update(patch).eq('id', id)
  fail(error)
}

export async function deleteArt(id: string) {
  const { error } = await supabase.from('school_arts').delete().eq('id', id)
  fail(error)
}

export type BeltDraft = Pick<Belt, 'name' | 'color' | 'stripe' | 'bar' | 'pattern' | 'max_degree' | 'degree_name' | 'rank_label' | 'track'>
export async function saveBelt(art: Art, draft: BeltDraft, id?: string) {
  const row = { ...draft, name: draft.name.trim(), rank_label: draft.rank_label?.trim() || null }
  if (id) {
    const { error } = await supabase.from('school_belts').update(row).eq('id', id)
    return fail(error)
  }
  const last = art.belts.filter((b) => b.track === draft.track).reduce((m, b) => Math.max(m, b.position), 0)
  const { error } = await supabase.from('school_belts').insert({ ...row, school_id: art.school_id, art_id: art.id, position: last + 1 })
  fail(error)
}

export async function deleteBelt(id: string) {
  const { error } = await supabase.from('school_belts').delete().eq('id', id)
  fail(error)
}

/** Swap a belt with its neighbour in the same track. */
export async function moveBelt(a: Belt, b: Belt) {
  const r1 = await supabase.from('school_belts').update({ position: b.position }).eq('id', a.id)
  fail(r1.error)
  const r2 = await supabase.from('school_belts').update({ position: a.position }).eq('id', b.id)
  fail(r2.error)
}

// --- Each student's arts ----------------------------------------------------------------------------------------------
export type StudentArt = {
  id: string; art_id: string; belt_id: string | null; degree: number; since: string | null
  art: { name: string; position: number } | null
  belt: Pick<Belt, 'name' | 'color' | 'stripe' | 'bar' | 'pattern' | 'max_degree' | 'degree_name' | 'rank_label' | 'track' | 'position'> | null
}
const studentArtCols = 'id, art_id, belt_id, degree, since, art:school_arts(name, position), belt:school_belts(name, color, stripe, bar, pattern, max_degree, degree_name, rank_label, track, position)'

export const studentArtsKey = (studentId: string | undefined) => ['student-arts', studentId] as const
export async function listStudentArts(studentId: string): Promise<StudentArt[]> {
  const { data, error } = await supabase.from('student_arts').select(studentArtCols).eq('student_id', studentId)
  if (error) throw error
  return (data as unknown as StudentArt[]).sort((a, b) => (a.art?.position ?? 0) - (b.art?.position ?? 0))
}

/** Every student of the school with their arts (for the list). */
export const schoolStudentArtsKey = (schoolId: string | undefined) => ['school-student-arts', schoolId] as const
export async function listSchoolStudentArts(schoolId: string): Promise<Map<string, StudentArt[]>> {
  const { data, error } = await supabase.from('student_arts').select(`student_id, ${studentArtCols}`).eq('school_id', schoolId)
  if (error) throw error
  const map = new Map<string, StudentArt[]>()
  for (const r of data as unknown as (StudentArt & { student_id: string })[]) {
    map.set(r.student_id, [...(map.get(r.student_id) ?? []), r].sort((a, b) => (a.art?.position ?? 0) - (b.art?.position ?? 0)))
  }
  return map
}

export type ArtRow = { art_id: string; belt_id: string; degree: string; since: string }
export const rowFrom = (s: StudentArt): ArtRow => ({ art_id: s.art_id, belt_id: s.belt_id ?? '', degree: String(s.degree || ''), since: s.since ?? '' })

/** Writes the student's arts: removed ones are deleted, the rest upserted (one row per art). */
export async function saveStudentArts(schoolId: string, studentId: string, rows: ArtRow[], before: StudentArt[]) {
  const keep = new Set(rows.map((r) => r.art_id))
  const gone = before.filter((b) => !keep.has(b.art_id)).map((b) => b.id)
  if (gone.length) {
    const { error } = await supabase.from('student_arts').delete().in('id', gone)
    fail(error)
  }
  const prev = new Map(before.map((b) => [b.art_id, b]))
  for (const r of rows) {
    const p = prev.get(r.art_id)
    const next = { belt_id: r.belt_id || null, degree: r.belt_id ? Number(r.degree || 0) : 0, since: r.since || null }
    if (p && p.belt_id === next.belt_id && p.degree === next.degree && (p.since ?? null) === next.since) continue
    const { error } = p
      ? await supabase.from('student_arts').update(next).eq('id', p.id)
      : await supabase.from('student_arts').insert({ school_id: schoolId, student_id: studentId, art_id: r.art_id, ...next })
    fail(error)
  }
}

// --- Achievements --------------------------------------------------------------------------------------------------------
export type Medal = 'oro' | 'plata' | 'bronce' | 'participacion'
export const MEDALS: { id: Medal; label: string; icon: string }[] = [
  { id: 'oro', label: 'Oro', icon: '🥇' },
  { id: 'plata', label: 'Plata', icon: '🥈' },
  { id: 'bronce', label: 'Bronce', icon: '🥉' },
  { id: 'participacion', label: 'Participación', icon: '🎖️' },
]
export const medalOf = (m: string | null | undefined) => MEDALS.find((x) => x.id === m)

export type AchievementKind = 'graduacion' | 'torneo' | 'escuela'
export type Achievement = {
  id: string; student_id: string; kind: AchievementKind; title: string; detail: string | null; date: string
  medal: Medal | null; category: string | null; status: 'pendiente' | 'aprobado' | 'rechazado'; reject_reason: string | null
  created_at: string
  art: { name: string } | null
  belt: { color: string; stripe: string | null; bar: string | null; pattern: string } | null
  badge: { icon: string | null } | null
}
export type Milestone = { key: string; kind: string; title: string; icon: string; date: string }

const achCols = 'id, student_id, kind, title, detail, date, medal, category, status, reject_reason, created_at, art:school_arts(name), belt:school_belts(color, stripe, bar, pattern), badge:school_badges(icon)'

export const achievementsKey = (studentId: string | undefined) => ['achievements', studentId] as const
export async function listAchievements(studentId: string): Promise<Achievement[]> {
  const { data, error } = await supabase.from('achievements').select(achCols).eq('student_id', studentId)
    .order('date', { ascending: false }).order('created_at', { ascending: false })
  if (error) throw error
  return data as unknown as Achievement[]
}

export const milestonesKey = (studentId: string | undefined) => ['milestones', studentId] as const
export async function listMilestones(studentId: string): Promise<Milestone[]> {
  const { data, error } = await supabase.rpc('student_achievements', { p_student_id: studentId })
  if (error) throw error
  return (data ?? []) as unknown as Milestone[]
}

export type AchievementDraft = {
  kind: 'torneo' | 'escuela' | 'graduacion'; title: string; date: string; detail: string
  medal: Medal | ''; category: string; art_id: string; badge_id: string
}
export const emptyDraft = (kind: AchievementDraft['kind'], date: string): AchievementDraft =>
  ({ kind, title: '', date, detail: '', medal: kind === 'torneo' ? 'oro' : '', category: '', art_id: '', badge_id: '' })

/** Client-side check (the database checks again). */
export function draftError(d: AchievementDraft, today: string): string | null {
  if (d.kind === 'escuela' && !d.badge_id) return 'Elige la insignia.'
  if (d.kind !== 'escuela' && !d.title.trim()) return d.kind === 'torneo' ? 'Escribe el nombre del torneo.' : 'Escribe el cinturón o grado.'
  if (d.title.length > 100) return 'El nombre es muy largo (máximo 100).'
  if (!d.date) return 'Indica la fecha.'
  if (d.date > today) return 'La fecha no puede ser futura.'
  if (d.detail.length > 300) return 'El detalle es muy largo (máximo 300).'
  if (d.category.length > 60) return 'La categoría es muy larga (máximo 60).'
  return null
}

/** The team adds an achievement (already approved). */
export async function addAchievement(schoolId: string, studentId: string, d: AchievementDraft, badgeName?: string) {
  const { error } = await supabase.from('achievements').insert({
    school_id: schoolId, student_id: studentId, kind: d.kind, status: 'aprobado',
    title: d.kind === 'escuela' ? badgeName ?? d.title : d.title.trim(), date: d.date, detail: d.detail.trim() || null,
    medal: d.kind === 'torneo' ? d.medal || null : null, category: d.kind === 'torneo' ? d.category.trim() || null : null,
    art_id: d.art_id || null, badge_id: d.kind === 'escuela' ? d.badge_id : null,
  })
  fail(error)
}

export async function deleteAchievement(id: string) {
  const { error } = await supabase.from('achievements').delete().eq('id', id)
  fail(error)
}

/** The student (or guardian) submits a tournament; the team approves it in Tareas. */
export async function submitAchievement(studentId: string, d: AchievementDraft) {
  // Optional arguments go as SQL null (the generated types don't mark function arguments nullable).
  const opt = (v: string) => (v || null) as string
  const { error } = await supabase.rpc('submit_achievement', {
    p_student_id: studentId, p_title: d.title.trim(), p_date: d.date, p_medal: opt(d.medal),
    p_category: opt(d.category.trim()), p_art_id: opt(d.art_id), p_detail: opt(d.detail.trim()),
  })
  if (error) {
    if (error.message.includes('too many pending')) throw new Error('Tienes 5 logros esperando aprobación. Espera a que la escuela los revise.')
    if (error.message.includes('too many')) throw new Error('Demasiados intentos. Prueba en una hora.')
    throw new Error('No se pudo enviar. Revisa los datos.')
  }
}

export async function withdrawAchievement(id: string) {
  const { error } = await supabase.rpc('withdraw_achievement', { p_id: id })
  if (error) throw new Error('No se pudo retirar.')
}

export type PendingAchievement = Achievement & { school_id: string; student: { full_name: string | null } | null }
export const pendingAchievementsKey = (schoolId: string | undefined) => ['achievements-pending', schoolId] as const
export async function pendingAchievements(schoolId: string): Promise<PendingAchievement[]> {
  const { data, error } = await supabase.from('achievements').select(`${achCols}, school_id, student:students(full_name)`)
    .eq('school_id', schoolId).eq('status', 'pendiente').order('created_at')
  if (error) throw error
  return data as unknown as PendingAchievement[]
}

export async function decideAchievement(id: string, approve: boolean, reason?: string) {
  const { error } = await supabase.from('achievements')
    .update({ status: approve ? 'aprobado' : 'rechazado', reject_reason: approve ? null : reason?.trim().slice(0, 200) || null }).eq('id', id)
  fail(error)
}
