import { useRef, useState, type FormEvent, type PointerEvent as ReactPointerEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { Icon } from '../../ui/Icon'
import { Modal } from '../../ui/Modal'
import { catalogQuery, type CatalogTable, type Item } from './catalogApi'

// One component for every simple per-school catalog (S6): specialties, skills (table "tags"), school badges...
// Each item is a chip. Desktop: hovering shows colored edit / delete icons. Phone: a long press opens a pop-up to
// edit or delete it.

function friendly(message: string): string {
  if (message.includes('duplicate key')) return 'Ya existe con ese nombre.'
  if (message.includes('row-level security')) return 'Solo los administradores pueden editar catálogos.'
  return 'No se pudo guardar.'
}

const LONG_PRESS = 450 // gesture threshold, not an animation
const MOVE_TOLERANCE = 10

export type CatalogProps = {
  table: CatalogTable; schoolId: string; title: string; description: string; placeholder: string; withIcon?: boolean; canEdit: boolean
  /** Called after any change, so other screens that list these items can refresh. */
  onChange?: () => void
}

type Draft = { id: string; text: string; icon: string }

export function Catalogo({ table, schoolId, title, description, placeholder, withIcon = false, canEdit, onChange }: CatalogProps) {
  const qc = useQueryClient()
  const { queryKey: key, queryFn } = catalogQuery(table, schoolId)
  const items = useQuery({ queryKey: key, queryFn })
  const [text, setText] = useState('')
  const [icon, setIcon] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [editing, setEditing] = useState<Draft | null>(null) // desktop: inline edit in the chip
  const [confirmId, setConfirmId] = useState<string | null>(null) // desktop: inline "are you sure?"
  // phone: long-press pop-up (the item stays while the pop-up closes)
  const [sheet, setSheet] = useState<Draft | null>(null)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [sheetConfirm, setSheetConfirm] = useState(false)
  const [sheetError, setSheetError] = useState<string | null>(null)
  const press = useRef<{ timer: number; x: number; y: number } | null>(null)

  const noun = table === 'tags' ? 'skill' : table === 'school_badges' ? 'insignia' : 'especialidad'
  const deleteWarning = table === 'tags' ? 'Sale de las clases y del progreso de los alumnos.'
    : table === 'school_badges' ? 'Los alumnos que la recibieron conservan el logro.' : 'Sale de profesores, clases y planes.'
  const withIconCol = table !== 'specialties'
  const done = () => { onChange?.(); return qc.invalidateQueries({ queryKey: key }) }

  const add = useMutation({
    mutationFn: async () => {
      const row = table === 'tags' ? { school_id: schoolId, label: text.trim(), icon: icon.trim() || null }
        : withIconCol ? { school_id: schoolId, name: text.trim(), icon: icon.trim() || null } : { school_id: schoolId, name: text.trim() }
      const { error } = await supabase.from(table).insert(row as never)
      if (error) throw new Error(friendly(error.message))
    },
    onSuccess: () => { setText(''); setIcon(''); done() },
    onError: (e: Error) => setError(e.message),
  })

  // Delete for good (asked first): it also leaves the classes/teachers that used it.
  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from(table).delete().eq('id', id)
      if (error) throw new Error(friendly(error.message))
    },
    onSuccess: () => { setConfirmId(null); setSheetOpen(false); done() },
    onError: (e: Error) => { setError(e.message); setSheetError(e.message) },
  })

  // Rename (and change the icon of) an item in place; history keeps pointing at the same id.
  const rename = useMutation({
    mutationFn: async (v: Draft) => {
      if (!v.text.trim()) throw new Error('Escribe un nombre.')
      const patch = table === 'tags' ? { label: v.text.trim(), icon: v.icon.trim() || null }
        : withIconCol ? { name: v.text.trim(), icon: v.icon.trim() || null } : { name: v.text.trim() }
      const { error } = await supabase.from(table).update(patch as never).eq('id', v.id)
      if (error) throw new Error(friendly(error.message))
    },
    onSuccess: () => { setEditing(null); setSheetOpen(false); done() },
    onError: (e: Error) => { setError(e.message); setSheetError(e.message) },
  })

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    if (!text.trim()) return setError('Escribe un nombre.')
    add.mutate()
  }

  const draftOf = (it: Item): Draft => ({ id: it.id, text: it.text, icon: it.icon ?? '' })
  function openSheet(it: Item) {
    setSheet(draftOf(it))
    setSheetConfirm(false)
    setSheetError(null)
    setSheetOpen(true)
  }

  // Long press (touch / pen only; a mouse uses the hover icons).
  const cancelPress = () => { if (press.current) { window.clearTimeout(press.current.timer); press.current = null } }
  function onPointerDown(e: ReactPointerEvent, it: Item) {
    if (!canEdit || e.pointerType === 'mouse') return
    cancelPress()
    const timer = window.setTimeout(() => { press.current = null; navigator.vibrate?.(10); openSheet(it) }, LONG_PRESS)
    press.current = { timer, x: e.clientX, y: e.clientY }
  }
  function onPointerMove(e: ReactPointerEvent) {
    const p = press.current
    if (p && Math.hypot(e.clientX - p.x, e.clientY - p.y) > MOVE_TOLERANCE) cancelPress()
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
      {canEdit && Boolean(items.data?.length) && <p className="hint catalog__touch-hint">Mantén presionada una {noun} para editarla o eliminarla.</p>}
      <ul className="chips chips--catalog">
        {items.data?.map((it) => (
          <li
            key={it.id}
            className={`cat-chip${editing?.id === it.id || confirmId === it.id ? ' is-busy' : ''}`}
            onPointerDown={(e) => onPointerDown(e, it)}
            onPointerMove={onPointerMove}
            onPointerUp={cancelPress}
            onPointerCancel={cancelPress}
            onPointerLeave={cancelPress}
            onContextMenu={(e) => { if (canEdit) e.preventDefault() }}
          >
            {editing?.id === it.id ? (
              <span className="chip-edit">
                {withIcon && <input className="input catalog__icon" aria-label="Ícono" maxLength={8} value={editing.icon} onChange={(e) => setEditing({ ...editing, icon: e.target.value })} />}
                <input className="input" aria-label={`Nombre de ${it.text}`} maxLength={60} value={editing.text} autoFocus onChange={(e) => setEditing({ ...editing, text: e.target.value })} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); rename.mutate(editing) } if (e.key === 'Escape') setEditing(null) }} />
                <button type="button" className="chip-action" disabled={rename.isPending} onClick={() => rename.mutate(editing)}>Guardar</button>
                <button type="button" className="chip-action" onClick={() => setEditing(null)}>Cancelar</button>
              </span>
            ) : confirmId === it.id ? (
              <span className="chip-confirm" role="group" aria-label={`Eliminar ${it.text}`}>
                <span><b>{it.text}</b>: ¿eliminar? {deleteWarning}</span>
                <button type="button" className="chip-action chip-action--danger" disabled={remove.isPending} onClick={() => remove.mutate(it.id)}>Sí, eliminar</button>
                <button type="button" className="chip-action" onClick={() => setConfirmId(null)}>Cancelar</button>
              </span>
            ) : (
              <>
                <span className="cat-chip__label">{it.icon && <span aria-hidden="true">{it.icon}</span>}{it.text}</span>
                {canEdit && (
                  <span className="cat-chip__tools">
                    <button type="button" className="cat-tool cat-tool--edit" onClick={() => { setError(null); setConfirmId(null); setEditing(draftOf(it)) }} aria-label={`Editar ${it.text}`} title="Editar"><Icon name="edit" size={14} /></button>
                    <button type="button" className="cat-tool cat-tool--delete" onClick={() => { setError(null); setEditing(null); setConfirmId(it.id) }} aria-label={`Eliminar ${it.text}`} title="Eliminar"><Icon name="trash" size={14} /></button>
                  </span>
                )}
              </>
            )}
          </li>
        ))}
      </ul>

      <Modal open={sheetOpen} onClose={() => setSheetOpen(false)} label={`Editar ${noun}`} isolate>
        {sheet && (
          <>
            <div className="modal__head">
              <span className="eyebrow">{noun === 'skill' ? 'Skill' : noun === 'insignia' ? 'Insignia' : 'Especialidad'}</span>
              <button type="button" className="icon-btn" onClick={() => setSheetOpen(false)} aria-label="Cerrar"><Icon name="close" /></button>
            </div>
            <form className="cat-sheet" onSubmit={(e) => { e.preventDefault(); setSheetError(null); rename.mutate(sheet) }} noValidate>
              <div className="cat-sheet__row">
                {withIcon && (
                  <div className="field">
                    <label htmlFor="cat-sheet-icon">Ícono</label>
                    <input id="cat-sheet-icon" className="input catalog__icon" maxLength={8} value={sheet.icon} onChange={(e) => setSheet({ ...sheet, icon: e.target.value })} />
                  </div>
                )}
                <div className="field">
                  <label htmlFor="cat-sheet-name">Nombre</label>
                  <input id="cat-sheet-name" className="input" maxLength={60} value={sheet.text} onChange={(e) => setSheet({ ...sheet, text: e.target.value })} />
                </div>
              </div>
              {sheetError && <p className="alert" role="alert">{sheetError}</p>}
              <button type="submit" className="btn" disabled={rename.isPending}><Icon name="edit" size={16} /> {rename.isPending ? 'Guardando…' : 'Guardar cambios'}</button>
            </form>
            {sheetConfirm ? (
              <div className="cat-sheet__confirm" role="group" aria-label={`Eliminar ${sheet.text}`}>
                <p>¿Eliminar <b>{sheet.text}</b>? {deleteWarning}</p>
                <button type="button" className="btn btn--danger" disabled={remove.isPending} onClick={() => remove.mutate(sheet.id)}><Icon name="trash" size={16} /> Sí, eliminar</button>
                <button type="button" className="btn btn--ghost" onClick={() => setSheetConfirm(false)}>Cancelar</button>
              </div>
            ) : (
              <button type="button" className="btn btn--ghost cat-sheet__delete" onClick={() => setSheetConfirm(true)}><Icon name="trash" size={16} /> Eliminar {noun}</button>
            )}
          </>
        )}
      </Modal>
    </div>
  )
}
