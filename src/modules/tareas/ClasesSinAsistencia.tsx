import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from '../../lib/nav'
import { addDays, longDate, todayIso } from '../../lib/dates'
import { hhmm } from '../../lib/weekdays'
import { Icon } from '../../ui/Icon'
import { incompleteKey, incompleteSessions, INCOMPLETE_DAYS, sessionKey, setNotHeld, type IncompleteSession } from '../asistencia/api'

const when = (date: string, today: string) =>
  date === today ? 'Hoy' : date === addDays(today, -1) ? 'Ayer' : longDate(date)

/** Asistencia link that opens that class's card directly. */
export const takeAttendanceHref = (s: Pick<IncompleteSession, 'class_id' | 'date' | 'start_time'>) =>
  `/app/asistencia?vista=day&fecha=${s.date}&clase=${encodeURIComponent(sessionKey(s.class_id, s.date, s.start_time))}`

/**
 * Tareas → Clases sin asistencia: classes that already ended (last 7 days) without a single confirmed attendee. A class
 * is complete once it has at least one; if it did not take place, "No se hizo" takes it off the list.
 */
export function ClasesSinAsistencia({ schoolId }: { schoolId: string }) {
  const qc = useQueryClient()
  const today = todayIso()
  const q = useQuery({ queryKey: incompleteKey(schoolId), queryFn: () => incompleteSessions(schoolId), refetchInterval: 60_000 })
  const [msg, setMsg] = useState<{ ok: boolean; text: string; undo?: string } | null>(null)
  const refresh = () => Promise.all([
    qc.invalidateQueries({ queryKey: incompleteKey(schoolId) }),
    qc.invalidateQueries({ queryKey: ['class-sessions', schoolId] }),
  ])
  const notHeld = useMutation({
    mutationFn: async (v: { s: IncompleteSession; value: boolean }) => { await setNotHeld(v.s.id, v.value); return v },
    onMutate: () => setMsg(null),
    onSuccess: async (v) => {
      await refresh()
      setMsg(v.value ? { ok: true, text: `${v.s.name} (${when(v.s.date, today).toLowerCase()}) quedó como no realizada.`, undo: v.s.id } : { ok: true, text: 'Listo, volvió a la lista.' })
    },
    onError: (e: Error) => setMsg({ ok: false, text: e.message }),
  })
  const list = q.data ?? []
  const undoRow = (id: string) => ({ id } as IncompleteSession)

  if (q.isLoading) return null
  if (list.length === 0 && !msg) return null
  return (
    <section className="tareas__approvals" aria-labelledby="sinasis-h">
      <div className="tareas__section-head appr-head">
        <div>
          <h2 id="sinasis-h">Clases sin asistencia {list.length > 0 && <span className="nav-badge">{list.length}</span>}</h2>
          <p className="hint">Clases de los últimos {INCOMPLETE_DAYS} días que ya terminaron y no tienen ningún asistente confirmado. Se completan al marcar al menos uno.</p>
        </div>
      </div>
      {msg && (
        <p className={`alert${msg.ok ? ' alert--ok' : ''}`} role={msg.ok ? 'status' : 'alert'}>
          {msg.text}
          {msg.undo && <> <button type="button" className="link-btn" disabled={notHeld.isPending} onClick={() => notHeld.mutate({ s: undoRow(msg.undo!), value: false })}>Deshacer</button></>}
        </p>
      )}
      {list.length > 0 && (
        <ul className="card appr-list" data-motion>
          {list.map((s) => (
            <li key={s.id} className="appr" style={{ ['--class-color' as string]: s.color }}>
              <span className="appr__main">
                <span className="appr__title"><span className="tag appr__kind">Clase</span><strong>{s.name}</strong></span>
                <span className="hint">
                  {[`${when(s.date, today)} · ${hhmm(s.start_time)}–${hhmm(s.end_time)}`, s.teacher?.full_name, s.number ? `N° ${s.number}` : null].filter(Boolean).join(' · ')}
                </span>
                {s.pending > 0 && <span className="hint"><span className="tag tag--wait">{s.pending} por aprobar</span> Apruébalas arriba para completarla.</span>}
              </span>
              <span className="appr__actions">
                <Link className="btn" to={takeAttendanceHref(s)}><Icon name="check" size={16} /> Tomar asistencia</Link>
                <button type="button" className="btn btn--ghost" disabled={notHeld.isPending} onClick={() => notHeld.mutate({ s, value: true })}>No se hizo</button>
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
