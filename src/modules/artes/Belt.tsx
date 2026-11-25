import type { CSSProperties } from 'react'

// A belt drawn like the real one:
// * pattern 'banda': a lengthwise band in `stripe` (kids two-color belts); 'punta': the ends in `stripe` (TKD WT);
//   'paneles': alternating blocks of color and `stripe` (BJJ coral, judo red-white).
// * bar: the rank bar near the end, where the stripes/degrees go (BJJ black bar; red bar on the black belt).
// * degrees: marks on the bar; with no bar, gold marks at the end (dans on a black belt).

export type BeltLook = { color: string; stripe?: string | null; bar?: string | null; pattern?: string | null }

const GOLD = '#c9a227'
function light(hex: string): boolean {
  const n = parseInt(hex.slice(1), 16)
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 150
}
/** Color of the degree marks: on the bar white (black on a light bar); on the belt gold (dark on a light belt). */
const tickColor = (b: BeltLook) => (b.bar ? (light(b.bar) ? '#0b0b0d' : '#f4f4f7') : light(b.color) ? '#0b0b0d' : GOLD)

type BarProps = BeltLook & { degree?: number; size?: 'sm' | 'md' | 'lg' | 'xl'; title?: string }

/** Straight belt (lists, pickers). */
export function BeltBar({ color, stripe, bar, pattern, degree = 0, size = 'md', title }: BarProps) {
  const pat = stripe ? (pattern ?? 'banda') : 'liso'
  const style = { '--belt': color, '--stripe': stripe ?? color, '--bar': bar ?? 'transparent', '--tick': tickColor({ color, bar }) } as CSSProperties
  const ticks = Math.min(degree, 10)
  return (
    <span className={`beltbar beltbar--${size} beltbar--${pat}`} style={style} title={title} aria-hidden={title ? undefined : true}>
      {(bar || ticks > 0) && (
        <span className={`beltbar__rank${bar ? ' has-bar' : ''}${ticks > 4 ? ' is-many' : ''}`}>
          {Array.from({ length: ticks }, (_, i) => <i key={i} />)}
        </span>
      )}
    </span>
  )
}

type ChipProps = BeltLook & { name: string; degree?: number; degreeText?: string | null; art?: string | null; size?: 'sm' | 'md' | 'lg' }

/** Belt + its name ("Azul · 2 franjas"), optionally with the art above. */
export function BeltChip({ name, color, stripe, bar, pattern, degree = 0, degreeText, art, size = 'md' }: ChipProps) {
  return (
    <span className={`beltchip beltchip--${size}`}>
      <BeltBar color={color} stripe={stripe} bar={bar} pattern={pattern} degree={degree} size={size} />
      <span className="beltchip__text">
        {art && <span className="beltchip__art">{art}</span>}
        <span>{name}{degreeText ? ` · ${degreeText}` : ''}</span>
      </span>
    </span>
  )
}
