import { useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useSchool } from '../../lib/school'
import { hhmm, weekdays } from '../../lib/weekdays'
import type { ClassLevel } from '../../lib/database.types'
import { Icon } from '../../ui/Icon'
import { listSpecialties, listTeachers, specialtiesKey, teachersKey } from '../profesores/api'
import { classColors, classesKey, deleteClass, getClass, levelLabel, listTags, saveClass, type Block, type ClassFull } from './api'

/** /clases/nueva and /clases/:id */
export function ClaseEditor() {
  const { id } = useParams()
  const isNew = !id || id === 'nueva'
  const q = useQuery({ queryKey: ['class', id], queryFn: () => getClass(id!), enabled: !isNew })
  if (isNew) return <ClaseForm key="new" />
  if (q.isLoading) return <p className="hint">Cargando…</p>
  if (!q.data) return <p className="alert">No encontramos esa clase. <Link to="..">Volver</Link></p>
  return <ClaseForm key={q.data.id} c={q.data} />
}

type Row = Block & { key: number }
let rowKey = 0
const toRow = (b: Block): Row => ({ ...b, key: ++rowKey })

function ClaseForm({ c }: { c?: ClassFull }) {
  const { activeSchool, role } = useSchool()
  const schoolId = activeSchool?.id
  const canEdit = role === 'admin' || role === 'ceo'
  const navigate = useNavigate()
  const qc = useQueryClient()
  const teachers = useQuery({ queryKey: teachersKey(schoolId), queryFn: () => listTeachers(schoolId!), enabled: Boolean(schoolId) })
  const specialties = useQuery({ queryKey: specialtiesKey(schoolId), queryFn: () => listSpecialties(schoolId!), enabled: Boolean(schoolId) })
  const tags = useQuery({ queryKey: ['tags', schoolId], queryFn: () => listTags(schoolId!), enabled: Boolean(schoolId) })

  const [name, setName] = useState(c?.name ?? '')
  const [specialtyId, setSpecialtyId] = useState(c?.specialty_id ?? '')
  const [teacherId, setTeacherId] = useState(c?.teacher_id ?? '')
  const [level, setLevel] = useState<ClassLevel>(c?.level ?? 'todos')
  const [room, setRoom] = useState(c?.room ?? '')
  const [capacity, setCapacity] = useState(c?.capacity?.toString() ?? '')
  const [color, setColor] = useState(c?.color ?? classColors[0])
  const [notes, setNotes] = useState(c?.notes ?? '')
  const [active, setActive] = useState(c?.active ?? true)
  const [tagIds, setTagIds] = useState<string[]>(c?.tag_ids ?? [])
  const [rows, setRows] = useState<Row[]>(() =>
    c ? c.schedules.map((s) => toRow({ weekday: s.weekday, start_time: hhmm(s.start_time), end_time: hhmm(s.end_time) })) : [toRow({ weekday: 1, start_time: '19:00', end_time: '20:30' })],
  )
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const touch = () => { setSaved(false); setError(null) }
  const setRow = (key: number, patch: Partial<Block>) => { setRows((r) => r.map((x) => (x.key === key ? { ...x, ...patch } : x))); touch() }
  const addRow = () => {
    const last = rows[rows.length - 1]
    setRows((r) => [...r, toRow(last ? { ...last, weekday: (last.weekday % 7) + 1 } : { weekday: 1, start_time: '19:00', end_time: '20:30' })])
    touch()
  }

  const save = useMutation({
    mutationFn: () => {
      if (!name.trim()) throw new Error('Escribe el nombre de la clase.')
      const cap = capacity.trim() ? Number(capacity) : null
      if (cap !== null && (!Number.isInteger(cap) || cap < 1 || cap > 500)) throw new Error('El cupo debe ser un número entre 1 y 500.')
      for (const r of rows) if (!r.start_time || !r.end_time || r.end_time <= r.start_time) throw new Error('Cada horario debe terminar después de empezar.')
      return saveClass(
        schoolId!, c?.id ?? null,
        { name: name.trim(), specialty_id: specialtyId || null, teacher_id: teacherId || null, room: room.trim() || null, capacity: cap, level, color, notes: notes.trim() || null, active },
        tagIds, rows.map(({ weekday, start_time, end_time }) => ({ weekday, start_time, end_time })),
      )
    },
    onSuccess: async (saved) => {
      await qc.invalidateQueries({ queryKey: classesKey(schoolId) })
      await qc.invalidateQueries({ queryKey: ['class', saved.id] })
      if (c) setSaved(true)
      else navigate('..', { replace: true, state: { flash: `Clase "${saved.name}" creada.` } })
    },
    onError: (e: Error) => setError(e.message),
  })

  const remove = useMutation({
    mutationFn: () => deleteClass(c!.id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: classesKey(schoolId) }); navigate('..', { replace: true }) },
    onError: (e: Error) => { setConfirmDelete(false); setError(e.message) },
  })

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    save.mutate()
  }

  if (!activeSchool) return <p className="page-note">Selecciona una escuela.</p>

  return (
    <form className="alumno-form" onSubmit={onSubmit} noValidate>
      <header className="page-head">
        <Link className="link-btn back-link" to=".."><Icon name="back" size={16} /> Clases</Link>
        <h1>{c ? c.name : 'Nueva clase'}</h1>
        {!canEdit && <p className="hint">Solo lectura: los administradores editan las clases.</p>}
      </header>

      <fieldset className="form-fieldset" disabled={!canEdit}>
        <section className="card form-section">
          <h2>Clase</h2>
          <div className="form-grid">
            <div className="field">
              <label htmlFor="c-name">Nombre *</label>
              <input id="c-name" className="input" maxLength={80} value={name} onChange={(e) => { setName(e.target.value); touch() }} placeholder="Ej: BJJ Fundamentos" autoComplete="off" />
            </div>
            <div className="field">
              <label htmlFor="c-sp">Disciplina</label>
              <select id="c-sp" className="input" value={specialtyId} onChange={(e) => { setSpecialtyId(e.target.value); touch() }}>
                <option value="">Sin especificar</option>
                {(specialties.data ?? []).filter((s) => s.active || s.id === specialtyId).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div className="field">
              <label htmlFor="c-teacher">Profesor</label>
              <select id="c-teacher" className="input" value={teacherId} onChange={(e) => { setTeacherId(e.target.value); touch() }}>
                <option value="">Sin profesor asignado</option>
                {(teachers.data ?? []).filter((t) => t.active || t.id === teacherId).map((t) => <option key={t.id} value={t.id}>{t.full_name}</option>)}
              </select>
            </div>
            <div className="field">
              <label htmlFor="c-level">Nivel</label>
              <select id="c-level" className="input" value={level} onChange={(e) => { setLevel(e.target.value as ClassLevel); touch() }}>
                {(Object.keys(levelLabel) as ClassLevel[]).map((l) => <option key={l} value={l}>{levelLabel[l]}</option>)}
              </select>
            </div>
            <div className="field">
              <label htmlFor="c-room">Sala</label>
              <input id="c-room" className="input" maxLength={60} value={room} onChange={(e) => { setRoom(e.target.value); touch() }} placeholder="Ej: Tatami 1" />
            </div>
            <div className="field">
              <label htmlFor="c-cap">Cupo</label>
              <input id="c-cap" className="input" inputMode="numeric" value={capacity} onChange={(e) => { setCapacity(e.target.value); touch() }} placeholder="Sin límite" />
            </div>
          </div>
          <div className="field">
            <span className="field__label" id="color-label">Color en el calendario</span>
            <div className="swatches" role="radiogroup" aria-labelledby="color-label">
              {classColors.map((col) => (
                <button key={col} type="button" role="radio" aria-checked={color === col} aria-label={col} className="swatch" style={{ background: col }} onClick={() => { setColor(col); touch() }} />
              ))}
            </div>
          </div>
        </section>

        <section className="card form-section">
          <div className="ajustes__section-head">
            <h2>Horarios semanales</h2>
            {canEdit && <button type="button" className="btn btn--ghost" onClick={addRow}><Icon name="plus" size={16} /> Agregar horario</button>}
          </div>
          {rows.length === 0 && <p className="hint">Sin horarios: la clase no aparecerá en el calendario.</p>}
          <ul className="blocks">
            {rows.map((r, i) => (
              <li key={r.key} className="block-row">
                <select className="input" aria-label={`Día del horario ${i + 1}`} value={r.weekday} onChange={(e) => setRow(r.key, { weekday: Number(e.target.value) })}>
                  {weekdays.map((w) => <option key={w.n} value={w.n}>{w.long}</option>)}
                </select>
                <input className="input" type="time" aria-label={`Inicio del horario ${i + 1}`} value={r.start_time} onChange={(e) => setRow(r.key, { start_time: e.target.value })} />
                <input className="input" type="time" aria-label={`Término del horario ${i + 1}`} value={r.end_time} onChange={(e) => setRow(r.key, { end_time: e.target.value })} />
                {canEdit && (
                  <button type="button" className="icon-btn" aria-label={`Quitar horario ${i + 1}`} onClick={() => { setRows((x) => x.filter((y) => y.key !== r.key)); touch() }}>
                    <Icon name="close" size={16} />
                  </button>
                )}
              </li>
            ))}
          </ul>
        </section>

        <section className="card form-section">
          <h2>Etiquetas y notas</h2>
          <p className="hint">Las etiquetas son las <b>skills</b> que suben los alumnos al asistir a esta clase. {canEdit && <Link to="/app/ajustes#catalogos">Crear o editar etiquetas</Link>}</p>
          {tags.data?.length ? (
            <div className="pick-chips" role="group" aria-label="Etiquetas">
              {tags.data.filter((t) => t.active || tagIds.includes(t.id)).map((t) => (
                <button key={t.id} type="button" className="pick-chip" aria-pressed={tagIds.includes(t.id)} onClick={() => { setTagIds((x) => (x.includes(t.id) ? x.filter((y) => y !== t.id) : [...x, t.id])); touch() }}>
                  {t.icon} {t.label}
                </button>
              ))}
            </div>
          ) : <p className="hint">Sin etiquetas todavía.</p>}
          <div className="field">
            <label htmlFor="c-notes">Notas</label>
            <textarea id="c-notes" className="input" rows={2} maxLength={400} value={notes} onChange={(e) => { setNotes(e.target.value); touch() }} placeholder="Ej: traer gi, protector bucal" />
          </div>
          <label className="switch">
            <input type="checkbox" checked={active} onChange={(e) => { setActive(e.target.checked); touch() }} />
            <span><strong>Clase activa</strong><span className="hint">Las inactivas no aparecen en el calendario ni en asistencia.</span></span>
          </label>
        </section>
      </fieldset>

      {error && <p className="alert" role="alert">{error}</p>}
      {saved && <p className="alert alert--ok" role="status">Cambios guardados.</p>}

      {canEdit && (
        <div className="form-actions">
          <button className="btn" type="submit" disabled={save.isPending}>{save.isPending ? 'Guardando…' : c ? 'Guardar cambios' : 'Crear clase'}</button>
          <Link className="btn btn--ghost" to="..">Cancelar</Link>
          {c && (
            <span className="form-actions__danger">
              {confirmDelete ? (
                <>
                  <span className="hint">¿Eliminar la clase y sus horarios?</span>
                  <button type="button" className="btn btn--danger" onClick={() => remove.mutate()}>Eliminar</button>
                  <button type="button" className="btn btn--ghost" onClick={() => setConfirmDelete(false)}>No</button>
                </>
              ) : (
                <button type="button" className="btn btn--ghost" onClick={() => setConfirmDelete(true)}><Icon name="trash" size={16} /> Eliminar</button>
              )}
            </span>
          )}
        </div>
      )}
    </form>
  )
}
