import type { ReactNode } from 'react'

type Props = {
  checked: boolean
  onChange: (checked: boolean) => void
  label: ReactNode
  hint?: ReactNode
  /** Compact single-line variant for toolbars and headers. */
  inline?: boolean
  disabled?: boolean
  id?: string
}

// The only on/off control in the app (standard: no checkboxes, every boolean is a toggle switch).
export function Toggle({ checked, onChange, label, hint, inline, disabled, id }: Props) {
  return (
    <label className={`switch${inline ? ' switch--inline' : ''}`}>
      <input id={id} type="checkbox" role="switch" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />
      {inline ? (
        <span>{label}</span>
      ) : (
        <span>
          <strong>{label}</strong>
          {hint && <span className="hint">{hint}</span>}
        </span>
      )}
    </label>
  )
}
