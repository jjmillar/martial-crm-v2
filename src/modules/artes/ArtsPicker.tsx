import { useState } from 'react'
import { Icon } from '../../ui/Icon'
import type { ArtPick } from './picks'

/** Required pick of the martial arts a school teaches: catalog chips, picked ones checked, plus "¿Otra?". */
export function ArtsPicker({ picks, onChange, invalid = false, idPrefix = 'arts' }: { picks: ArtPick[]; onChange: (p: ArtPick[]) => void; invalid?: boolean; idPrefix?: string }) {
  const [other, setOther] = useState('')
  const [otherError, setOtherError] = useState<string | null>(null)
  const toggle = (id: string) => onChange(picks.map((p) => (p.id === id ? { ...p, on: !p.on } : p)))

  function addOther() {
    const name = other.trim()
    if (!name) return setOtherError('Escribe el nombre.')
    const same = picks.find((p) => p.name.toLowerCase() === name.toLowerCase())
    setOtherError(null)
    setOther('')
    if (same) return onChange(picks.map((p) => (p.id === same.id ? { ...p, on: true } : p)))
    onChange([...picks, { id: `new:${name.toLowerCase()}`, name, on: true }])
  }

  return (
    <fieldset className={`arts-pick${invalid ? ' is-invalid' : ''}`} aria-describedby={`${idPrefix}-help`}>
      <legend>Artes marciales que imparte *</legend>
      <div className="pick-chips" role="group" aria-label="Artes marciales">
        {picks.map((p) => (
          <button key={p.id} type="button" className="pick-chip" aria-pressed={p.on} onClick={() => toggle(p.id)}>
            {p.on && <Icon name="check" size={14} />} {p.name}
          </button>
        ))}
      </div>
      <div className="catalog__form">
        <input className="input" aria-label="Otra arte marcial" placeholder="¿Otra? (ej: Kickboxing)" maxLength={60} value={other}
          onChange={(e) => { setOther(e.target.value); setOtherError(null) }}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addOther() } }} />
        <button type="button" className="btn btn--ghost" onClick={addOther}><Icon name="plus" size={16} /> Agregar</button>
      </div>
      {otherError && <p className="field__error">{otherError}</p>}
      <p id={`${idPrefix}-help`} className="hint">Los cinturones y grados de cada alumno salen de estas artes. Se editan en Ajustes → Artes marciales.</p>
    </fieldset>
  )
}
