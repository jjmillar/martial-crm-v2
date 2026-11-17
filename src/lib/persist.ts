import { useCallback, useState } from 'react'

/**
 * UI state that survives leaving a section and coming back (standard for the whole app, docs/ui-standards.md §4).
 *  - 'local'  : preferences (view day/week/month, filters, "show inactive" toggles). Kept on this device.
 *  - 'session': where you were (the date you were looking at, search text, how much history is expanded).
 *               Kept until the browser tab/session ends, so a new day starts fresh.
 * Storage can be unavailable (private mode, blocked): then it simply behaves like useState.
 */
type Scope = 'local' | 'session'
const PREFIX = 'mcrm.ui.'

function store(scope: Scope): Storage | null {
  try { return scope === 'local' ? window.localStorage : window.sessionStorage } catch { return null }
}

export function readPersisted<T>(key: string, fallback: T, scope: Scope = 'local'): T {
  try {
    const raw = store(scope)?.getItem(PREFIX + key)
    return raw == null ? fallback : (JSON.parse(raw) as T)
  } catch { return fallback }
}

export function writePersisted<T>(key: string, value: T, scope: Scope = 'local'): void {
  try { store(scope)?.setItem(PREFIX + key, JSON.stringify(value)) } catch { /* storage unavailable: nothing to keep */ }
}

/** useState that remembers its value under `key` (see scopes above). */
export function usePersisted<T>(key: string, initial: T, scope: Scope = 'local'): [T, (v: T | ((prev: T) => T)) => void] {
  const [value, setValue] = useState<T>(() => readPersisted(key, initial, scope))
  const set = useCallback((v: T | ((prev: T) => T)) => {
    setValue((prev) => {
      const next = typeof v === 'function' ? (v as (p: T) => T)(prev) : v
      writePersisted(key, next, scope)
      return next
    })
  }, [key, scope])
  return [value, set]
}
