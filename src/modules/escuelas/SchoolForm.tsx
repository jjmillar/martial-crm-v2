import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { isValidSlug, slugify } from '../../lib/slug'
import { Icon } from '../../ui/Icon'
import { listTemplates, templatesKey } from '../artes/api'
import { ArtsPicker } from '../artes/ArtsPicker'
import { applyPicks, ARTS_REQUIRED, initialPicks, picksOk, type ArtPick } from '../artes/picks'

type Props = {
  onCreated: (name: string) => void | Promise<void>
  /** Extra buttons next to submit (e.g. "Cancelar" inside the dialog). */
  actions?: ReactNode
  autoFocus?: boolean
}

// Create-school form, shared by the first-run card and the "+" dialog.
export function SchoolForm({ onCreated, actions, autoFocus }: Props) {
  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [slugTouched, setSlugTouched] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // Required: the martial arts it teaches (their belts and degrees are copied to the new school).
  const templates = useQuery({ queryKey: templatesKey, queryFn: listTemplates, staleTime: Infinity })
  const [picks, setPicks] = useState<ArtPick[] | null>(null)
  const [artsInvalid, setArtsInvalid] = useState(false)
  useEffect(() => { if (picks === null && templates.data) setPicks(initialPicks([], templates.data)) }, [picks, templates.data])

  const effectiveSlug = slugTouched ? slug : slugify(name)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    if (!name.trim()) return setError('Escribe el nombre de la escuela.')
    if (!isValidSlug(effectiveSlug)) return setError('El identificador debe tener entre 3 y 48 caracteres: letras minúsculas, números y guiones.')
    if (!picks) return setError('Espera a que carguen las artes marciales.')
    if (!picksOk(picks)) { setArtsInvalid(true); return setError(ARTS_REQUIRED) }

    setBusy(true)
    const { data, error: rpcError } = await supabase.rpc('create_school', { p_name: name.trim(), p_slug: effectiveSlug })
    if (rpcError || !data) {
      setBusy(false)
      setError(rpcError?.code === '23505' ? 'Ya existe una escuela con ese identificador.' : 'No se pudo crear la escuela. Intenta de nuevo.')
      return
    }
    // If this fails the school still exists: Datos de la escuela asks for the arts until it has one.
    await applyPicks(data.id, picks, []).catch(() => undefined)
    setBusy(false)
    const created = data.name ?? name.trim()
    setName('')
    setSlug('')
    setSlugTouched(false)
    setPicks(null)
    await onCreated(created)
  }

  return (
    <form className="escuelas__form" onSubmit={onSubmit} noValidate>
      <div className="field">
        <label htmlFor="school-name">Nombre</label>
        <input id="school-name" className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Academia Ejemplo" autoComplete="off" autoFocus={autoFocus} />
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
      {picks ? <ArtsPicker picks={picks} invalid={artsInvalid} idPrefix="new-school-arts" onChange={(p) => { setPicks(p); setArtsInvalid(false); setError(null) }} />
        : templates.isError ? <p className="alert">No se pudieron cargar las artes marciales.</p> : <p className="hint">Cargando artes marciales…</p>}
      {error && <p className="alert" role="alert">{error}</p>}
      <div className="escuelas__actions">
        <button className="btn" type="submit" disabled={busy}>
          <Icon name="plus" size={16} /> {busy ? 'Creando…' : 'Crear escuela'}
        </button>
        {actions}
      </div>
    </form>
  )
}
