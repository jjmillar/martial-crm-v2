import { supabase } from '../../lib/supabase'
import type { ClassFull } from '../clases/api'
import { addDays, todayIso } from '../../lib/dates'

/** A stored class session (one class that took / takes place on one date), see class_sessions. */
export type SessionRow = {
  id: string; number: number | null; class_id: string; schedule_id: string | null; date: string; start_time: string; end_time: string
  name: string; description: string | null; room: string | null; color: string; skill_ids: string[]; customized: boolean
  /** The team marked that this class did not take place (holiday, suspended). */
  not_held: boolean
  teacher: { full_name: string | null } | null
}

/**
 * What each card in Asistencia stands for: one class on one date. `row` is its stored record (sessions up to today
 * always have one, numbered; a future one only once it has been edited). Without a row it shows the class as it is now.
 */
export type Session = {
  key: string; cls: ClassFull; date: string; start_time: string; end_time: string; scheduleId: string | null; row: SessionRow | null
}

/** The data a card shows: its stored record when there is one, else the class. */
export const view = (s: Session) => ({
  number: s.row?.number ?? null,
  name: s.row?.name ?? s.cls.name,
  description: s.row ? s.row.description : s.cls.description,
  teacher: s.row ? s.row.teacher?.full_name ?? null : s.cls.teacher?.full_name ?? null,
  room: s.row ? s.row.room : s.cls.room,
  color: s.row?.color ?? s.cls.color,
  skillIds: s.row?.skill_ids ?? s.cls.tag_ids,
})

export const sessionKey = (classId: string, date: string, start: string) => `${classId}|${date}|${start.slice(0, 5)}`

/** One attendance on a card: who marked it (the student themself or the team) and who approved it, kept for analytics. */
export type Mark = { id?: string; student_id: string; confirmed: boolean; self_marked?: boolean; confirmed_by?: string | null; confirmed_at?: string | null; by_guardian?: boolean; by_qr?: boolean }

/** A check-in made by the student's guardian (apoderado) instead of the student. */
export const byGuardian = (r: { self_marked?: boolean | null; marked_by?: string | null; student?: { user_id?: string | null } | null }) =>
  Boolean(r.self_marked && r.marked_by && r.marked_by !== r.student?.user_id)
export type TrialBooking = {
  id: string; class_id: string | null; schedule_id: string | null; date: string; start_time: string
  name: string; phone: string; email: string | null; notes: string | null
}

export const attendanceKey = (classId: string, date: string) => ['attendance', classId, date] as const

export async function listAttendance(classId: string, date: string): Promise<Mark[]> {
  const { data, error } = await supabase.from('attendance').select('id, student_id, self_marked, confirmed_at, confirmed_by, marked_by, by_qr, student:students(user_id)').eq('class_id', classId).eq('date', date)
  if (error) throw error
  return data.map((r) => ({ id: r.id, student_id: r.student_id, confirmed: Boolean(r.confirmed_at), self_marked: r.self_marked, confirmed_by: r.confirmed_by, confirmed_at: r.confirmed_at, by_guardian: byGuardian(r), by_qr: r.by_qr }))
}

/** Creates the school's missing session records up to today and numbers them (cheap when there is nothing new). */
export async function syncSessions(schoolId: string): Promise<number> {
  const { data, error } = await supabase.rpc('sync_class_sessions', { p_school_id: schoolId })
  if (error) throw error
  return data ?? 0
}

export async function listSessions(schoolId: string, from: string, to: string): Promise<SessionRow[]> {
  const { data, error } = await supabase.from('class_sessions')
    .select('id, number, class_id, schedule_id, date, start_time, end_time, name, description, room, color, skill_ids, customized, not_held, teacher:teachers(full_name)')
    .eq('school_id', schoolId).gte('date', from).lte('date', to)
  if (error) throw error
  return data as SessionRow[]
}

/** Saves one card: description and skills of that session only. */
export async function saveSession(s: Session, description: string | null, skillIds: string[]): Promise<void> {
  const { error } = await supabase.rpc('save_class_session', {
    p_class_id: s.cls.id, p_date: s.date, p_start_time: s.start_time, p_description: description ?? '', p_skill_ids: skillIds,
  })
  if (error) throw error
}

/** Per class and date in a range ("classId|date"): confirmed attendances and students' check-ins waiting for approval. */
export async function attendanceCounts(schoolId: string, from: string, to: string): Promise<Map<string, { present: number; pending: number }>> {
  const { data, error } = await supabase.from('attendance').select('class_id, date, confirmed_at').eq('school_id', schoolId).gte('date', from).lte('date', to)
  if (error) throw error
  const m = new Map<string, { present: number; pending: number }>()
  for (const r of data) {
    const k = `${r.class_id}|${r.date}`
    const c = m.get(k) ?? { present: 0, pending: 0 }
    if (r.confirmed_at) c.present++; else c.pending++
    m.set(k, c)
  }
  return m
}

/** Attendance is taken only once the class has started (the database enforces it too). */
export function classStarted(date: string, start: string, now = new Date()): boolean {
  const zone = 'America/Santiago'
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: zone }).format(now)
  if (date !== today) return date < today
  const hm = new Intl.DateTimeFormat('en-GB', { timeZone: zone, hour: '2-digit', minute: '2-digit', hour12: false }).format(now)
  return hm >= start.slice(0, 5)
}

/** Approve or reject students' own check-ins (the team). Rejections are written to the audit log. */
export async function reviewAttendance(ids: string[], approve: boolean): Promise<void> {
  const { error } = await supabase.rpc('review_attendance', { p_ids: ids, p_approve: approve })
  if (error) throw new Error('No se pudo guardar la revisión de asistencia.')
}

export type PendingCheckIn = { id: string; date: string; created_at: string; class_id: string; self_marked: boolean; marked_by: string | null; class: { name: string; color: string } | null; student: { full_name: string | null; user_id: string | null } | null }
export const pendingCheckInsKey = (schoolId: string | undefined) => ['attendance-pending', schoolId] as const
/** Students' check-ins waiting for the team's approval. */
export async function pendingCheckIns(schoolId: string): Promise<PendingCheckIn[]> {
  const { data, error } = await supabase.from('attendance')
    .select('id, date, created_at, class_id, self_marked, marked_by, class:classes(name, color), student:students(full_name, user_id)')
    .eq('school_id', schoolId).is('confirmed_at', null).order('date', { ascending: false }).order('created_at').limit(200)
  if (error) throw error
  return data as unknown as PendingCheckIn[]
}

/** Trial classes booked from the landing page in a range (still scheduled). */
export async function trialBookings(schoolId: string, from: string, to: string): Promise<TrialBooking[]> {
  const { data, error } = await supabase.from('trial_bookings')
    .select('id, class_id, schedule_id, date, start_time, name, phone, email, notes')
    .eq('school_id', schoolId).eq('status', 'agendada').gte('date', from).lte('date', to).order('created_at')
  if (error) throw error
  return data
}

/** Mark (or unmark) a past or current class as not held: it leaves "Clases sin asistencia" in Tareas. */
export async function setNotHeld(sessionId: string, notHeld: boolean): Promise<void> {
  const { error } = await supabase.rpc('set_session_not_held', { p_session_id: sessionId, p_not_held: notHeld })
  if (error) throw new Error('No se pudo guardar. Intenta de nuevo.')
}

/** Days back that Tareas looks for classes without attendance. */
export const INCOMPLETE_DAYS = 7
const nowHHMM = () => new Intl.DateTimeFormat('en-GB', { timeZone: 'America/Santiago', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date())

export type IncompleteSession = SessionRow & { pending: number }
export const incompleteKey = (schoolId: string | undefined) => ['sessions-incomplete', schoolId] as const

/**
 * Classes that already ended (today or the last 7 days) without a single confirmed attendance and not marked as not
 * held: the class is not "complete" until it has at least one attendee. Newest first.
 */
const lastSync = new Map<string, number>()
export async function incompleteSessions(schoolId: string): Promise<IncompleteSession[]> {
  // Every class up to today must be stored; the badge polls every minute, so sync at most every 5 minutes.
  if (Date.now() - (lastSync.get(schoolId) ?? 0) > 5 * 60_000) { await syncSessions(schoolId); lastSync.set(schoolId, Date.now()) }
  const today = todayIso()
  const from = addDays(today, -INCOMPLETE_DAYS)
  const [rows, counts] = await Promise.all([listSessions(schoolId, from, today), attendanceCounts(schoolId, from, today)])
  const now = nowHHMM()
  return rows
    .filter((r) => !r.not_held && (r.date < today || r.end_time.slice(0, 5) <= now))
    .filter((r) => !counts.get(`${r.class_id}|${r.date}`)?.present)
    .map((r) => ({ ...r, pending: counts.get(`${r.class_id}|${r.date}`)?.pending ?? 0 }))
    .sort((a, b) => b.date.localeCompare(a.date) || b.start_time.localeCompare(a.start_time))
}
