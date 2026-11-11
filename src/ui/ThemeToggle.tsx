import { useState } from 'react'
import { Icon } from './Icon'

type Theme = 'dark' | 'light'

function readTheme(): Theme {
  try {
    return localStorage.getItem('mcrm.theme') === 'light' ? 'light' : 'dark'
  } catch {
    return 'dark'
  }
}

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>(readTheme)

  function toggle() {
    const next: Theme = theme === 'dark' ? 'light' : 'dark'
    setTheme(next)
    document.documentElement.dataset.theme = next
    try { localStorage.setItem('mcrm.theme', next) } catch { /* private mode: theme just won't persist */ }
  }

  return (
    <button type="button" className="icon-btn" onClick={toggle} aria-label={theme === 'dark' ? 'Usar tema claro' : 'Usar tema oscuro'}>
      <Icon name={theme === 'dark' ? 'sun' : 'moon'} />
    </button>
  )
}
