import { useState, type FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Icon } from '../../ui/Icon'
import { Modal } from '../../ui/Modal'
import { Toggle } from '../../ui/Toggle'
import { BeltBar } from './Belt'
import {
  addFromTemplate, artsKey, createArt, DEGREE_NAMES, deleteArt, deleteBelt, degreeText, listArts, listTemplates, moveBelt, saveBelt,
  templatesKey, TRACKS, updateArt, type Art, type Belt, type BeltDraft, type Track,
} from './api'

/**
 * Ajustes → Artes marciales. The school picks arts from the platform's catalog (copied with their adult and kids belts)
 * or creates its own, and then edits everything: names, colors, degrees, order. Changes stay in this school.
 */
export function ArtesMarciales({ schoolId }: { schoolId: string }) {
  const qc = useQueryClient()
  const arts = useQuery({ queryKey: artsKey(schoolId), queryFn: () => listArts(schoolId) })
  const templates = useQuery({ queryKey: templatesKey, queryFn: listTemplates, staleTime: Infinity })
  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const refresh = () => Promise.all([
    qc.invalidateQueries({ queryKey: artsKey(schoolId) }),
    qc.invalidateQueries({ queryKey: ['school-student-arts', schoolId] }),
  ])

  const add = useMutation({ mutationFn: (key: string) => addFromTemplate(schoolId, key), onMutate: () => setError(null), onSuccess: refresh, onError: (e: Error) => setError(e.message) })
  const create = useMutation({
    mutationFn: () => createArt(schoolId, name, arts.data?.length ?? 0),
    onMutate: () => setError(null),
    onSuccess: () => { setName(''); return refresh() },
    onError: (e: Error) => setError(e.message),
  })

  const taken = new Set((arts.data ?? []).map((a) => a.template_key).filter(Boolean))
  const available = (templates.data ?? []).filter((t) => !taken.has(t.key))

  function onCreate(e: FormEvent) {
    e.preventDefault()
    if (!name.trim()) return setError('Escribe el nombre de la arte marcial.')
    create.mutate()
  }

  return (
    <div className="artes">
      <p className="hint">
        Las artes marciales que enseña la escuela, cada una con sus cinturones de adultos y kids. Al agregar una del catálogo
        se copia a tu escuela: puedes cambiar nombres, colores y grados sin afectar a nadie más.
      </p>

      {available.length > 0 && (
        <div className="artes__add">
          <span className="eyebrow">Agregar del catálogo</span>
          <div className="pick-chips">
            {available.map((t) => (
              <button key={t.key} type="button" className="pick-chip" disabled={add.isPending} onClick={() => add.mutate(t.key)}>
                <Icon name="plus" size={14} /> {t.name}
              </button>
            ))}
          </div>
        </div>
      )}
      <form className="catalog__form" onSubmit={onCreate} noValidate>
        <input className="input" aria-label="Nueva arte marcial propia" placeholder="Otra arte marcial (ej: Kickboxing)" maxLength={60} value={name} onChange={(e) => setName(e.target.value)} />
        <button className="btn btn--ghost" type="submit" disabled={create.isPending}><Icon name="plus" size={16} /> Crear propia</button>
      </form>
      {error && <p className="alert" role="alert">{error}</p>}

      {arts.isLoading && <p className="hint">Cargando…</p>}
      {arts.data?.length === 0 && <p className="hint">La escuela aún no tiene artes marciales. Agrega una del catálogo para empezar.</p>}
      <ul className="art-list">
        {arts.data?.map((a) => <ArtCard key={a.id} art={a} templateName={templates.data?.find((t) => t.key === a.template_key)?.name ?? null} onChange={refresh} />)}
      </ul>
    </div>
  )
}

const BELT_COLORS = [
  { name: 'Blanco', hex: '#f4f4f7' }, { name: 'Gris', hex: '#8a8a92' }, { name: 'Amarillo', hex: '#e8c547' },
  { name: 'Naranja', hex: '#e8873a' }, { name: 'Verde', hex: '#3fb27f' }, { name: 'Azul', hex: '#3d7be0' },
  { name: 'Morado', hex: '#8a5cd6' }, { name: 'Café', hex: '#7a5134' }, { name: 'Rojo', hex: '#e0492c' }, { name: 'Negro', hex: '#0b0b0d' },
]

type BeltEdit = { belt?: Belt; draft: BeltDraft }

function ArtCard({ art, templateName, onChange }: { art: Art; templateName: string | null; onChange: () => unknown }) {
  const [renaming, setRenaming] = useState(false)
  const [artName, setArtName] = useState(art.name)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [edit, setEdit] = useState<BeltEdit | null>(null)
  const [open, setOpen] = useState(false)

  const rename = useMutation({
    mutationFn: () => { if (!artName.trim()) throw new Error('Escribe un nombre.'); return updateArt(art.id, { name: artName.trim() }) },
    onMutate: () => setError(null), onSuccess: () => { setRenaming(false); return onChange() }, onError: (e: Error) => setError(e.message),
  })
  const toggle = useMutation({ mutationFn: (active: boolean) => updateArt(art.id, { active }), onSuccess: onChange, onError: (e: Error) => setError(e.message) })
  const remove = useMutation({ mutationFn: () => deleteArt(art.id), onMutate: () => setError(null), onSuccess: onChange, onError: (e: Error) => { setConfirmDelete(false); setError(e.message) } })

  const openBelt = (track: Track, belt?: Belt) => {
    const last = art.belts.filter((b) => b.track === track).at(-1)
    setEdit({
      belt,
      draft: belt
        ? { name: belt.name, color: belt.color, stripe: belt.stripe, bar: belt.bar, pattern: belt.pattern, max_degree: belt.max_degree, degree_name: belt.degree_name, rank_label: belt.rank_label, track: belt.track }
        : { name: '', color: '#f4f4f7', stripe: null, bar: null, pattern: 'banda', max_degree: 0, degree_name: last?.degree_name ?? 'grado', rank_label: null, track },
    })
    setOpen(true)
  }

  return (
    <li className={`art-card card${art.active ? '' : ' is-off'}`}>
      <header className="art-card__head">
        {renaming ? (
          <form className="catalog__form" onSubmit={(e) => { e.preventDefault(); rename.mutate() }} noValidate>
            <input className="input" aria-label="Nombre de la arte marcial" maxLength={60} value={artName} autoFocus onChange={(e) => setArtName(e.target.value)} />
            <button className="btn btn--sm" type="submit" disabled={rename.isPending}>Guardar</button>
            <button className="btn btn--ghost btn--sm" type="button" onClick={() => { setRenaming(false); setArtName(art.name) }}>Cancelar</button>
          </form>
        ) : (
          <div>
            <h3>{art.name}</h3>
            <p className="hint">{templateName ? `Copiada del catálogo (${templateName})` : 'Creada por la escuela'}{art.active ? '' : ' · desactivada'}</p>
          </div>
        )}
        {!renaming && (
          <span className="art-card__tools">
            <button type="button" className="icon-btn" onClick={() => setRenaming(true)} aria-label={`Cambiar nombre de ${art.name}`} title="Cambiar nombre"><Icon name="edit" size={16} /></button>
            <button type="button" className="icon-btn" onClick={() => setConfirmDelete(true)} aria-label={`Eliminar ${art.name}`} title="Eliminar"><Icon name="trash" size={16} /></button>
          </span>
        )}
      </header>
      {confirmDelete && (
        <div className="cat-sheet__confirm" role="group" aria-label={`Eliminar ${art.name}`}>
          <p>¿Eliminar <b>{art.name}</b> y sus cinturones? Solo se puede si ningún alumno la tiene.</p>
          <button type="button" className="btn btn--danger btn--sm" disabled={remove.isPending} onClick={() => remove.mutate()}><Icon name="trash" size={16} /> Sí, eliminar</button>
          <button type="button" className="btn btn--ghost btn--sm" onClick={() => setConfirmDelete(false)}>Cancelar</button>
        </div>
      )}
      {error && <p className="alert" role="alert">{error}</p>}

      {TRACKS.map((t) => {
        const belts = art.belts.filter((b) => b.track === t.id)
        return (
          <section key={t.id} className="belt-track" aria-label={`Cinturones ${t.label}`}>
            <span className="eyebrow">{t.label} · {belts.length}</span>
            <ul className="belt-chips">
              {belts.map((b) => (
                <li key={b.id}>
                  <button type="button" className="belt-pick" onClick={() => openBelt(t.id, b)} aria-label={`Editar cinturón ${b.name} (${t.label})`}>
                    <BeltBar color={b.color} stripe={b.stripe} bar={b.bar} pattern={b.pattern} />
                    <span>{b.name}</span>
                    {(b.rank_label || b.max_degree > 0) && <span className="hint">{[b.rank_label, b.max_degree > 0 && `hasta ${degreeText(b.max_degree, b.degree_name)}`].filter(Boolean).join(' · ')}</span>}
                  </button>
                </li>
              ))}
              <li>
                <button type="button" className="belt-pick belt-pick--add" onClick={() => openBelt(t.id)}><Icon name="plus" size={14} /> Cinturón</button>
              </li>
            </ul>
          </section>
        )
      })}

      <Toggle checked={art.active} onChange={(v) => toggle.mutate(v)} label="Activa" hint="Desactivada no aparece al asignar artes a los alumnos; quienes ya la tienen la conservan." />

      <Modal open={open} onClose={() => setOpen(false)} label="Cinturón">
        {edit && <BeltForm art={art} edit={edit} onDone={() => { setOpen(false); return onChange() }} onClose={() => setOpen(false)} />}
      </Modal>
    </li>
  )
}

function BeltForm({ art, edit, onDone, onClose }: { art: Art; edit: BeltEdit; onDone: () => unknown; onClose: () => void }) {
  const [d, setD] = useState<BeltDraft>(edit.draft)
  const [error, setError] = useState<string | null>(null)
  const [confirm, setConfirm] = useState(false)
  const set = <K extends keyof BeltDraft>(k: K, v: BeltDraft[K]) => setD((x) => ({ ...x, [k]: v }))
  // Generic colors; a new black belt comes ready for dans.
  const pickColor = (c: { name: string; hex: string }) => setD((x) => ({
    ...x, color: c.hex, name: x.name || c.name,
    ...(c.hex === '#0b0b0d' && x.max_degree === 0 ? { max_degree: 10, degree_name: 'dan' as const } : {}),
  }))
  const siblings = art.belts.filter((b) => b.track === d.track)
  const idx = edit.belt ? siblings.findIndex((b) => b.id === edit.belt!.id) : -1

  const save = useMutation({
    mutationFn: () => {
      if (!d.name.trim()) throw new Error('Escribe el nombre del cinturón.')
      return saveBelt(art, d, edit.belt?.id)
    },
    onMutate: () => setError(null), onSuccess: onDone, onError: (e: Error) => setError(e.message),
  })
  const remove = useMutation({ mutationFn: () => deleteBelt(edit.belt!.id), onSuccess: onDone, onError: (e: Error) => { setConfirm(false); setError(e.message) } })
  const move = useMutation({ mutationFn: (to: number) => moveBelt(edit.belt!, siblings[to]), onSuccess: onDone, onError: (e: Error) => setError(e.message) })

  return (
    <>
      <div className="modal__head">
        <span className="eyebrow">{art.name} · {TRACKS.find((t) => t.id === d.track)?.label}</span>
        <button type="button" className="icon-btn" onClick={onClose} aria-label="Cerrar"><Icon name="close" /></button>
      </div>
      <div className="belt-preview">
        <BeltBar color={d.color} stripe={d.stripe} bar={d.bar} pattern={d.pattern} degree={d.max_degree} size="xl" />
        <b>{d.name || 'Nuevo cinturón'}</b>
      </div>
      <form className="belt-form" onSubmit={(e) => { e.preventDefault(); save.mutate() }} noValidate>
        <div className="form-grid">
          <div className="field">
            <label htmlFor="bf-name">Nombre</label>
            <input id="bf-name" className="input" maxLength={60} value={d.name} onChange={(e) => set('name', e.target.value)} placeholder="Ej: Azul" />
          </div>
          <div className="field">
            <label htmlFor="bf-rank">Grado oficial (opcional)</label>
            <input id="bf-rank" className="input" maxLength={30} value={d.rank_label ?? ''} onChange={(e) => set('rank_label', e.target.value)} placeholder="Ej: 5º kyu" />
          </div>
          <div className="field field--wide">
            <span className="field__label" id="bf-color-l">Color</span>
            <div className="belt-swatches" role="group" aria-labelledby="bf-color-l">
              {BELT_COLORS.map((c) => (
                <button key={c.hex} type="button" className="belt-swatch" style={{ background: c.hex }} aria-pressed={d.color === c.hex} title={c.name} aria-label={c.name}
                  onClick={() => pickColor(c)} />
              ))}
              <input id="bf-color" className="input input--color" type="color" value={d.color} onChange={(e) => set('color', e.target.value.toLowerCase())} aria-label="Otro color" title="Otro color" />
            </div>
          </div>
          <div className="field">
            <label htmlFor="bf-stripe">Segundo color</label>
            <div className="belt-form__stripe">
              <Toggle inline checked={d.stripe !== null} onChange={(v) => set('stripe', v ? '#f4f4f7' : null)} label={d.stripe ? 'Sí' : 'No'} />
              {d.stripe !== null && <input id="bf-stripe" className="input input--color" type="color" value={d.stripe} onChange={(e) => set('stripe', e.target.value.toLowerCase())} aria-label="Segundo color" />}
            </div>
          </div>
          {d.stripe !== null && (
            <div className="field">
              <label htmlFor="bf-pattern">Cómo va</label>
              <select id="bf-pattern" className="input" value={d.pattern} onChange={(e) => set('pattern', e.target.value as BeltDraft['pattern'])}>
                <option value="banda">Franja a lo largo</option>
                <option value="punta">En la punta</option>
                <option value="paneles">Por bloques</option>
              </select>
            </div>
          )}
          <div className="field">
            <label htmlFor="bf-bar">Barra de grados</label>
            <div className="belt-form__stripe">
              <Toggle inline checked={d.bar !== null} onChange={(v) => set('bar', v ? (d.color === '#0b0b0d' ? '#e0492c' : '#0b0b0d') : null)} label={d.bar ? 'Sí' : 'No'} />
              {d.bar !== null && <input id="bf-bar" className="input input--color" type="color" value={d.bar} onChange={(e) => set('bar', e.target.value.toLowerCase())} aria-label="Color de la barra" />}
            </div>
            <span className="hint">{d.bar ? 'Los grados se marcan sobre la barra, como en BJJ.' : 'Sin barra, los grados se marcan dorados en la punta.'}</span>
          </div>
          <div className="field">
            <label htmlFor="bf-max">Grados máximos</label>
            <select id="bf-max" className="input" value={d.max_degree} onChange={(e) => set('max_degree', Number(e.target.value))}>
              {Array.from({ length: 13 }, (_, n) => <option key={n} value={n}>{n === 0 ? 'Sin grados' : n}</option>)}
            </select>
          </div>
          {d.max_degree > 0 && (
            <div className="field">
              <label htmlFor="bf-dn">Se cuentan en</label>
              <select id="bf-dn" className="input" value={d.degree_name} onChange={(e) => set('degree_name', e.target.value as BeltDraft['degree_name'])}>
                {DEGREE_NAMES.map((x) => <option key={x.id} value={x.id}>{x.label}</option>)}
              </select>
            </div>
          )}
        </div>
        {error && <p className="alert" role="alert">{error}</p>}
        <button type="submit" className="btn" disabled={save.isPending}>{save.isPending ? 'Guardando…' : edit.belt ? 'Guardar cambios' : 'Agregar cinturón'}</button>
      </form>
      {edit.belt && (
        <div className="belt-form__more">
          <span className="hint">Orden: {idx + 1} de {siblings.length}</span>
          <button type="button" className="btn btn--ghost btn--sm" disabled={idx <= 0 || move.isPending} onClick={() => move.mutate(idx - 1)}><Icon name="up" size={14} /> Antes</button>
          <button type="button" className="btn btn--ghost btn--sm" disabled={idx >= siblings.length - 1 || move.isPending} onClick={() => move.mutate(idx + 1)}><Icon name="down" size={14} /> Después</button>
          {confirm ? (
            <span className="belt-form__confirm">
              <button type="button" className="btn btn--danger btn--sm" disabled={remove.isPending} onClick={() => remove.mutate()}>Sí, eliminar</button>
              <button type="button" className="btn btn--ghost btn--sm" onClick={() => setConfirm(false)}>No</button>
            </span>
          ) : (
            <button type="button" className="btn btn--ghost btn--sm" onClick={() => setConfirm(true)}><Icon name="trash" size={14} /> Eliminar</button>
          )}
        </div>
      )}
    </>
  )
}
