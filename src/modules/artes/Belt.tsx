import type { CSSProperties } from 'react'

// A belt drawn in CSS: main color, optional band along the middle (kids two-color belts, "punta" and "franja" belts)
// and small marks for degrees/stripes at the end.

function light(hex: string): boolean {
  const n = parseInt(hex.slice(1), 16)
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 150
}

type BarProps = { color: string; stripe?: string | null; degree?: number; size?: 'sm' | 'md' | 'lg'; title?: string }

export function BeltBar({ color, stripe, degree = 0, size = 'md', title }: BarProps) {
  const style = { '--belt': color, '--stripe': stripe ?? color, '--tick': light(color) ? '#0b0b0d' : '#f4f4f7' } as CSSProperties
  const ticks = Math.min(degree, 10)
  return (
    <span className={`beltbar beltbar--${size}`} style={style} title={title} aria-hidden={title ? undefined : true}>
      {ticks > 0 && <span className="beltbar__deg">{Array.from({ length: ticks }, (_, i) => <i key={i} />)}</span>}
    </span>
  )
}

type ChipProps = { name: string; color: string; stripe?: string | null; degree?: number; degreeText?: string | null; art?: string | null; size?: 'sm' | 'md' | 'lg' }

/** Belt + its name ("Azul · 2 franjas"), optionally with the art above. */
export function BeltChip({ name, color, stripe, degree = 0, degreeText, art, size = 'md' }: ChipProps) {
  return (
    <span className={`beltchip beltchip--${size}`}>
      <BeltBar color={color} stripe={stripe} degree={degree} size={size} />
      <span className="beltchip__text">
        {art && <span className="beltchip__art">{art}</span>}
        <span>{name}{degreeText ? ` · ${degreeText}` : ''}</span>
      </span>
    </span>
  )
}
