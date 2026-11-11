import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useSchool } from '../../lib/school'
import { Icon } from '../../ui/Icon'
import { SchoolForm } from './SchoolForm'
import './escuelas.css'

// CEO-only (S3): every school on the platform, plus creating new ones through the create_school RPC.
// UX: with no schools the create form is the page; afterwards it lives behind a round "+" button (dialog).
export function EscuelasPage() {
  const { schools, reload, setActiveSchool, activeSchool, loading } = useSchool()
  const navigate = useNavigate()
  const dialogRef = useRef<HTMLDialogElement>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [created, setCreated] = useState<string | null>(null)

  async function onCreated(name: string) {
    await reload()
    setCreated(name)
    dialogRef.current?.close()
  }

  function openDialog() {
    setCreated(null)
    setDialogOpen(true)
    dialogRef.current?.showModal()
  }

  function open(id: string) {
    setActiveSchool(id)
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

  return (
    <div className="escuelas">
      <header className="page-head page-head--row">
        <div>
          <span className="eyebrow">Plataforma</span>
          <h1>Escuelas</h1>
          <p className="hint">{schools.length} {schools.length === 1 ? 'escuela' : 'escuelas'} en la plataforma.</p>
        </div>
        <button type="button" className="fab" onClick={openDialog} aria-label="Nueva escuela" title="Nueva escuela">
          <Icon name="plus" size={22} />
        </button>
      </header>

      {created && <p className="alert alert--ok" role="status">Escuela “{created}” creada. Ábrela e invita a su administrador desde Miembros.</p>}

      <section className="escuelas__list" aria-label="Escuelas registradas">
        {schools.map((s) => (
          <article key={s.id} className="card school-row">
            <div>
              <h3>{s.name}</h3>
              <p className="hint">{s.slug}{s.city ? ` · ${s.city}` : ''}</p>
            </div>
            {activeSchool?.id === s.id
              ? <span className="school-row__active">Activa</span>
              : <button className="btn btn--ghost" type="button" onClick={() => open(s.id)}>Abrir</button>}
          </article>
        ))}
      </section>

      <dialog
        ref={dialogRef}
        className="modal"
        aria-labelledby="new-school-h"
        onClose={() => setDialogOpen(false)}
        onClick={(e) => { if (e.target === e.currentTarget) dialogRef.current?.close() }}
      >
        <div className="modal__body">
          <h2 id="new-school-h">Nueva escuela</h2>
          {/* Remount on every open so the form starts empty */}
          {dialogOpen && (
            <SchoolForm
              onCreated={onCreated}
              autoFocus
              actions={<button type="button" className="btn btn--ghost" onClick={() => dialogRef.current?.close()}>Cancelar</button>}
            />
          )}
        </div>
      </dialog>
    </div>
  )
}
