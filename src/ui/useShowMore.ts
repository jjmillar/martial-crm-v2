import { usePersisted } from '../lib/persist'

// The app's standard for long lists (docs/ui-standards.md §3): the last 3, "Mostrar más" shows 10, then 10 more each
// time. How far you expanded is kept for the session.
export const FIRST = 3
export const PAGE = 10

/** `first`: how many show before "Mostrar más" (directories like Miembros start at 10). */
export function useShowMore(key: string, first = FIRST) {
  const [shown, setShown] = usePersisted(key, first, 'session')
  return { shown, more: () => setShown((n) => (n < PAGE ? PAGE : n + PAGE)) }
}
