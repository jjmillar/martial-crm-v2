import { supabase } from '../../lib/supabase'
import type { ClassFull } from '../clases/api'

/** One class block on one date: what each card in Asistencia stands for. */
export type Session = { cls: ClassFull; block: ClassFull['schedules'][number]; date: string }

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
