import { usePersisted } from '../lib/persist'

// The app's standard for long lists (docs/ui-standards.md §3): the last 3, "Mostrar más" shows 10, then 10 more each
// time. How far you expanded is kept for the session.
export const FIRST = 3
export const PAGE = 10

export function useShowMore(key: string) {
  const [shown, setShown] = usePersisted(key, FIRST, 'session')
  return { shown, more: () => setShown((n) => (n < PAGE ? PAGE : n + PAGE)) }
}
