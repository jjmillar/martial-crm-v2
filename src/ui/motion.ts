import autoAnimate, { type AutoAnimationPlugin } from '@formkit/auto-animate'

// Motion standard (docs/ui-standards.md). Every element that enters or leaves the UI moves with these values;
// they mirror the CSS tokens in src/ui/motion.css. Never hand-pick durations or easings elsewhere.
export const motion = {
  fast: 150, // hover, press, toggles
  base: 240, // something enters: alerts, list items, sections, dialogs
  slow: 360, // pages and big surfaces
  exit: 180, // something leaves (always quicker than entering)
  easeOut: 'cubic-bezier(0.22, 1, 0.36, 1)', // entering
  easeIn: 'cubic-bezier(0.55, 0, 1, 0.45)', // leaving
  ease: 'cubic-bezier(0.45, 0, 0.55, 1)', // moving / state changes
}

export const reducedMotion = () =>
  typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

/** Standard entrance: fade in while rising a few pixels. */
export const enterFrames = (rise = 8): Keyframe[] => [
  { opacity: 0, transform: `translateY(${rise}px)` },
  { opacity: 1, transform: 'none' },
]

/** Standard exit: fade out, sinking slightly and shrinking a hair. */
export const exitFrames: Keyframe[] = [
  { opacity: 1, transform: 'none' },
  { opacity: 0, transform: 'translateY(4px) scale(0.98)' },
]

// Lists and containers: children that are added, removed or moved animate with the standard frames.
const plugin: AutoAnimationPlugin = (el, action, oldCoords, newCoords) => {
  if (action === 'add') return new KeyframeEffect(el, enterFrames(), { duration: motion.base, easing: motion.easeOut })
  if (action === 'remove') return new KeyframeEffect(el, exitFrames, { duration: motion.exit, easing: motion.easeIn })
  const dx = (oldCoords?.left ?? 0) - (newCoords?.left ?? 0)
  const dy = (oldCoords?.top ?? 0) - (newCoords?.top ?? 0)
  return new KeyframeEffect(el, [{ transform: `translate(${dx}px, ${dy}px)` }, { transform: 'none' }], {
    duration: dx || dy ? motion.base : 0,
    easing: motion.ease,
  })
}

/**
 * Containers whose children animate in/out automatically: every list, form and dialog body, the root of
 * each page, and anything marked data-motion. Opt a subtree out with data-motion="off".
 */
export const MOTION_CONTAINERS = '[data-motion]:not([data-motion="off"]), form, ul, ol, .modal__body, .m-page > *'

const registered = new WeakSet<Element>()
function register(el: Element) {
  if (registered.has(el) || !(el instanceof HTMLElement) || el.closest('[data-motion="off"]')) return
  registered.add(el)
  autoAnimate(el, plugin)
}

/** Call once at startup: wires the standard list motion to every current and future container. */
export function installMotion() {
  if (reducedMotion() || typeof MutationObserver === 'undefined') return
  const scan = (root: Element) => {
    if (root.matches(MOTION_CONTAINERS)) register(root)
    root.querySelectorAll(MOTION_CONTAINERS).forEach(register)
  }
  scan(document.body)
  new MutationObserver((records) => {
    for (const r of records) r.addedNodes.forEach((n) => { if (n instanceof Element) scan(n) })
  }).observe(document.body, { childList: true, subtree: true })
}
