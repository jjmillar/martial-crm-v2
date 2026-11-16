import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { useSchool } from '../../lib/school'
import { longDate, todayIso } from '../../lib/dates'
import { hhmm } from '../../lib/weekdays'
import { Icon } from '../../ui/Icon'
import { Modal } from '../../ui/Modal'
import { flash } from '../../ui/flashEvent'
import { Toggle } from '../../ui/Toggle'
import { listStudents, studentsKey } from '../alumnos/api'
import { listTags, type ClassFull } from '../clases/api'
import { enrollmentsKey, listEnrollments, phaseOf } from '../matriculas/api'
import { CatalogoDialog } from '../ajustes/CatalogoDialog'
import { attendanceKey, listAttendance, saveSession, view, type Mark, type Session, type TrialBooking } from './api'

const normalize = (s: string) => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()

type Props = { session: Session | null; open: boolean; onClose: () => void; trials: TrialBooking[] }

/**
 * One class on one date, opened from its card in Asistencia: trial classes booked for it (with the visitor's
 * details), the attendance list (marking attendees happens only here), and the class's skills and description.
 */
export function SessionDialog({ session, open, onClose, trials }: Props) {
  return (
    <Modal open={open} onClose={onClose} wide label={session ? `${view(session).name}, ${longDate(session.date)}` : 'Clase'}>
      {session && <SessionBody key={session.key} session={session} trials={trials} onClose={onClose} />}
    </Modal>
  )
}

function SessionBody({ session, trials, onClose }: { session: Session; trials: TrialBooking[]; onClose: () => void }) {
  const { cls, date } = session
  const v = view(session)
  const today = todayIso()
  const canMark = date <= today
  return (
    <>
      <div className="modal__head">
        <span className="eyebrow">{v.number ? `Clase N° ${v.number} · ` : ''}{longDate(date)} · {hhmm(session.start_time)}–{hhmm(session.end_time)}</span>
        <button type="button" className="icon-btn" onClick={onClose} aria-label="Cerrar"><Icon name="close" /></button>
      </div>
      <div className="sess-title" style={{ ['--class-color' as string]: v.color }}>
        <h2>{v.name}</h2>
        <p className="hint">{[v.teacher ?? 'Sin profesor', v.room].filter(Boolean).join(' · ')}</p>
      </div>

      {trials.length > 0 && (
        <section className="sess-section" aria-labelledby="sess-trial-h">
          <h3 id="sess-trial-h"><span className="tag tag--accent">Clase de prueba</span> {trials.length === 1 ? '1 persona agendada' : `${trials.length} personas agendadas`}</h3>
          <ul className="sess-trials">
            {trials.map((t) => (
              <li key={t.id} className="sess-trial">
                <strong>{t.name}</strong>
                <span className="hint">
                  <a href={`tel:${t.phone.replace(/\s/g, '')}`}>{t.phone}</a>
                  {' · '}<a href={`https://wa.me/${t.phone.replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer">WhatsApp</a>
                  {t.email && <> · <a href={`mailto:${t.email}`}>{t.email}</a></>}
                </span>
                {t.notes && <span className="hint">“{t.notes}”</span>}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="sess-section" aria-labelledby="sess-att-h">
        <h3 id="sess-att-h">Asistencia</h3>
        {canMark ? <Roster cls={cls} date={date} /> : <p className="hint">La asistencia se toma desde el día de la clase.</p>}
      </section>

      <SessionInfo session={session} onSaved={onClose} />
    </>
  )
}

// Attendance list: tap to mark present / unmark; a student's own check-in waits for confirmation (that gives XP).
function Roster({ cls, date }: { cls: ClassFull; date: string }) {
  const { activeSchool } = useSchool()
  const schoolId = activeSchool!.id
  const qc = useQueryClient()
  const students = useQuery({ queryKey: studentsKey(schoolId), queryFn: () => listStudents(schoolId) })
  const enrollments = useQuery({ queryKey: enrollmentsKey(schoolId), queryFn: () => listEnrollments(schoolId) })
  const attKey = attendanceKey(cls.id, date)
  const present = useQuery({ queryKey: attKey, queryFn: () => listAttendance(cls.id, date) })
  const [search, setSearch] = useState('')
  const [showAll, setShowAll] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const enrolledIds = useMemo(() => new Set((enrollments.data ?? []).filter((e) => ['activa', 'por_vencer'].includes(phaseOf(e))).map((e) => e.student_id)), [enrollments.data])
  const marks = useMemo(() => new Map((present.data ?? []).map((m) => [m.student_id, m])), [present.data])
  const pendingIds = useMemo(() => (present.data ?? []).filter((m) => !m.confirmed).map((m) => m.student_id), [present.data])
  const roster = useMemo(() => {
    const needle = normalize(search.trim())
    return (students.data ?? [])
      .filter((s) => s.active || marks.has(s.id))
      .filter((s) => showAll || needle || enrolledIds.has(s.id) || marks.has(s.id))
      .filter((s) => !needle || normalize(s.full_name ?? '').includes(needle))
  }, [students.data, enrolledIds, marks, search, showAll])

  type Action = 'mark' | 'confirm' | 'unmark'
  const toggle = useMutation({
    mutationFn: async ({ studentIds, action }: { studentIds: string[]; action: Action }) => {
      const base = () => supabase.from('attendance')
      const q = action === 'mark'
        ? base().insert(studentIds.map((student_id) => ({ school_id: schoolId, class_id: cls.id, student_id, date })))
        : action === 'confirm'
          ? base().update({ confirmed_at: new Date().toISOString() }).eq('class_id', cls.id).eq('date', date).in('student_id', studentIds)
          : base().delete().eq('class_id', cls.id).eq('date', date).in('student_id', studentIds)
      const { error } = await q
      if (error && !error.message.includes('duplicate key')) throw error
    },
    // Optimistic: flip immediately, roll back on error.
    onMutate: async ({ studentIds, action }) => {
      setError(null)
      await qc.cancelQueries({ queryKey: attKey })
      const prev = qc.getQueryData<Mark[]>(attKey) ?? []
      const ids = new Set(studentIds)
      const next = action === 'unmark'
        ? prev.filter((m) => !ids.has(m.student_id))
        : action === 'confirm'
          ? prev.map((m) => (ids.has(m.student_id) ? { ...m, confirmed: true } : m))
          : [...prev, ...studentIds.map((student_id) => ({ student_id, confirmed: true }))]
      qc.setQueryData<Mark[]>(attKey, next)
      return { prev }
    },
    onError: (_e, _v, ctx) => {
      if (ctx) qc.setQueryData(attKey, ctx.prev)
      setError('No se pudo guardar la asistencia. Revisa tu conexión e intenta de nuevo.')
    },
    onSettled: () => Promise.all([qc.invalidateQueries({ queryKey: attKey }), qc.invalidateQueries({ queryKey: ['attendance-range'] })]),
  })

  const count = marks.size
  const over = cls.capacity ? count > cls.capacity : false

  return (
    <div className="att-roster">
      <p className={`att-count${over ? ' is-over' : ''}`} aria-live="polite">
        <b>{count}</b> {count === 1 ? 'presente' : 'presentes'}{cls.capacity ? ` / ${cls.capacity}` : ''}
      </p>
      <div className="toolbar">
        <label className="search">
          <Icon name="search" size={16} />
          <span className="sr-only">Buscar alumno</span>
          <input className="input" type="search" placeholder="Buscar alumno para agregarlo" value={search} onChange={(e) => setSearch(e.target.value)} />
        </label>
        <Toggle inline checked={showAll} onChange={setShowAll} label="Todos los alumnos" />
      </div>
      {error && <p className="alert" role="alert">{error}</p>}
      {over && <p className="alert">Se superó el cupo de la clase.</p>}
      {pendingIds.length > 0 && (
        <div className="att-pending">
          <span>{pendingIds.length === 1 ? '1 alumno se marcó solo' : `${pendingIds.length} alumnos se marcaron solos`}. Confirma que vinieron.</span>
          <button type="button" className="btn" onClick={() => toggle.mutate({ studentIds: pendingIds, action: 'confirm' })}>Confirmar {pendingIds.length > 1 ? 'todos' : ''}</button>
        </div>
      )}
      {students.isSuccess && roster.length === 0 && (
        <p className="hint">
          {enrolledIds.size === 0 && !showAll ? 'No hay alumnos con inscripción vigente. Activa "Todos los alumnos" o búscalo por nombre para agregarlo.' : 'Sin resultados.'}
        </p>
      )}
      <ul className="att-list">
        {roster.map((s) => {
          const m = marks.get(s.id)
          const pending = Boolean(m && !m.confirmed)
          const action: Action = !m ? 'mark' : pending ? 'confirm' : 'unmark'
          return (
            <li key={s.id}>
              <button type="button" className={`att-student${pending ? ' is-pending' : ''}`} aria-pressed={Boolean(m)} onClick={() => toggle.mutate({ studentIds: [s.id], action })}>
                <span className="att-check" aria-hidden="true">{m && <Icon name="check" size={16} />}</span>
                <span className="att-student__name">{s.full_name}</span>
                {pending && <span className="tag tag--wait">Se marcó · toca para confirmar</span>}
                {!enrolledIds.has(s.id) && <span className="tag">Sin inscripción</span>}
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

// Skills and description of this session (this class on this date). Saved to its record only: other dates and the
// class itself don't change (edit the class in Clases for that). Admins edit; the rest of the team reads.
function SessionInfo({ session, onSaved }: { session: Session; onSaved: () => void }) {
  const { activeSchool, role } = useSchool()
  const schoolId = activeSchool!.id
  const canEdit = role === 'admin' || role === 'ceo'
  const qc = useQueryClient()
  const v = view(session)
  const tags = useQuery({ queryKey: ['tags', schoolId], queryFn: () => listTags(schoolId) })
  const [picked, setPicked] = useState<string[]>(v.skillIds)
  const [desc, setDesc] = useState(v.description ?? '')
  const [savedDesc, setSavedDesc] = useState(v.description ?? '')
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const refresh = () => qc.invalidateQueries({ queryKey: ['class-sessions', schoolId] })

  const setSkill = useMutation({
    mutationFn: (next: string[]) => saveSession(session, savedDesc.trim() || null, next),
    onMutate: (next) => { setMsg(null); const prev = picked; setPicked(next); return { prev } },
    onError: (_e, _n, ctx) => { if (ctx) setPicked(ctx.prev); setMsg({ ok: false, text: 'No se pudo guardar la skill.' }) },
    onSettled: refresh,
  })
  const saveDesc = useMutation({
    mutationFn: () => saveSession(session, desc.trim() || null, picked),
    onMutate: () => setMsg(null),
    // Like saving any form: back to the list of classes with a confirmation.
    onSuccess: async () => { setSavedDesc(desc); await refresh(); onSaved(); flash(`Descripción de "${v.name}" guardada.`) },
    onError: () => setMsg({ ok: false, text: 'No se pudo guardar la descripción.' }),
  })

  const shown = (tags.data ?? []).filter((t) => t.active || picked.includes(t.id))
  return (
    <>
      <section className="sess-section" aria-labelledby="sess-skills-h">
        <div className="sess-section__head">
          <h3 id="sess-skills-h">Skills</h3>
          {canEdit && (
            <CatalogoDialog
              label="Crear o editar skills"
              table="tags" schoolId={schoolId} withIcon
              title="Skills"
              description="Cada asistencia confirmada a una clase suma XP a sus skills."
              placeholder="Ej: Guardia, Derribos"
              onChange={() => qc.invalidateQueries({ queryKey: ['tags', schoolId] })}
            />
          )}
        </div>
        <p className="hint">Las skills que suben los alumnos que asistieron a esta clase. Se guardan solo para esta fecha.</p>
        {canEdit ? (
          shown.length ? (
            <div className="pick-chips" role="group" aria-label="Skills de la clase">
              {shown.map((t) => (
                <button key={t.id} type="button" className="pick-chip" aria-pressed={picked.includes(t.id)} disabled={setSkill.isPending}
                  onClick={() => setSkill.mutate(picked.includes(t.id) ? picked.filter((y) => y !== t.id) : [...picked, t.id])}>
                  {t.icon} {t.label}
                </button>
              ))}
            </div>
          ) : <p className="hint">Todavía no hay skills. Créalas con "Crear o editar skills".</p>
        ) : (
          <p>{shown.filter((t) => picked.includes(t.id)).map((t) => `${t.icon ?? ''} ${t.label}`.trim()).join(' · ') || 'Sin skills.'}</p>
        )}
      </section>

      <section className="sess-section" aria-labelledby="sess-desc-h">
        <h3 id="sess-desc-h">Descripción</h3>
        {canEdit ? (
          <>
            <textarea className="input" rows={3} maxLength={300} value={desc} onChange={(e) => { setDesc(e.target.value); setMsg(null) }} aria-labelledby="sess-desc-h" placeholder="Ej: Técnica base de jiu-jitsu para quienes recién empiezan." />
            <p className="hint">Solo para esta clase del {longDate(session.date).toLowerCase()}. La descripción general (la de la landing) se edita en Clases.</p>
            <div className="form-actions">
              <button type="button" className="btn" disabled={saveDesc.isPending || desc.trim() === savedDesc.trim()} onClick={() => saveDesc.mutate()}>{saveDesc.isPending ? 'Guardando…' : 'Guardar descripción'}</button>
            </div>
          </>
        ) : <p>{v.description || 'Sin descripción.'}</p>}
        {msg && <p className={`alert${msg.ok ? ' alert--ok' : ''}`} role={msg.ok ? 'status' : 'alert'}>{msg.text}</p>}
      </section>
    </>
  )
}
