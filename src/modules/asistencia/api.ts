import { supabase } from '../../lib/supabase'
import type { ClassFull } from '../clases/api'

/** A stored class session (one class that took / takes place on one date), see class_sessions. */
export type SessionRow = {
  id: string; number: number | null; class_id: string; schedule_id: string | null; date: string; start_time: string; end_time: string
  name: string; description: string | null; room: string | null; color: string; skill_ids: string[]; customized: boolean
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

export type Mark = { student_id: string; confirmed: boolean }
export type TrialBooking = {
  id: string; class_id: string | null; schedule_id: string | null; date: string; start_time: string
  name: string; phone: string; email: string | null; notes: string | null
}

export const attendanceKey = (classId: string, date: string) => ['attendance', classId, date] as const

export async function listAttendance(classId: string, date: string): Promise<Mark[]> {
  const { data, error } = await supabase.from('attendance').select('student_id, confirmed_at').eq('class_id', classId).eq('date', date)
  if (error) throw error
  return data.map((r) => ({ student_id: r.student_id, confirmed: Boolean(r.confirmed_at) }))
}

/** Creates the school's missing session records up to today and numbers them (cheap when there is nothing new). */
export async function syncSessions(schoolId: string): Promise<number> {
  const { data, error } = await supabase.rpc('sync_class_sessions', { p_school_id: schoolId })
  if (error) throw error
  return data ?? 0
}

export async function listSessions(schoolId: string, from: string, to: string): Promise<SessionRow[]> {
  const { data, error } = await supabase.from('class_sessions')
    .select('id, number, class_id, schedule_id, date, start_time, end_time, name, description, room, color, skill_ids, customized, teacher:teachers(full_name)')
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

/** Present count per class and date in a range ("classId|date" → n), for the cards. */
export async function attendanceCounts(schoolId: string, from: string, to: string): Promise<Map<string, number>> {
  const { data, error } = await supabase.from('attendance').select('class_id, date').eq('school_id', schoolId).gte('date', from).lte('date', to)
  if (error) throw error
  const m = new Map<string, number>()
  for (const r of data) m.set(`${r.class_id}|${r.date}`, (m.get(`${r.class_id}|${r.date}`) ?? 0) + 1)
  return m
}

/** Trial classes booked from the landing page in a range (still scheduled). */
export async function trialBookings(schoolId: string, from: string, to: string): Promise<TrialBooking[]> {
  const { data, error } = await supabase.from('trial_bookings')
    .select('id, class_id, schedule_id, date, start_time, name, phone, email, notes')
    .eq('school_id', schoolId).eq('status', 'agendada').gte('date', from).lte('date', to).order('created_at')
  if (error) throw error
  return data
}
