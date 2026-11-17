import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useSchool } from '../../lib/school'
import { formatDate, santiagoDate } from '../../lib/dates'
import { Icon } from '../../ui/Icon'
import { pendingCheckIns, pendingCheckInsKey, reviewAttendance, type PendingCheckIn } from './api'

const timeFmt = new Intl.DateTimeFormat('es-CL', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'America/Santiago' })

// Students who marked their own attendance, waiting for the team. Approving adds it to the class (with who approved,
// for analytics) and gives XP; rejecting removes it (kept in the audit log).
export function AsistenciasPorAprobar() {
  const { activeSchool } = useSchool()
  const schoolId = activeSchool?.id
  const qc = useQueryClient()
  const q = useQuery({ queryKey: pendingCheckInsKey(schoolId), queryFn: () => pendingCheckIns(schoolId!), enabled: Boolean(schoolId), refetchInterval: 60_000 })
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)

  const review = useMutation({
    mutationFn: async (v: { rows: PendingCheckIn[]; approve: boolean }) => { await reviewAttendance(v.rows.map((r) => r.id), v.approve); return v },
    onMutate: () => setMsg(null),
    onSuccess: async (v) => {
      await Promise.all([qc.invalidateQueries({ queryKey: ['attendance-pending'] }), qc.invalidateQueries({ queryKey: ['attendance'] }), qc.invalidateQueries({ queryKey: ['attendance-range'] })])
      const one = v.rows.length === 1 ? v.rows[0].student?.full_name ?? 'el alumno' : null
      setMsg({ ok: true, text: v.approve
        ? (one ? `Asistencia de ${one} aprobada.` : `${v.rows.length} asistencias aprobadas.`)
        : (one ? `Asistencia de ${one} rechazada.` : `${v.rows.length} asistencias rechazadas.`) })
    },
    onError: (e: Error) => setMsg({ ok: false, text: e.message }),
  })

  const rows = q.data ?? []
  return (
    <section className="tareas__approvals" aria-labelledby="att-rev-h">
      <div className="tareas__section-head att-req-head">
        <div>
          <h2 id="att-rev-h">Asistencias por aprobar {rows.length > 0 && <span className="nav-badge">{rows.length}</span>}</h2>
          <p className="hint">Alumnos que marcaron su asistencia desde su cuenta. Aprueba si vinieron a la clase.</p>
        </div>
        {rows.length > 1 && (
          <button type="button" className="btn" disabled={review.isPending} onClick={() => review.mutate({ rows, approve: true })}><Icon name="check" size={16} /> Aprobar todas</button>
        )}
      </div>
      {msg && <p className={`alert${msg.ok ? ' alert--ok' : ''}`} role={msg.ok ? 'status' : 'alert'}>{msg.text}</p>}
      {q.isLoading && <p className="hint">Cargando…</p>}
      {q.isSuccess && rows.length === 0 && <p className="hint">No hay asistencias por aprobar.</p>}
      {rows.length > 0 && (
        <ul className="card att-req-list" data-motion>
          {rows.map((r) => (
            <li key={r.id} className="att-req" style={{ ['--class-color' as string]: r.class?.color }}>
              <span className="att-req__main">
                <strong>{r.student?.full_name ?? 'Alumno'}</strong>
                <span className="hint">{r.class?.name ?? 'Clase'} · {formatDate(r.date)} · marcó a las {timeFmt.format(new Date(r.created_at))}{santiagoDate(r.created_at) !== r.date ? ` del ${formatDate(santiagoDate(r.created_at))}` : ''}</span>
              </span>
              <span className="att-review">
                <button type="button" className="btn" disabled={review.isPending} onClick={() => review.mutate({ rows: [r], approve: true })}>Aprobar</button>
                <button type="button" className="btn btn--ghost" disabled={review.isPending} onClick={() => review.mutate({ rows: [r], approve: false })}>Rechazar</button>
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
