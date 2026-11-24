import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import type { ClassFull } from '../clases/api'
import { incompleteKey, listSessions, sessionKey, trialBookings, type Session } from './api'
import { SessionDialog } from './SessionDialog'

/** A class on a date, as the other menus know it (Inicio, Calendario, Tareas). */
export type SessionTarget = { cls: ClassFull; date: string; start_time: string; end_time: string; scheduleId: string | null }

/** Asistencia link for the "Para más información" footer: that day, with this class's card open. */
export const asistenciaHref = (t: Pick<SessionTarget, 'date' | 'start_time'> & { classId: string }) =>
  `/app/asistencia?vista=day&fecha=${t.date}&clase=${encodeURIComponent(sessionKey(t.classId, t.date, t.start_time))}`

/**
 * Asistencia's class pop-up, opened from another menu without leaving it (docs/ui-standards.md §6). It loads the stored
 * session and the trial bookings of that date, and ends with an optional link to Asistencia.
 */
export function useSessionPopup(schoolId: string | undefined) {
  const qc = useQueryClient()
  const [target, setTarget] = useState<SessionTarget | null>(null) // stays while the pop-up closes
  const [open, setOpen] = useState(false)
  const date = target?.date
  const rows = useQuery({ queryKey: ['class-sessions', schoolId, date, date], queryFn: () => listSessions(schoolId!, date!, date!), enabled: Boolean(schoolId && date) })
  const trials = useQuery({ queryKey: ['trial-range', schoolId, date, date], queryFn: () => trialBookings(schoolId!, date!, date!), enabled: Boolean(schoolId && date) })

  const hm = target?.start_time.slice(0, 5)
  const row = target ? (rows.data ?? []).find((r) => r.class_id === target.cls.id && r.start_time.slice(0, 5) === hm) ?? null : null
  const session: Session | null = target && rows.isSuccess ? {
    key: sessionKey(target.cls.id, target.date, target.start_time), cls: target.cls, date: target.date,
    start_time: row?.start_time ?? target.start_time, end_time: row?.end_time ?? target.end_time, scheduleId: target.scheduleId, row,
  } : null
  const sessionTrials = (trials.data ?? []).filter((t) =>
    (target?.scheduleId && t.schedule_id === target.scheduleId) || (t.class_id === target?.cls.id && t.start_time.slice(0, 5) === hm))

  const close = () => {
    setOpen(false)
    // whatever lists the classes (counts, Tareas) refreshes
    qc.invalidateQueries({ queryKey: incompleteKey(schoolId) })
    qc.invalidateQueries({ queryKey: ['attendance-range', schoolId] })
  }
  const dialog = (
    <SessionDialog
      session={session}
      open={open && Boolean(session)}
      onClose={close}
      trials={sessionTrials}
      more={target ? { text: 'ver todas las clases de ese día', menu: 'Asistencia', to: asistenciaHref({ classId: target.cls.id, date: target.date, start_time: target.start_time }) } : undefined}
    />
  )
  return { openSession: (t: SessionTarget) => { setTarget(t); setOpen(true) }, dialog }
}
