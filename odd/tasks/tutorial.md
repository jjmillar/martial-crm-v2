Objective: a guided first-run tour for new trial accounts, plus a Help section (FAQ + tutorials) in Ajustes.
Branch: `tutorial` (one commit per task, PR + Netlify deploy preview; merge only with the user's OK) · Test runner: `npm run test` (Vitest) + `npm run lint` + `npm run typecheck` + `npm run build`.

## Specs

- **S1 First-run guided tour.** "Cuando se creen su cuenta de prueba vamos a hacer un tour guiado al usuario para que rellene lo minimo para armar la escuela." It starts by itself for a new customer CEO: role `ceo`, no schools yet, and no saved tour state for that user.
- **S2 Minimal steps, in this order.** "Lo primero es crear una escuela con sus minimos datos, como el arte marcial. Despues que añada almenos una clase, despues que añada un profesor. Tambien que muestre como crear un plan para que se suscriban. El tutorial tiene que abordar lo minimo solamente."
  1. School: name + martial art (the existing create form).
  2. At least one class.
  3. At least one teacher.
  4. How to create a plan. Shown; creating one is optional.
  - Each step is done when the real data exists (schools / classes / teachers / plans), never by a click alone.
  - Optional skip anywhere ("Saltar tour"). The user acts on the real screens; the page is never blocked.
- **S3 Animated, on the same page.** "El primer tutorial será como una animacion en la misma pagina". A spotlight dims the page around the real control and moves between steps, with a coach card beside it. On the forms it docks as a small card. It uses the motion tokens and honors `prefers-reduced-motion`.
- **S4 Ayuda in Ajustes.** "en el menu de ajuste, añadas la opcion de "ayuda" y que dentro crees un FAQ, y ademas una seccion de tutoriales, donde salgan todos los tutoriales." Ajustes gets an "Ayuda" section (`#ayuda`) for every role, holding "Preguntas frecuentes" and "Tutoriales". The content is filtered by role: staff (ceo/admin/user) or alumno.
- **S5 All the tutorials.** "Con todos me refiero al primer tutorial y añade tutoriales diferentes para cada gran seccion que sea necesaria mostrar." The list:
  - Primeros pasos, which can replay the guided tour;
  - one tutorial per major section: Miembros, Asistencia, Contabilidad (pagos/planes/inscripciones), Landing y clases de prueba, Ajustes de la escuela;
  - for students: asistencia, pagos y planes, perfil, hijos.
  - Every text describes real buttons and menus (verified in code, nothing invented).
- **S6 Menu tutorials look "normal".** "los tutoriales que accedamos por el menu se veran de manra "normal"." A tutorial opens in a pop-up in place (`Modal`): title, one line of context, numbered steps, and a `MoreLink` to the menu where it happens. No spotlight or animation.
- **S7 House rules.**
  - impeccable (craft-floor) and screenshots on mobile/desktop, light/dark;
  - no eyebrows, no tabs, toggles only, pop-ups in place;
  - security: no new DB objects; tour state in localStorage, keyed by user id + version.

## Tasks

- [x] **T1 Tour logic.** A pure function picks the current step from data counts and saved state. Storage is keyed by user and version, and so is the start condition.
  - Files: `src/modules/ayuda/tour.ts`, `src/modules/ayuda/tour.test.ts`.
  - Test: `tour.test.ts`, written first and seen RED.
  - Risk: low.
- [x] **T2 Tour UI.** `GuidedTour` adds the spotlight, the coach card and the docked card. It is mounted in `AppLayout`, with `data-tour` anchors on the create buttons and the school form.
  - Files: `src/modules/ayuda/GuidedTour.tsx`, `src/modules/ayuda/ayuda.css`, `src/shell/AppLayout.tsx`, `app/layout.tsx` (css import), and anchors in `ClasesList.tsx`, `ProfesoresList.tsx`, `PlanesList.tsx`, `EscuelasPage.tsx`.
  - Test: a component test that it renders the step for a new CEO, and that "Saltar tour" stores `skipped`.
  - Risk: (6) visual, so screenshots are required.
  - UI: impeccable onboard
- [x] **T3 Help content.** The FAQ and tutorials as typed data with roles. Every `to` must be a real app route.
  - Files: `src/modules/ayuda/content.ts`, `src/modules/ayuda/content.test.ts`.
  - Test: `content.test.ts`, which checks unique ids, non-empty steps, valid routes and the role filter.
  - Risk: (6) wrong copy, so check it against the code.
- [ ] **T4 Ayuda section.** Add `Acc id="ayuda"` in Ajustes for every role, with the FAQ list, the tutorials list, the tutorial pop-up, and "Ver el tour guiado" for ceo/admin.
  - Files: `src/modules/ayuda/Ayuda.tsx`, `src/modules/ajustes/AjustesPage.tsx`, `src/modules/ayuda/ayuda.css`.
  - Test: a component test that the student sees only student content and that a tutorial opens in a pop-up.
  - Risk: (6) visual.
  - UI: impeccable onboard
- [ ] **T5 Close.** QA screenshots at 390/1440 px, light and dark, plus `DESIGN.md` / `docs/ui-standards.md` notes, PR, deploy preview, and a Telegram notice.
  - Files: docs.
  - Test: the full suite, lint, typecheck and build.
  - Risk: (5) deploy, so it goes to the preview only.

## Verification

- S1–S3: Playwright with a mocked new CEO. The tour appears, the spotlight moves, it docks on the form, the step advances when the data exists, and "Saltar" keeps it from coming back.
- S4–S6: Ajustes → Ayuda as staff and as a student. Each tutorial opens in a pop-up and its links reach real routes.
- S7: lint (no checkbox or raw dialog), contrast and focus audit, screenshots.

## Log

- 2026-11-28 user: "vamos a añadir un tutorial al primer inicio de sesion. Cuando se creen su cuenta de prueba vamos a hacer un tour guiado al usuario para que rellene lo minimo para armar la escuela. Lo primero es crear una escuela con sus minimos datos, como el arte marcial. Despues que añada almenos una clase, despues que añada un profesor. Tambien que muestre como crear un plan para que se suscriban. El tutorial tiene que abordar lo minimo solamente. Como siempre usa la skill "impecable" para el diseño. Quiero que en el menu de ajuste, añadas la opcion de "ayuda" y que dentro crees un FAQ, y ademas una seccion de tutoriales, donde salgan todos los tutoriales. Con todos me refiero al primer tutorial y añade tutoriales diferentes para cada gran seccion que sea necesaria mostrar. El primer tutorial será como una animacion en la misma pagina, pero los tutoriales que accedamos por el menu se veran de manra "normal"."
- Decision (Claude, a sensible default with no new DB object): tour state lives in localStorage per user (`mcrm.tour:v1:<userId>`). A new account has no schools, so the tour starts there. Progress does not follow the user to another device.
- T1 completed: tour.test.ts RED (module missing) → GREEN 10/10.
- T2 completed: GuidedTour.test.tsx 8/8 GREEN. Honest note: these component tests were written after the component, so no RED was observed for T2 (T1 logic was RED→GREEN). Visual QA: qa-tour.mjs (mocked new CEO) 4 viewports × all steps PASS, 0 console errors. Bug found in QA and fixed: the target inside a closed accordion was invisible, so the tour now opens that section once per step and checks visibility.
- T3 completed: content.test.ts RED (module missing) → GREEN 8/8. Copy checked against the code: buttons, menus, export (Alumnos/Inscripciones/Pagos/Asistencia), subscription only for the CEO, 2FA for every role, 14-day trial (Landing TRIAL_DAYS).
