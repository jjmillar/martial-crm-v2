import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useSchool } from '../../lib/school'
import { isValidSlug, slugify } from '../../lib/slug'
import { Icon } from '../../ui/Icon'
import './escuelas.css'

// CEO-only (S3): every school on the platform, plus creating new ones through the create_school RPC.
export function EscuelasPage() {
  const { schools, reload, setActiveSchool, activeSchool } = useSchool()
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [slugTouched, setSlugTouched] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [created, setCreated] = useState<string | null>(null)

  const effectiveSlug = slugTouched ? slug : slugify(name)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setCreated(null)
    if (!name.trim()) return setError('Escribe el nombre de la escuela.')
    if (!isValidSlug(effectiveSlug)) return setError('El identificador debe tener entre 3 y 48 caracteres: letras minúsculas, números y guiones.')

    setBusy(true)
    const { data, error: rpcError } = await supabase.rpc('create_school', { p_name: name.trim(), p_slug: effectiveSlug })
    setBusy(false)
    if (rpcError) {
      setError(rpcError.code === '23505' ? 'Ya existe una escuela con ese identificador.' : 'No se pudo crear la escuela. Intenta de nuevo.')
      return
    }
    await reload()
    setCreated(data?.name ?? name.trim())
    setName('')
    setSlug('')
    setSlugTouched(false)
  }

  function open(id: string) {
    setActiveSchool(id)
    navigate('/app/inicio')
  }

  return (
    <div className="escuelas">
      <header className="page-head">
        <span className="eyebrow">Plataforma</span>
        <h1>Escuelas</h1>
        <p className="hint">Como CEO ves todas las escuelas. Crea una nueva y luego invita a su administrador.</p>
      </header>

      <div className="escuelas__grid">
        <form className="card escuelas__form" onSubmit={onSubmit} noValidate>
          <h2>Nueva escuela</h2>
          <div className="field">
            <label htmlFor="school-name">Nombre</label>
            <input id="school-name" className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Academia Ejemplo" autoComplete="off" />
          </div>
          <div className="field">
            <label htmlFor="school-slug">Identificador</label>
            <input
              id="school-slug"
              className="input"
              value={effectiveSlug}
              onChange={(e) => { setSlugTouched(true); setSlug(e.target.value.toLowerCase()) }}
              placeholder="academia-ejemplo"
              autoComplete="off"
            />
            <span className="hint">Se usa en enlaces internos. Solo minúsculas, números y guiones.</span>
          </div>
          {error && <p className="alert" role="alert">{error}</p>}
          {created && <p className="alert alert--ok" role="status">Escuela “{created}” creada.</p>}
          <button className="btn" type="submit" disabled={busy}>
            <Icon name="plus" size={16} /> {busy ? 'Creando…' : 'Crear escuela'}
          </button>
        </form>

        <section className="escuelas__list" aria-label="Escuelas registradas">
          {schools.length === 0 && <p className="card hint">Aún no hay escuelas. Crea la primera.</p>}
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
      </div>
    </div>
  )
}
