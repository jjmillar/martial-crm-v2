# UI standards

Two rules that apply to every screen, present and future. Both are enforced in code, not just written here.

## 1. Everything that enters or leaves moves (motion standard)

One set of values for the whole app. CSS tokens live in `src/ui/motion.css`; `src/ui/motion.ts` mirrors them for JS.

| Token | Value | Use |
|---|---|---|
| `--dur-fast` / `motion.fast` | 150 ms | hover, press, toggle, color changes |
| `--dur` / `motion.base` | 240 ms | something enters: alerts, list items, sections, dialogs, accordions |
| `--dur-slow` / `motion.slow` | 360 ms | pages and large surfaces |
| `--dur-exit` / `motion.exit` | 180 ms | something leaves (always quicker than it entered) |
| `--ease-out` | `cubic-bezier(0.22, 1, 0.36, 1)` | entering |
| `--ease-in` | `cubic-bezier(0.55, 0, 1, 0.45)` | leaving |
| `--ease` | `cubic-bezier(0.45, 0, 0.55, 1)` | moving and state changes |

Standard movements: **enter** = fade in while rising 8 px (pages: 12 px); **exit** = fade out, sinking 4 px and scaling to 0.98; **move** = slide from the old position to the new one.

What is already automatic (no code needed):

- **Pages**: `PageMotion` animates every route change, in the app shell (`AppLayout`) and on public pages (`router.tsx`). Query-string changes such as filters don't count.
- **Lists and containers**: `installMotion()` (called in `app/providers.tsx`) animates children added, removed or moved inside every `ul`, `ol`, `form`, the root of each page, and any element with `data-motion`. To exclude a subtree, use `data-motion="off"`. That is the only way out.
- **Pop-ups**: always `<Modal open onClose>` from `src/ui/Modal.tsx` (lint blocks a raw `<dialog>` elsewhere; the mobile menu sheet is the one exception and uses the same motion). One movement for every pop-up: it fades in rising 8 px and leaves fading out and sinking 8 px, backdrop included, with **no scaling** (scaled text looks blurry while it moves). The content moves as one piece with the pop-up: it is mounted before the pop-up appears, stays in place until the exit has finished, and nothing inside animates on its own while it opens or closes. The exit is driven by `closeDialog()` (`ui/motion.ts`), so it also plays on Safari/iPhone. Inside another form, pass `isolate` (rendered outside that form; typing or Enter in the pop-up never touches it). Data the pop-up shows should be loaded before it opens, so nothing pops in while it animates.
- **Accordions** (`<details>`): open and close with a height transition.
- **Alerts and field errors**: always enter.
- **Toast** (`Flash`): enters and leaves.

When building something new:

- A container whose children appear or disappear and isn't a `ul`/`ol`/`form`: add `data-motion`.
- An element that mounts by itself: `className="m-in"` (or `m-pop` for something floating, `m-fade` for a fade only).
- An element that must stay in the DOM while it leaves: use `enterFrames()`/`exitFrames` from `ui/motion.ts` with `motion.exit` + `motion.easeIn`, as `Flash` does.
- Never write `ms`, `s ease` or `cubic-bezier` outside `motion.css`/`motion.ts`. Always use the tokens.
- `prefers-reduced-motion` turns all of it off (global rule in `index.css`; `installMotion` and `PageMotion` check it too).

## 2. Every on/off control is a toggle (no checkboxes)

- Use `<Toggle>` from `src/ui/Toggle.tsx`: `label`, optional `hint`, `inline` for toolbars, `disabled`, `id`.
- Lint blocks `type="checkbox"` anywhere outside `Toggle.tsx` (`no-restricted-syntax` in `eslint.config.js`).
- As a safety net, any checkbox renders as a switch anyway (global `input[type='checkbox']` rule in `ui/patterns.css`).
- Mutually exclusive choices (filters, cycle, payment method) stay as segmented buttons (`.segmented`), and multiple selection of labels stays as chips (`.pick-chip`). Those are not on/off controls.
