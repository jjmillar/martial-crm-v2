import { Link } from '../../lib/nav'
import { todayIso } from '../../lib/dates'
import { Icon } from '../../ui/Icon'
import { BeltBar } from './Belt'
import { degreeText, TRACKS, type Art, type ArtRow } from './api'

type Props = { arts: Art[]; rows: ArtRow[]; onChange: (rows: ArtRow[]) => void; canConfigure: boolean; error?: string | null }

/**
 * The student's martial arts inside the student form: one row per art with its belt (adults or kids), degree and
 * since when. Saved together with the form. Raising the belt or degree is recorded as a graduation (Logros).
 */
export function StudentArtsEditor({ arts, rows, onChange, canConfigure, error }: Props) {
  const used = new Set(rows.map((r) => r.art_id))
  const free = arts.filter((a) => a.active && !used.has(a.id))
  const setRow = (i: number, patch: Partial<ArtRow>) => onChange(rows.map((r, j) => (j === i ? { ...r, ...patch } : r)))

  if (arts.length === 0) {
    return (
      <p className="hint">
        La escuela aún no tiene artes marciales configuradas.{' '}
        {canConfigure ? <Link to="/app/ajustes#artes">Configúralas en Ajustes → Artes marciales</Link> : 'Pídele a un administrador que las configure en Ajustes.'}
      </p>
    )
  }

  return (
    <div className="sarts">
      {rows.length === 0 && <p className="hint">Sin artes marciales asignadas.</p>}
      <ul className="sarts__list">
        {rows.map((r, i) => {
          const art = arts.find((a) => a.id === r.art_id)
          const belt = art?.belts.find((b) => b.id === r.belt_id)
          const id = `sa-${i}`
          return (
            <li key={r.art_id} className="sarts__row">
              <div className="sarts__head">
                {belt ? <BeltBar color={belt.color} stripe={belt.stripe} degree={Number(r.degree || 0)} size="lg" /> : <span className="beltbar beltbar--lg beltbar--empty" aria-hidden="true" />}
                <strong>{art?.name ?? 'Arte marcial'}</strong>
                <button type="button" className="icon-btn" onClick={() => onChange(rows.filter((_, j) => j !== i))} aria-label={`Quitar ${art?.name ?? 'arte marcial'}`} title="Quitar"><Icon name="close" size={16} /></button>
              </div>
              <div className="form-grid">
                <div className="field">
                  <label htmlFor={`${id}-belt`}>Cinturón</label>
                  <select id={`${id}-belt`} className="input" value={r.belt_id} onChange={(e) => setRow(i, { belt_id: e.target.value, degree: '' })}>
                    <option value="">Sin cinturón</option>
                    {TRACKS.map((t) => {
                      const list = art?.belts.filter((b) => b.track === t.id) ?? []
                      return list.length ? (
                        <optgroup key={t.id} label={t.label}>
                          {list.map((b) => <option key={b.id} value={b.id}>{b.name}{b.rank_label ? ` (${b.rank_label})` : ''}</option>)}
                        </optgroup>
                      ) : null
                    })}
                  </select>
                </div>
                {belt && belt.max_degree > 0 && (
                  <div className="field">
                    <label htmlFor={`${id}-deg`}>{belt.degree_name === 'franja' ? 'Franjas' : 'Grado'}</label>
                    <select id={`${id}-deg`} className="input" value={r.degree || '0'} onChange={(e) => setRow(i, { degree: e.target.value })}>
                      {Array.from({ length: belt.max_degree + 1 }, (_, n) => <option key={n} value={n}>{n === 0 ? 'Sin grado' : degreeText(n, belt.degree_name)}</option>)}
                    </select>
                  </div>
                )}
                <div className="field">
                  <label htmlFor={`${id}-since`}>Desde (fecha del último grado)</label>
                  <input id={`${id}-since`} className="input" type="date" max={todayIso()} value={r.since} onChange={(e) => setRow(i, { since: e.target.value })} />
                </div>
              </div>
            </li>
          )
        })}
      </ul>
      {free.length > 0 && (
        <div className="pick-chips">
          {free.map((a) => (
            <button key={a.id} type="button" className="pick-chip" onClick={() => onChange([...rows, { art_id: a.id, belt_id: a.belts[0]?.id ?? '', degree: '', since: '' }])}>
              <Icon name="plus" size={14} /> {a.name}
            </button>
          ))}
        </div>
      )}
      {error && <p className="alert" role="alert">{error}</p>}
      <p className="hint">Subir el cinturón o el grado queda registrado como graduación en los logros del alumno.</p>
    </div>
  )
}
