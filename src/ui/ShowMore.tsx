import { PAGE } from './useShowMore'

// The app's standard for long lists (docs/ui-standards.md §3): the last 3, "Mostrar más" shows 10, then 10 more each
// time. How far you expanded is kept for the session.
export function ShowMore({ shown, total, onMore, noun = 'clases', label }: { shown: number; total: number; onMore: () => void; noun?: string; label?: string }) {
  if (total <= shown) return null
  return (
    <div className="show-more">
      <button type="button" className="btn btn--ghost" onClick={onMore}>{label ?? (shown < PAGE ? 'Mostrar más' : `Cargar más ${noun}`)}</button>
      <span className="hint">Mostrando {shown} de {total}</span>
    </div>
  )
}
