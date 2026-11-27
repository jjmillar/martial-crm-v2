---
name: Martial CRM
description: CRM para academias de artes marciales. Grafito en capas, un panel de trabajo, pocas líneas, una sola grotesca, movimiento corto.
colors:
  shell-dark: "#111113"
  bg-dark: "#18181b"
  surface-dark: "#1f1f23"
  surface-2-dark: "#29292e"
  line-dark: "#2b2b30"
  line-strong-dark: "#3a3a41"
  text-dark: "#f4f4f7"
  muted-dark: "#bababf"
  faint-dark: "#8a8a92"
  shell-light: "#ededf0"
  bg-light: "#f8f8fa"
  surface-light: "#ffffff"
  surface-2-light: "#f0f0f3"
  line-light: "#e4e4e9"
  line-strong-light: "#d0d0d7"
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
  control: "8px"
  card: "14px"
  panel: "18px"
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
**Persuade** surface: the main-site landing. The world is graphite in layers: a deep shell ground, one rounded work
panel, cards on it; one grotesque (Inter Tight), soft radii, few lines and a single warm accent (`#e0492c`) spent on
the current state, the focus of a page and the class colours. Simplicity first: one container per thing (no card in a
card), sections are open (a header over a hairline), lists are grouped (one card, rows divided). Brand lives in precision: tabular numbers, aligned columns, short motion.
Dark is the default theme; light is a composed theme of its own, not an inversion. Source of truth: `src/index.css`
(tokens), `src/ui/motion.css` (motion), `src/ui/patterns.css` (shared components), `docs/ui-standards.md` (rules).

## Colors

Every colour is a CSS custom property remapped per theme (`:root` = dark, `:root[data-theme='light']`).
- Surfaces: `--shell` (desktop ground under the sidebar), `--bg` (the work panel, and the page on phones and public
  pages), `--surface` (cards, tiles, grouped lists), `--surface-2` (tracks, chips, hover), `--line` (dividers),
  `--line-strong` (edges of fields, ghost buttons, tags), `--input-bg`, `--seg-on` (the raised segmented option).
- Text: `--text`, `--muted` (secondary), `--faint` (hints, meta). All three pass 4.5:1 on `--bg` and `--surface` in
  both themes (audit 2026-11-27).
- Accent: `--accent` for icons, focus marks, bars of progress and fills; `--accent-text` when the accent is small
  text; `--accent-solid` behind white text (badges, today's date).
- Status: `--ok`, `--warn`, `--danger`, `--info`, one value per theme. Never hard-code a status hex again.
- Class colours (`--class-color`) are user data: a dot, a tint (`color-mix(... 10%, var(--surface))`) or a full border.
- School pages use `--brand / --brand-2 / --on-brand`; `--on-brand` comes from `onColor()` (highest WCAG contrast).

## Typography

One family, Inter Tight (body 15/1.5), self-hosted through `next/font` in `app/layout.tsx` (variable 100–900, latin, `--font-inter-tight`); never link Google Fonts. Headings 700, tracking -0.02em, `text-wrap: balance`. Hints 13 px in
`--faint`. Section titles inside tiles 16 px/700 (`.tile__title`); modal titles 17 px (`.modal__title`). Numbers in
tables, times and money use `font-variant-numeric: tabular-nums`. Inputs are 16 px on phones (no iOS zoom).

## Layout

Desktop: fixed 264 px sidebar on the `--shell` ground (school logo + name on top, menu centred, CRM signature and user
at the foot) and the page on one work panel (`.main`: 10 px inset, 18 px radius, hairline). Signature move: the current
menu item is drawn as a piece of that panel (panel colour + hairline), so the menu points into the page. Phones (≤760 px): no top bar; the user's photo top left, a draggable round menu button, a bottom
sheet with every section. Pages are one long view of open sections (`Acc`, `<details>`: a header row over a hairline,
never a box) grouped by `h2.acc-group` (20 px heading); no tabs. The staff home greeting is the page header (no box)
over four numbers (2 × 2 on phones). The student home opens with the greeting and the level as one header (no boxes; the level
sits at the right on desktop), class rows carry their action at the right ("Marcar" on phones), and skills and belts
share one progress block. Lists of people and movements are grouped lists (`.student-list`,
`.member-group`). Long lists show 3, then "Mostrar más" by 10.

## Elevation & Depth

Flat by default: depth comes from `--surface` over `--bg` plus 1 px `--line`. Shadows only on floating things
(dialogs, the mobile menu button, the landing's product picture), always offset and blurred.

## Shapes

8 px controls, 14 px cards and tiles, 18 px work panel, dialogs and plan cards; pills for tags, chips, time slots and
the segmented filter; round avatars, section icons and dots.

## Components

- Buttons `.btn` (primary = inverted text/bg) and `.btn--ghost` (bordered); 40 px, 44 px on touch. One primary per view.
- Fields `.input`: 42 px (44 touch), focus = 2 px ring at full text contrast, `aria-invalid` = danger border.
- Toggles `Toggle` (role="switch"); never visible checkboxes.
- Segmented filters `.segmented`: a pill track (`--surface-2`) with the chosen option raised (`--seg-on`), counts in
  muted; on phones they scroll sideways.
- Dialogs: only `Modal` (fade + 8 px rise; reduced motion = fade only). Actions open their pop-up in place.
- Sections `Acc`: round icon, title and a one-line summary over a hairline; open, never boxed.
- Class rows: dot · time · name · action, flat with dividers (no card inside a card, no side bar).
- Avatars: `Avatar` (photo from the private bucket via signed URL, else initials).

## Do's and Don'ts

- Do keep every text pair ≥4.5:1 (≥3:1 large); check both themes with real screenshots at 390 and 1440 px.
- Do use the status tokens; do pair colour with text (the tag says "Pendiente", not just yellow).
- Do keep 44 px touch targets on phones and a visible focus everywhere.
- Don't put a label/eyebrow above a heading (banned); put meta under it.
- Don't draw a coloured bar down one side of a box; use a dot, a tint or a full border.
- Don't nest cards (a section is never a box; a list is one card with divided rows); don't build pages out of
  identical icon + title + text cards.
- Don't add tabs, checkboxes, scrollbars, gradient text or decorative glass.
- Don't use dark patterns on the landing (see docs/landing.md).
- Motion: one standard (`--dur` 240 ms enter, 180 ms exit, 150 ms state); reduced motion removes travel, keeps fades.
