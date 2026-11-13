import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { useSchool } from '../../lib/school'
import { Icon, type IconName } from '../../ui/Icon'
import { EscuelaPerfil } from '../ajustes/EscuelaPerfil'
import { SchoolForm } from './SchoolForm'
import '../ajustes/ajustes.css'
import './escuelas.css'

type Stats = { school_id: string; students_active: number; teachers_active: number; classes_active: number; members: number; attendance_30d: number }

async function schoolStats(): Promise<Record<string, Stats>> {
  const { data, error } = await supabase.rpc('school_stats')
  if (error) throw error
  return Object.fromEntries((data ?? []).map((r) => [r.school_id, r]))
}

// CEO-only (S3): every school on the platform as cards with key numbers; tapping one opens its settings
// (same component as Ajustes) in a pop-up. With no schools the create form is the page; afterwards "+".
export function EscuelasPage() {
  const { schools, reload, setActiveSchool, activeSchool, loading } = useSchool()
  const navigate = useNavigate()
  const createRef = useRef<HTMLDialogElement>(null)
  const editRef = useRef<HTMLDialogElement>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [editing, setEditing] = useState<string | null>(null)
  const [created, setCreated] = useState<string | null>(null)
  const stats = useQuery({ queryKey: ['school-stats', schools.length], queryFn: schoolStats, enabled: schools.length > 0 })

  async function onCreated(name: string) {
    await reload()
    setCreated(name)
    createRef.current?.close()
  }

  function openCreate() {
    setCreated(null)
    setCreateOpen(true)
    createRef.current?.showModal()
  }

  function openEdit(id: string) {
    setEditing(id)
    editRef.current?.showModal()
  }

  function enter(id: string) {
    setActiveSchool(id)
    editRef.current?.close()
    navigate('/app/inicio')
  }

  if (loading) return <p className="hint">Cargando…</p>

  if (schools.length === 0) {
    return (
      <div className="escuelas">
        <header className="page-head">
          <span className="eyebrow">Plataforma</span>
          <h1>Escuelas</h1>
          <p className="hint">Como CEO ves todas las escuelas. Crea la primera y luego invita a su administrador.</p>
        </header>
        <section className="card escuelas__first">
          <h2>Nueva escuela</h2>
          <SchoolForm onCreated={onCreated} />
        </section>
      </div>
    )
  }

  const editingSchool = schools.find((s) => s.id === editing) ?? null

  return (
    <div className="escuelas">
      <header className="page-head page-head--row">
        <div>
          <span className="eyebrow">Plataforma</span>
          <h1>Escuelas</h1>
          <p className="hint">{schools.length} {schools.length === 1 ? 'escuela' : 'escuelas'} en la plataforma. Toca una para ver y editar sus datos.</p>
        </div>
        <button type="button" className="fab" onClick={openCreate} aria-label="Nueva escuela" title="Nueva escuela">
          <Icon name="plus" size={22} />
        </button>
      </header>

      {created && <p className="alert alert--ok" role="status">Escuela “{created}” creada. Ábrela e invita a su administrador desde Miembros.</p>}

      <section className="school-grid" aria-label="Escuelas registradas">
        {schools.map((s) => {
          const st = stats.data?.[s.id]
          const facts: { icon: IconName; value: number | undefined; label: string }[] = [
            { icon: 'users', value: st?.students_active, label: 'alumnos activos' },
            { icon: 'teacher', value: st?.teachers_active, label: 'profesores' },
            { icon: 'clock', value: st?.classes_active, label: 'clases activas' },
            { icon: 'check', value: st?.attendance_30d, label: 'asistencias en 30 días' },
          ]
          return (
            <button key={s.id} type="button" className="card school-card" onClick={() => openEdit(s.id)} aria-label={`${s.name}: ver y editar`}>
              <span className="school-card__top">
                <span className="logo-box school-card__logo">
                  {s.logo_url ? <img src={s.logo_url} alt="" /> : <span aria-hidden="true">{s.name.slice(0, 2).toUpperCase()}</span>}
                </span>
                {activeSchool?.id === s.id && <span className="school-card__active">Activa</span>}
              </span>
              <span className="school-card__name">{s.name}</span>
              <span className="hint school-card__place">
                <Icon name="pin" size={14} /> {s.city || 'Sin ciudad'}
              </span>
              <span className="school-card__facts">
                {facts.map((f) => (
                  <span key={f.label} className="school-card__fact" title={`${f.value ?? '—'} ${f.label}`}>
                    <Icon name={f.icon} size={16} />
                    <strong>{f.value ?? '—'}</strong>
                    <span className="sr-only">{f.label}</span>
                  </span>
                ))}
              </span>
            </button>
          )
        })}
      </section>

      <dialog
        ref={createRef}
        className="modal"
        aria-labelledby="new-school-h"
        onClose={() => setCreateOpen(false)}
        onClick={(e) => { if (e.target === e.currentTarget) createRef.current?.close() }}
      >
        <div className="modal__body">
          <h2 id="new-school-h">Nueva escuela</h2>
          {/* Remount on every open so the form starts empty */}
          {createOpen && (
            <SchoolForm
              onCreated={onCreated}
              autoFocus
              actions={<button type="button" className="btn btn--ghost" onClick={() => createRef.current?.close()}>Cancelar</button>}
            />
          )}
        </div>
      </dialog>

      <dialog
        ref={editRef}
        className="modal modal--wide"
        aria-label={editingSchool ? `Ajustes de ${editingSchool.name}` : 'Ajustes de la escuela'}
        onClose={() => setEditing(null)}
        onClick={(e) => { if (e.target === e.currentTarget) editRef.current?.close() }}
      >
        {editingSchool && (
          <div className="modal__body">
            <div className="modal__head">
              <span className="eyebrow">Ajustes de la escuela</span>
              <button type="button" className="icon-btn" onClick={() => editRef.current?.close()} aria-label="Cerrar"><Icon name="close" /></button>
            </div>
            <EscuelaPerfil key={editingSchool.id} school={editingSchool} embedded />
            {activeSchool?.id !== editingSchool.id && (
              <button type="button" className="btn btn--ghost" onClick={() => enter(editingSchool.id)}>
                Entrar a esta escuela <Icon name="arrow" size={16} />
              </button>
            )}
          </div>
        )}
      </dialog>
    </div>
  )
}
