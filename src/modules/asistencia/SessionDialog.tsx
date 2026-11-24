import { useMemo, useState } from 'react'
import { usePersisted } from '../../lib/persist'
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
import { attendanceKey, classStarted, incompleteKey, reviewAttendance, listAttendance, saveSession, setNotHeld, view, type Mark, type Session, type TrialBooking } from './api'

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
  const canMark = classStarted(date, session.start_time)
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
        {canMark
          ? <Roster cls={cls} date={date} />
          : <p className="hint">La asistencia se toma cuando empieza la clase: {date === today ? `hoy desde las ${hhmm(session.start_time)}` : `el ${longDate(date).toLowerCase()} desde las ${hhmm(session.start_time)}`}.</p>}
        {canMark && session.row && <NotHeld session={session} />}
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
  const [showAll, setShowAll] = usePersisted('asistencia.todosLosAlumnos', false)
  const [error, setError] = useState<string | null>(null)

  const enrolledIds = useMemo(() => new Set((enrollments.data ?? []).filter((e) => ['activa', 'por_vencer'].includes(phaseOf(e))).map((e) => e.student_id)), [enrollments.data])
  const marks = useMemo(() => new Map((present.data ?? []).map((m) => [m.student_id, m])), [present.data])
  const pendingIds = useMemo(() => (present.data ?? []).filter((m) => !m.confirmed).map((m) => m.student_id), [present.data])
  // Names of whoever marked or approved, for the record shown on each attendance.
  const staffIds = useMemo(() => [...new Set((present.data ?? []).map((m) => m.confirmed_by).filter(Boolean))] as string[], [present.data])
  const people = useQuery({
    queryKey: ['profiles-names', staffIds.join()],
    queryFn: async () => {
      const { data } = await supabase.from('profiles').select('id, full_name, email').in('id', staffIds)
      return new Map((data ?? []).map((p) => [p.id, p.full_name || p.email || 'el equipo']))
    },
    enabled: staffIds.length > 0,
  })
  const who = (id: string | null | undefined) => (id && people.data?.get(id)) || 'el equipo'
  const roster = useMemo(() => {
    const needle = normalize(search.trim())
    return (students.data ?? [])
      .filter((s) => s.active || marks.has(s.id))
      .filter((s) => showAll || needle || enrolledIds.has(s.id) || marks.has(s.id))
      .filter((s) => !needle || normalize(s.full_name ?? '').includes(needle))
  }, [students.data, enrolledIds, marks, search, showAll])

  type Action = 'mark' | 'confirm' | 'reject' | 'unmark'
  const idsOf = (studentIds: string[]) => (present.data ?? []).filter((m) => studentIds.includes(m.student_id) && m.id).map((m) => m.id!)
  const toggle = useMutation({
    mutationFn: async ({ studentIds, action }: { studentIds: string[]; action: Action }) => {
      if (action === 'confirm' || action === 'reject') return reviewAttendance(idsOf(studentIds), action === 'confirm')
      const base = () => supabase.from('attendance')
      const q = action === 'mark'
        ? base().insert(studentIds.map((student_id) => ({ school_id: schoolId, class_id: cls.id, student_id, date })))
        : base().delete().eq('class_id', cls.id).eq('date', date).in('student_id', studentIds)
      const { error } = await q
      if (error?.message.includes('class not started')) throw new Error('La clase aún no empieza: la asistencia se toma desde su hora de inicio.')
      if (error && !error.message.includes('duplicate key')) throw error
    },
    // Optimistic: flip immediately, roll back on error.
    onMutate: async ({ studentIds, action }) => {
      setError(null)
      await qc.cancelQueries({ queryKey: attKey })
      const prev = qc.getQueryData<Mark[]>(attKey) ?? []
      const ids = new Set(studentIds)
      const next = action === 'unmark' || action === 'reject'
        ? prev.filter((m) => !ids.has(m.student_id))
        : action === 'confirm'
          ? prev.map((m) => (ids.has(m.student_id) ? { ...m, confirmed: true } : m))
          : [...prev, ...studentIds.map((student_id) => ({ student_id, confirmed: true }))]
      qc.setQueryData<Mark[]>(attKey, next)
      return { prev }
    },
    onError: (e: Error, _v, ctx) => {
      if (ctx) qc.setQueryData(attKey, ctx.prev)
      setError(e.message.startsWith('La clase') ? e.message : 'No se pudo guardar la asistencia. Revisa tu conexión e intenta de nuevo.')
    },
    onSettled: () => Promise.all([qc.invalidateQueries({ queryKey: attKey }), qc.invalidateQueries({ queryKey: ['attendance-range'] }), qc.invalidateQueries({ queryKey: ['attendance-pending'] })]),
  })

  const count = marks.size - pendingIds.length
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
      {pendingIds.length > 1 && (
        <div className="att-pending">
          <span>{pendingIds.length === 1 ? '1 alumno marcó su asistencia' : `${pendingIds.length} alumnos marcaron su asistencia`}. Apruébala si vinieron.</span>
          <button type="button" className="btn" onClick={() => toggle.mutate({ studentIds: pendingIds, action: 'confirm' })}><Icon name="check" size={16} /> Aprobar todos</button>
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
          const record = m && !pending ? (m.self_marked ? `Marcó ${m.by_guardian ? 'el apoderado' : 'el alumno'} · aprobó ${who(m.confirmed_by)}` : `Marcó ${who(m.confirmed_by)}`) : null
          return (
            <li key={s.id}>
              {pending ? (
                <div className="att-student is-pending">
                  <span className="att-check" aria-hidden="true"><Icon name="clock" size={14} /></span>
                  <span className="att-student__name">{s.full_name}<span className="hint">Marcó su asistencia · por aprobar</span></span>
                  <span className="att-review">
                    <button type="button" className="btn" onClick={() => toggle.mutate({ studentIds: [s.id], action: 'confirm' })}>Aprobar</button>
                    <button type="button" className="btn btn--ghost" onClick={() => toggle.mutate({ studentIds: [s.id], action: 'reject' })}>Rechazar</button>
                  </span>
                </div>
              ) : (
                <button type="button" className="att-student" aria-pressed={Boolean(m)} onClick={() => toggle.mutate({ studentIds: [s.id], action: m ? 'unmark' : 'mark' })}>
                  <span className="att-check" aria-hidden="true">{m && <Icon name="check" size={16} />}</span>
                  <span className="att-student__name">{s.full_name}{record && <span className="hint">{record}</span>}</span>
                  {!enrolledIds.has(s.id) && <span className="tag">Sin inscripción</span>}
                </button>
              )}
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

// A class that did not take place (holiday, suspended): leaves "Clases sin asistencia" in Tareas. Can be undone.
function NotHeld({ session }: { session: Session }) {
  const { activeSchool } = useSchool()
  const qc = useQueryClient()
  const [value, setValue] = useState(Boolean(session.row?.not_held))
  const [error, setError] = useState<string | null>(null)
  const save = useMutation({
    mutationFn: (v: boolean) => setNotHeld(session.row!.id, v),
    onMutate: (v) => { setError(null); setValue(v) },
    onSuccess: () => Promise.all([
      qc.invalidateQueries({ queryKey: ['class-sessions', activeSchool?.id] }),
      qc.invalidateQueries({ queryKey: incompleteKey(activeSchool?.id) }),
    ]),
    onError: (e: Error, v) => { setValue(!v); setError(e.message) },
  })
  return (
    <>
      <Toggle checked={value} disabled={save.isPending} onChange={(v) => save.mutate(v)} label="La clase no se realizó" hint="Feriado o clase suspendida: deja de aparecer en Tareas como clase sin asistencia." />
      {error && <p className="alert" role="alert">{error}</p>}
    </>
  )
}
