import { useId, type CSSProperties } from 'react'

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

type BarProps = BeltLook & { degree?: number; size?: 'sm' | 'md' | 'lg'; title?: string }

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

/**
 * The belt as an "emote": tied, with its two tails. The rank bar (and its degree marks) sits on the right tail, like
 * on a real belt.
 */
export function BeltEmote({ color, stripe, bar, pattern, degree = 0, size = 44, title }: BeltLook & { degree?: number; size?: number; title?: string }) {
  const uid = useId().replace(/:/g, '')
  const pat = stripe ? (pattern ?? 'banda') : 'liso'
  const ticks = Math.min(degree, 10)
  const tick = tickColor({ color, bar })
  const across = `bp-a-${uid}`, along = `bp-b-${uid}`
  const fillBand = pat === 'paneles' ? `url(#${across})` : color
  const fillTail = pat === 'paneles' ? `url(#${along})` : color
  const L = 28, W = 9 // tail length and width
  // The bar covers y 13–24 of the right tail; marks spread inside it (or there, in gold, when there is no bar).
  const top = 14, span = 9
  const step = ticks > 1 ? span / (ticks - 1) : 0
  const mark = Math.max(0.7, Math.min(1.3, ticks > 1 ? step * 0.5 : 1.3))
  const tail = (side: 1 | -1) => (
    <g transform={`translate(${side === -1 ? 28 : 36} 16) rotate(${side === -1 ? 22 : -22})`}>
      <rect x={-W / 2} y={0} width={W} height={L} rx={1.2} fill={fillTail} />
      {pat === 'banda' && <rect x={-1.5} y={0} width={3} height={L} fill={stripe!} />}
      {pat === 'punta' && <rect x={-W / 2} y={L - 7} width={W} height={7} rx={1.2} fill={stripe!} />}
      {side === 1 && bar && <rect x={-W / 2} y={top - 1.5} width={W} height={span + 3} fill={bar} />}
      {side === 1 && Array.from({ length: ticks }, (_, i) => (
        <rect key={i} x={-W / 2 + 1} y={(ticks === 1 ? top + span / 2 : top + i * step) - mark / 2} width={W - 2} height={mark} rx={0.3} fill={tick} />
      ))}
      <rect x={-W / 2} y={0} width={W} height={L} rx={1.2} className="belt-emote__edge" />
    </g>
  )
  return (
    <span className="belt-emote" style={{ width: size, height: size * 0.78 } as CSSProperties} role={title ? 'img' : undefined} aria-label={title} aria-hidden={title ? undefined : true}>
      <svg viewBox="0 0 64 50" width="100%" height="100%">
        {pat === 'paneles' && (
          <defs>
            <pattern id={across} width="8" height="10" patternUnits="userSpaceOnUse"><rect width="4" height="10" fill={color} /><rect x="4" width="4" height="10" fill={stripe!} /></pattern>
            <pattern id={along} width="10" height="8" patternUnits="userSpaceOnUse"><rect width="10" height="4" fill={color} /><rect y="4" width="10" height="4" fill={stripe!} /></pattern>
          </defs>
        )}
        {tail(-1)}
        {tail(1)}
        <rect x={2} y={7} width={60} height={10} rx={1.8} fill={fillBand} />
        {pat === 'banda' && <rect x={2} y={10.5} width={60} height={3} fill={stripe!} />}
        <rect x={2} y={7} width={60} height={10} rx={1.8} className="belt-emote__edge" />
        <rect x={26} y={4} width={12} height={15} rx={2.6} fill={fillBand} />
        {pat === 'banda' && <rect x={26} y={10.5} width={12} height={3} fill={stripe!} />}
        <rect x={26} y={4} width={12} height={15} rx={2.6} className="belt-emote__edge belt-emote__knot" />
      </svg>
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
