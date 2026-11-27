---
name: Martial CRM
description: CRM para academias de artes marciales. Grafito, una sola grotesca, radios chicos, movimiento corto.
colors:
  bg-dark: "#19191c"
  surface-dark: "#212125"
  surface-2-dark: "#2b2b30"
  line-dark: "#323236"
  text-dark: "#f4f4f7"
  muted-dark: "#bababf"
  faint-dark: "#8a8a92"
  bg-light: "#f4f4f7"
  surface-light: "#ffffff"
  surface-2-light: "#ebebef"
  line-light: "#dcdce1"
  text-light: "#19191c"
  muted-light: "#55555c"
  faint-light: "#66666e"
  accent: "#e0492c"
  accent-text-dark: "#f2694d"
  accent-text-light: "#c23a1f"
  accent-solid: "#c23a1f"
  ok-dark: "#3fb27f"
  ok-light: "#1b744e"
  warn-dark: "#e8c547"
  warn-light: "#845f00"
  info-dark: "#6aa9f0"
  info-light: "#2b67b3"
  danger-dark: "#ff6b5a"
  danger-light: "#c2342a"
typography:
  body:
    fontFamily: "Inter Tight, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: 1.5
  hint:
    fontFamily: "Inter Tight, system-ui, sans-serif"
    fontSize: "13px"
    fontWeight: 400
  heading:
    fontFamily: "Inter Tight, system-ui, sans-serif"
    fontWeight: 700
    lineHeight: 1.08
    letterSpacing: "-0.02em"
  tile-title:
    fontFamily: "Inter Tight, system-ui, sans-serif"
    fontSize: "16px"
    fontWeight: 700
    letterSpacing: "-0.01em"
  display-landing:
    fontFamily: "Inter Tight, system-ui, sans-serif"
    fontSize: "88px"
    fontWeight: 700
    lineHeight: 0.96
rounded:
  control: "5px"
  card: "12px"
  dialog: "18px"
  pill: "999px"
spacing:
  gap: "12px"
  card-padding: "20px"
  control-height: "40px"
  control-height-touch: "44px"
components:
  button-primary:
    backgroundColor: "{colors.text-dark}"
    textColor: "{colors.bg-dark}"
    rounded: "{rounded.control}"
    height: "{spacing.control-height}"
    padding: "0 16px"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.text-dark}"
    rounded: "{rounded.control}"
    height: "{spacing.control-height}"
  input:
    backgroundColor: "{colors.bg-dark}"
    textColor: "{colors.text-dark}"
    rounded: "{rounded.control}"
    height: "42px"
    padding: "0 12px"
  card:
    backgroundColor: "{colors.surface-dark}"
    rounded: "{rounded.card}"
    padding: "{spacing.card-padding}"
  tag-ok:
    textColor: "{colors.ok-dark}"
    rounded: "{rounded.pill}"
  tag-warn:
    textColor: "{colors.warn-dark}"
    rounded: "{rounded.pill}"
---

## Overview

Martial CRM is a work tool (Impeccable mode **Operate**) for academy owners, their staff and their students, plus one
**Persuade** surface: the main-site landing. The world is graphite: near-black or near-white surfaces, one grotesque
(Inter Tight), small radii, hairline borders and a single warm accent (`#e0492c`) spent on the current state, the
focus of a page and the class colours. Brand lives in precision: tabular numbers, aligned columns, short motion.
Dark is the default theme; light is a composed theme of its own, not an inversion. Source of truth: `src/index.css`
(tokens), `src/ui/motion.css` (motion), `src/ui/patterns.css` (shared components), `docs/ui-standards.md` (rules).

## Colors

Every colour is a CSS custom property remapped per theme (`:root` = dark, `:root[data-theme='light']`).
- Surfaces: `--bg` (page), `--surface` (cards, tiles), `--surface-2` (pressed, hover, chips), `--line` (hairlines).
- Text: `--text`, `--muted` (secondary), `--faint` (hints, meta). All three pass 4.5:1 on `--bg` and `--surface` in
  both themes (audit 2026-11-27).
- Accent: `--accent` for icons, focus marks, bars of progress and fills; `--accent-text` when the accent is small
  text; `--accent-solid` behind white text (badges, today's date).
- Status: `--ok`, `--warn`, `--danger`, `--info`, one value per theme. Never hard-code a status hex again.
- Class colours (`--class-color`) are user data: a dot, a tint (`color-mix(... 10%, var(--surface))`) or a full border.
- School pages use `--brand / --brand-2 / --on-brand`; `--on-brand` comes from `onColor()` (highest WCAG contrast).

## Typography

One family, Inter Tight (body 15/1.5). Headings 700, tracking -0.02em, `text-wrap: balance`. Hints 13 px in
`--faint`. Section titles inside tiles 16 px/700 (`.tile__title`); modal titles 17 px (`.modal__title`). Numbers in
tables, times and money use `font-variant-numeric: tabular-nums`. Inputs are 16 px on phones (no iOS zoom).

## Layout

Desktop: fixed 264 px sidebar (school logo + name on top, menu centred, CRM signature and user at the foot) and a
content column. Phones (≤760 px): no top bar; the user's photo top left, a draggable round menu button, a bottom
sheet with every section. Pages are one long view of accordions (`<details>`) grouped by `h2.acc-group`; no tabs.
Bento grids for dashboards (`.bento`), single column on phones. Long lists show 3, then "Mostrar más" by 10.

## Elevation & Depth

Flat by default: depth comes from `--surface` over `--bg` plus 1 px `--line`. Shadows only on floating things
(dialogs, the mobile menu button, the landing's product picture), always offset and blurred.

## Shapes

5 px controls, 12 px cards and tiles, 18 px dialogs and plan cards, round avatars and dots, pill tags.

## Components

- Buttons `.btn` (primary = inverted text/bg) and `.btn--ghost` (bordered); 40 px, 44 px on touch. One primary per view.
- Fields `.input`: 42 px (44 touch), focus = 2 px ring at full text contrast, `aria-invalid` = danger border.
- Toggles `Toggle` (role="switch"); never visible checkboxes.
- Segmented filters `.segmented` with counts; on phones they scroll sideways.
- Dialogs: only `Modal` (fade + 8 px rise; reduced motion = fade only). Actions open their pop-up in place.
- Accordions `Acc` with icon, title and a one-line summary.
- Class rows: dot · time · name · action, flat with dividers (no card inside a card, no side bar).
- Avatars: `Avatar` (photo from the private bucket via signed URL, else initials).

## Do's and Don'ts

- Do keep every text pair ≥4.5:1 (≥3:1 large); check both themes with real screenshots at 390 and 1440 px.
- Do use the status tokens; do pair colour with text (the tag says "Pendiente", not just yellow).
- Do keep 44 px touch targets on phones and a visible focus everywhere.
- Don't put a label/eyebrow above a heading (banned); put meta under it.
- Don't draw a coloured bar down one side of a box; use a dot, a tint or a full border.
- Don't nest cards; don't build pages out of identical icon + title + text cards.
- Don't add tabs, checkboxes, scrollbars, gradient text or decorative glass.
- Don't use dark patterns on the landing (see docs/landing.md).
- Motion: one standard (`--dur` 240 ms enter, 180 ms exit, 150 ms state); reduced motion removes travel, keeps fades.
