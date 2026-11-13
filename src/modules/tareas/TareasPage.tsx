import { useState, type DragEvent, type FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { useSchool } from '../../lib/school'
import { formatDate, santiagoDate } from '../../lib/dates'
import { Icon } from '../../ui/Icon'
import { Aprobaciones } from './Aprobaciones'
import { columns, listTasks, tasksKey, type Task, type TaskStatus } from './api'
import './tareas.css'

const DONE_SHOWN = 20
const nowPos = () => Date.now() / 1000

// Tareas: one place for approvals (CEO), automatic notices (trial class bookings) and the team's own tasks.
// Simple fixed board: move tasks between columns and edit them; the columns themselves are not editable.
export function TareasPage() {
  const { activeSchool, role } = useSchool()
  return (
    <div className="tareas">
      <header className="page-head">
        <span className="eyebrow">{activeSchool?.name ?? 'Tareas'}</span>
        <h1>Tareas</h1>
        <p className="hint">Aprobaciones, clases de prueba agendadas y las tareas del equipo, en un solo lugar.</p>
      </header>
      {role === 'ceo' && <Aprobaciones />}
      {activeSchool ? <Board schoolId={activeSchool.id} /> : <p className="hint">Selecciona una escuela para ver sus tareas.</p>}
    </div>
  )
}

function Board({ schoolId }: { schoolId: string }) {
  const qc = useQueryClient()
  const key = tasksKey(schoolId)
  const q = useQuery({ queryKey: key, queryFn: () => listTasks(schoolId) })
  const [title, setTitle] = useState('')
  const [editing, setEditing] = useState<string | null>(null)
  const [dragOver, setDragOver] = useState<TaskStatus | null>(null)
  const [error, setError] = useState<string | null>(null)

  const patchCache = (id: string, patch: Partial<Task>) =>
    qc.setQueryData<Task[]>(key, (old) => old?.map((t) => (t.id === id ? { ...t, ...patch } : t)).sort((a, b) => b.position - a.position))

  const create = useMutation({
    mutationFn: async (t: string) => {
      const { error } = await supabase.from('tasks').insert({ school_id: schoolId, title: t })
      if (error) throw new Error('No se pudo crear la tarea.')
    },
    onMutate: () => setError(null),
    onSuccess: () => setTitle(''),
    onError: (e: Error) => setError(e.message),
    onSettled: () => qc.invalidateQueries({ queryKey: key }),
  })

  const move = useMutation({
    mutationFn: async ({ t, status }: { t: Task; status: TaskStatus }) => {
      const position = nowPos()
      patchCache(t.id, { status, position })
      const { error } = await supabase.from('tasks').update({ status, position }).eq('id', t.id)
      if (error) throw new Error('No se pudo mover la tarea.')
    },
    onMutate: () => setError(null),
    onError: (e: Error) => setError(e.message),
    onSettled: () => qc.invalidateQueries({ queryKey: key }),
  })

  const tasks = q.data ?? []
  const onDrop = (status: TaskStatus) => (e: DragEvent) => {
    e.preventDefault()
    setDragOver(null)
    const t = tasks.find((x) => x.id === e.dataTransfer.getData('text/plain'))
    if (t && t.status !== status) move.mutate({ t, status })
  }
  const onNew = (e: FormEvent) => { e.preventDefault(); if (title.trim()) create.mutate(title.trim()) }

  return (
    <section className="tareas__board-wrap" aria-label="Tablero de tareas">
      <form className="tareas__new" onSubmit={onNew}>
        <input className="input" aria-label="Nueva tarea" placeholder="Nueva tarea… (ej: llamar al apoderado de Ana)" maxLength={140} value={title} onChange={(e) => setTitle(e.target.value)} />
        <button className="btn" type="submit" disabled={create.isPending || !title.trim()}><Icon name="plus" size={16} /> Agregar</button>
      </form>
      {error && <p className="alert" role="alert">{error}</p>}
      {q.isLoading && <p className="hint">Cargando…</p>}
      {q.isError && <p className="alert">No se pudieron cargar las tareas.</p>}

      <div className="board">
        {columns.map((col, ci) => {
          const all = tasks.filter((t) => t.status === col.id)
          const shown = col.id === 'hecho' ? all.slice(0, DONE_SHOWN) : all
          return (
            <div
              key={col.id}
              className={`board__col board__col--${col.id}${dragOver === col.id ? ' is-over' : ''}`}
              onDragOver={(e) => { e.preventDefault(); setDragOver(col.id) }}
              onDragLeave={() => setDragOver((c) => (c === col.id ? null : c))}
              onDrop={onDrop(col.id)}
            >
              <h2 className="board__head">{col.label} <span className="board__count">{all.length}</span></h2>
              {shown.length === 0 && <p className="board__empty hint">{col.id === 'por_hacer' ? 'Nada por hacer.' : col.id === 'en_curso' ? 'Mueve aquí lo que estás haciendo.' : 'Aún no hay tareas terminadas.'}</p>}
              <ul className="board__list">
                {shown.map((t) => (
                  <TaskCard
                    key={t.id}
                    t={t}
                    open={editing === t.id}
                    onToggle={() => setEditing((x) => (x === t.id ? null : t.id))}
                    onClose={() => setEditing(null)}
                    prev={columns[ci - 1]}
                    next={columns[ci + 1]}
                    onMove={(status) => move.mutate({ t, status })}
                    busy={move.isPending}
                  />
                ))}
              </ul>
              {all.length > shown.length && <p className="hint board__more">Se muestran las {DONE_SHOWN} más recientes.</p>}
            </div>
          )
        })}
      </div>
    </section>
  )
}

type CardProps = {
  t: Task; open: boolean; busy: boolean; onToggle: () => void; onClose: () => void
  prev?: { id: TaskStatus; label: string }; next?: { id: TaskStatus; label: string }; onMove: (s: TaskStatus) => void
}

function TaskCard({ t, open, busy, onToggle, onClose, prev, next, onMove }: CardProps) {
  return (
    <li
      className={`task card${t.kind !== 'manual' ? ' task--auto' : ''}${open ? ' is-open' : ''}`}
      draggable={!open}
      onDragStart={(e) => { e.dataTransfer.setData('text/plain', t.id); e.dataTransfer.effectAllowed = 'move' }}
    >
      {open ? <TaskEditor t={t} onClose={onClose} /> : (
        <>
          <button type="button" className="task__main" onClick={onToggle} aria-label={`Editar: ${t.title}`}>
            {t.kind === 'clase_prueba' && <span className="tag tag--accent task__kind">Clase de prueba</span>}
            <strong className="task__title">{t.title}</strong>
            {t.notes && <span className="task__notes">{t.notes}</span>}
            <span className="task__date">{formatDate(santiagoDate(t.created_at))}</span>
          </button>
          <div className="task__moves">
            {prev ? <button type="button" className="task__move" disabled={busy} onClick={() => onMove(prev.id)} aria-label={`Mover a ${prev.label}`}><Icon name="back" size={16} /> <span>{prev.label}</span></button> : <span />}
            {next && <button type="button" className="task__move task__move--next" disabled={busy} onClick={() => onMove(next.id)} aria-label={`Mover a ${next.label}`}><span>{next.label}</span> <Icon name="arrow" size={16} /></button>}
          </div>
        </>
      )}
    </li>
  )
}

function TaskEditor({ t, onClose }: { t: Task; onClose: () => void }) {
  const qc = useQueryClient()
  const key = tasksKey(t.school_id)
  const [title, setTitle] = useState(t.title)
  const [notes, setNotes] = useState(t.notes ?? '')
  const [error, setError] = useState<string | null>(null)
  const save = useMutation({
    mutationFn: async () => {
      if (!title.trim()) throw new Error('La tarea necesita un título.')
      const { error } = await supabase.from('tasks').update({ title: title.trim(), notes: notes.trim() || null }).eq('id', t.id)
      if (error) throw new Error('No se pudo guardar.')
    },
    onSuccess: async () => { await qc.invalidateQueries({ queryKey: key }); onClose() },
    onError: (e: Error) => setError(e.message),
  })
  const remove = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('tasks').delete().eq('id', t.id)
      if (error) throw new Error('No se pudo eliminar.')
    },
    onSuccess: async () => { await qc.invalidateQueries({ queryKey: key }); onClose() },
    onError: (e: Error) => setError(e.message),
  })
  const phone = t.kind === 'clase_prueba' ? t.notes?.match(/Teléfono: (.+)/)?.[1] : undefined

  return (
    <form className="task__edit" onSubmit={(e) => { e.preventDefault(); save.mutate() }}>
      <label className="sr-only" htmlFor={`tt-${t.id}`}>Título</label>
      <input id={`tt-${t.id}`} className="input" value={title} maxLength={140} onChange={(e) => setTitle(e.target.value)} autoFocus />
      <label className="sr-only" htmlFor={`tn-${t.id}`}>Notas</label>
      <textarea id={`tn-${t.id}`} className="input" rows={4} maxLength={2000} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notas" />
      {phone && (
        <div className="task__contact">
          <a className="btn btn--ghost btn--sm" href={`tel:${phone.replace(/\s/g, '')}`}><Icon name="phone" size={14} /> Llamar</a>
          <a className="btn btn--ghost btn--sm" href={`https://wa.me/${phone.replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer"><Icon name="chat" size={14} /> WhatsApp</a>
        </div>
      )}
      {error && <p className="alert" role="alert">{error}</p>}
      <div className="task__edit-actions">
        <button type="submit" className="btn btn--sm" disabled={save.isPending}>Guardar</button>
        <button type="button" className="btn btn--ghost btn--sm" onClick={onClose}>Cerrar</button>
        <button type="button" className="icon-btn task__delete" aria-label="Eliminar tarea" disabled={remove.isPending} onClick={() => { if (confirm('¿Eliminar esta tarea?')) remove.mutate() }}><Icon name="trash" size={16} /></button>
      </div>
    </form>
  )
}
