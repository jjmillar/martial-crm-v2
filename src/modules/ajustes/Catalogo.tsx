import { useState, type FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { Icon } from '../../ui/Icon'

// One component for every simple per-school catalog (S6): specialties, tags, and later belts, rooms, disciplines...
type CatalogTable = 'specialties' | 'tags'
type Item = { id: string; text: string; icon: string | null; active: boolean }

const textCol = { specialties: 'name', tags: 'label' } as const

async function listItems(table: CatalogTable, schoolId: string): Promise<Item[]> {
  const { data, error } = await supabase.from(table).select('*').eq('school_id', schoolId).order(textCol[table])
  if (error) throw error
  return data.map((r) => ({
    id: r.id,
    text: 'label' in r ? r.label : r.name,
    icon: 'icon' in r ? r.icon : null,
    active: r.active,
  }))
}

function friendly(message: string): string {
  if (message.includes('duplicate key')) return 'Ya existe con ese nombre.'
  if (message.includes('row-level security')) return 'Solo los administradores pueden editar catálogos.'
  return 'No se pudo guardar.'
}

type Props = { table: CatalogTable; schoolId: string; title: string; description: string; placeholder: string; withIcon?: boolean; canEdit: boolean }

export function Catalogo({ table, schoolId, title, description, placeholder, withIcon = false, canEdit }: Props) {
  const qc = useQueryClient()
  const key = ['catalog', table, schoolId]
  const items = useQuery({ queryKey: key, queryFn: () => listItems(table, schoolId) })
  const [text, setText] = useState('')
  const [icon, setIcon] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [editing, setEditing] = useState<{ id: string; text: string; icon: string } | null>(null)
  const done = () => qc.invalidateQueries({ queryKey: key })
  const fail = (e: Error) => setError(e.message)

  const add = useMutation({
    mutationFn: async () => {
      const row = table === 'tags' ? { school_id: schoolId, label: text.trim(), icon: icon.trim() || null } : { school_id: schoolId, name: text.trim() }
      const { error } = await supabase.from(table).insert(row as never)
      if (error) throw new Error(friendly(error.message))
    },
    onSuccess: () => {
      setText('')
      setIcon('')
      done()
    },
    onError: fail,
  })
  const toggle = useMutation({
    mutationFn: async (it: Item) => {
      const { error } = await supabase.from(table).update({ active: !it.active }).eq('id', it.id)
      if (error) throw new Error(friendly(error.message))
    },
    onSuccess: done,
    onError: fail,
  })

  // Rename (and change the icon of) an item in place; history keeps pointing at the same id.
  const rename = useMutation({
    mutationFn: async (v: { id: string; text: string; icon: string }) => {
      if (!v.text.trim()) throw new Error('Escribe un nombre.')
      const patch = table === 'tags' ? { label: v.text.trim(), icon: v.icon.trim() || null } : { name: v.text.trim() }
      const { error } = await supabase.from(table).update(patch as never).eq('id', v.id)
      if (error) throw new Error(friendly(error.message))
    },
    onSuccess: () => { setEditing(null); done() },
    onError: fail,
  })

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    if (!text.trim()) return setError('Escribe un nombre.')
    add.mutate()
  }

  return (
    <div className="catalog">
      <div>
        <h3>{title}</h3>
        <p className="hint">{description}</p>
      </div>
      {canEdit && (
        <form className="catalog__form" onSubmit={onSubmit} noValidate>
          {withIcon && <input className="input catalog__icon" aria-label="Ícono (emoji)" placeholder="🥋" maxLength={8} value={icon} onChange={(e) => setIcon(e.target.value)} />}
          <input className="input" aria-label={`Nuevo: ${title}`} placeholder={placeholder} maxLength={60} value={text} onChange={(e) => setText(e.target.value)} />
          <button className="btn" type="submit" disabled={add.isPending}><Icon name="plus" size={16} /> Agregar</button>
        </form>
      )}
      {error && <p className="alert" role="alert">{error}</p>}
      {items.isLoading && <p className="hint">Cargando…</p>}
      {items.data?.length === 0 && <p className="hint">Aún no hay elementos.</p>}
      <ul className="chips chips--catalog">
        {items.data?.map((it) => (
          <li key={it.id} className={it.active ? '' : 'is-off'}>
            {editing?.id === it.id ? (
              <span className="chip-edit">
                {withIcon && <input className="input catalog__icon" aria-label="Ícono" maxLength={8} value={editing.icon} onChange={(e) => setEditing({ ...editing, icon: e.target.value })} />}
                <input className="input" aria-label={`Nombre de ${it.text}`} maxLength={60} value={editing.text} autoFocus onChange={(e) => setEditing({ ...editing, text: e.target.value })} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); rename.mutate(editing) } if (e.key === 'Escape') setEditing(null) }} />
                <button type="button" className="chip-action" disabled={rename.isPending} onClick={() => rename.mutate(editing)}>Guardar</button>
                <button type="button" className="chip-action" onClick={() => setEditing(null)}>Cancelar</button>
              </span>
            ) : (
              <>
                {it.icon && <span aria-hidden="true">{it.icon}</span>}
                {it.text}
              </>
            )}
            {canEdit && editing?.id !== it.id && (
              <button type="button" className="chip-action" onClick={() => { setError(null); setEditing({ id: it.id, text: it.text, icon: it.icon ?? '' }) }} aria-label={`Editar ${it.text}`}>Editar</button>
            )}
            {canEdit && editing?.id !== it.id && (
              <button type="button" className="chip-action" onClick={() => toggle.mutate(it)} aria-label={`${it.active ? 'Desactivar' : 'Activar'} ${it.text}`}>
                {it.active ? 'Desactivar' : 'Activar'}
              </button>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}
