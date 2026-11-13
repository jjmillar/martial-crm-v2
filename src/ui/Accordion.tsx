import type { ReactNode } from 'react'
import { Icon, type IconName } from './Icon'

// Collapsible section (closed by default). The body keeps its own components; their outer card frame and
// first heading are neutralized by CSS so the summary is the only title.
export function Acc({ id, title, hint, icon, children }: { id: string; title: string; hint?: string; icon?: IconName; children: ReactNode }) {
  return (
    <details className="acc card" id={id}>
      <summary className="acc__summary">
        {icon && <span className="acc__icon" aria-hidden="true"><Icon name={icon} size={18} /></span>}
        <span className="acc__title">
          <strong>{title}</strong>
          {hint && <span className="hint">{hint}</span>}
        </span>
        <span className="acc__chev" aria-hidden="true"><Icon name="down" size={18} /></span>
      </summary>
      <div className="acc__body">{children}</div>
    </details>
  )
}
