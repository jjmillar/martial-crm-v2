Objective: rebuild Martial CRM from scratch as v2, a scalable multi-school CRM for martial arts schools, using v1 as the functional template.
Branch: `main` (one work-unit commit per task) · Delivery: phased, one module per task, each deployable · Test runner: `npm run test` (Vitest) + `npm run lint` + `npm run build`; DB: `supabase db reset` + SQL checks.

## Specs

### Architecture

- **S1 Stack.** "la base de datos y backend este toda en supabase y el frontend en netlify". Frontend is a Vite + React 19 + TypeScript SPA deployed on Netlify (`netlify.toml`, SPA redirect). Database, auth, file storage and server logic live in Supabase: Postgres, Supabase Auth, Row Level Security, Storage, and Edge Functions or SQL RPCs when logic must run server-side. There is no separate Node/Express server.
- **S2 Multi-school isolation.** "un crm para diferentes escuelas de artes marciales". Table `schools` is the tenant. Every school-owned row has a non-null `school_id` FK. RLS is enabled on every table in `public`; a user reads and writes only the rows of schools where they hold a membership. Access checks go through SQL helper functions (`is_school_member(school_id)`, `has_school_role(school_id, roles[])`), defined `security definer` with a fixed `search_path`; policies never copy the logic inline.
- **S3 Profiles and roles.** "con perfiles y todo eso". Revised 2026-11-11 (L5): "Mi cuenta ... se va a loguear como una cuenta "CEO". Normalente los usuarios tendran cuenta de "administrador" y tambien abráb otros de "usuario"."
  - `profiles` is 1:1 with `auth.users` and is created by a trigger on signup.
  - **CEO** is a platform role, stored in `platform_admins(user_id)` and checked by `is_ceo()`. The CEO reads and manages every school, creates schools and invites their administrators. The CEO account is designated outside the repo with `select public.grant_ceo('<email>')`, which only `postgres`/`service_role` can execute. The CEO's email is never committed (S5).
  - **School roles** live in `school_members(user_id, school_id, role)` with role `admin | user`, labelled "Administrador" and "Usuario" in the UI. One user can belong to several schools and switch between them.
  - Administrador: manages everything in their school, including inviting and removing members.
  - Usuario: works with the school's CRM data (students, classes, attendance) but cannot manage members, plans, payments confirmation or school settings. The exact per-module permissions are defined in each module task.
  - A school always keeps at least one Administrador. A guard trigger blocks demoting or removing the last one, except when the school itself is deleted.
  - Accounts are invitation-only, with public signup disabled. Edge Function `invite-member` uses `auth.admin.inviteUserByEmail`: the CEO can invite to any school with any role, an Administrador only to their own school. Students remain CRM records, not accounts.
- **S4 Scalability.** "quiero que sea escalable porque quiero ir agregando y modificando muchas cosas". The rules:
  - Frontend code is organised by feature in `src/modules/<module>/` with `api.ts` (Supabase queries), `hooks.ts` (TanStack Query), `schema.ts` (Zod), `pages/` and `components/`.
  - Each module exports a manifest (routes, nav entry, required roles) registered in `src/modules/registry.ts`. Adding a module touches only its folder plus one registry line.
  - Shared UI lives in `src/ui/` and shared infrastructure in `src/lib/` (Supabase client, auth, active school context).
  - Database changes happen only through timestamped files in `supabase/migrations/`. Generated types live in `src/lib/database.types.ts` (`supabase gen types`).
  - Server state goes through TanStack Query; there is no global store for server data.
- **S5 Secrets.** Only `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` reach the frontend; security comes from RLS. The service role key is never in the repo or the frontend. `.env` is gitignored, and `.env.example` documents the variables. The repo is public.

### Domain (v1 as template)

- **S6 v1 parity, improved.** "usa la v1 como plantilla y mejorala porque habran mas items como esos." v2 covers the v1 modules (source of truth: `jjmillar/martial-crm-backend` `prisma/schema.prisma`), adapted to S2–S4:
  - Students: Chilean name in 4 parts, RUT, gender, birth date, enrollment date, belt + degree, weight, contact, emergency contact, medical notes, avatar, active.
  - Teachers: name, RUT, contact, specialties, active.
  - Plans: name, discipline, price, billing cycle, duration days, sessions per week, class count, trial, default, active.
  - Enrollments: student ↔ plan, status `active | paused | cancelled`, start, ends at.
  - Classes: name, discipline, teacher, tags, room, capacity, level, notes, active. Recurring weekly schedule blocks with day of week, start time and end time.
  - Calendar: day, week and month views derived from schedule blocks.
  - Attendance: class + student + date, present; unique per class/student/date.
  - Payments: amount, method `transferencia | efectivo` (Flow/Webpay later), status `pending | paid | failed | refunded`, receipt, admin confirmation, links to student/enrollment/plan.
  - Settings: personal profile, school profile (logo, address, city, phone, email, description, default calendar view), tag catalog, specialty catalog.
  - Data export.
  - "Improved" is open-ended: each module task may add fields or views, logged in `## Log` and approved by the user before merge.
- **S7 Locale.** UI copy in Spanish (Chile). Money in CLP stored as integer pesos. RUT is validated with its check digit. Dates are shown as `dd-mm-aaaa`, timezone `America/Santiago`.

### UI

- **S8 Design.** "considerar como diseño ui la pagina de submeta.io". Inspiration only, never its brand. The language:
  - Colours: neutral graphite surfaces (`#19191C` base), text `#F4F4F7`, muted `#BABAC2`.
  - Type and labels: one bold grotesque with `-0.02em` tracking on headings; dot + label eyebrows.
  - Shapes and buttons: small radii (controls ~5px, cards ~12px); solid white primary buttons.
  - Layout: bento grids for dashboards; full-bleed photo cards where there are images.
  - Motion: short (opacity, 14–40px, scale .97, ~300ms ease-in-out), disabled under `prefers-reduced-motion`.
  - Themes and accessibility: dark first with a light theme; responsive from 320px with no horizontal scroll; accessible names on controls.
- **S11 Landing + login.** "como es un CRM, crea una landing page para logear en la cuenta".
  - Public route `/` is a landing page presenting the CRM, in the S8 language, with a clear "Ingresar" action. `/login` holds the email + password form, plus "¿Olvidaste tu contraseña?" (reset by email).
  - Authenticated users who open `/` or `/login` are sent to `/app`.
  - Invited users land on `/bienvenida` to set their password.
- **S12 Email (Resend).** "instala altiro resend y vayamos probando todo esto. Porque igualmente se enviaran correos por pagos, informativos, etc.." Auth emails (invite, reset) go out via Resend SMTP with Spanish templates. App emails go through one Edge Function `send-email` with a template registry, and every send is logged in `email_log`.
- **S9 Copyright.** Any footer shows `© <current year>` (2026).

### Quality

- **S10 Checks per task.** `npm run lint`, `npm run build` and `npm run test` pass. Every migration applies cleanly with `supabase db reset`. Each RLS-bearing table gets an isolation check proving that a member of school A cannot read or write school B's rows (assumption: SQL test file under `supabase/tests/`, run with `supabase test db`). Without Docker, `npm run test:db` runs `scripts/db/*.check.mjs` against PGlite with a stubbed `auth` schema; every task that adds tables adds its own `.check.mjs`.

## Tasks

| ID | Task | Specs | Route | Status | Evidence |
|---|---|---|---|---|---|
| T0 | Scaffold: Vite React TS, deps, Vitest, Supabase init, netlify.toml, this doc | S1 S4 S5 | inline (Claude) | done | initial commit |
| T1 | DB foundation (v1 roles; superseded by T1b): `schools`, `profiles`, `school_members`, role enum, helper functions, RLS, signup trigger, `create_school` RPC, isolation tests | S2 S3 S5 S10 | Gentle Shell, risk: escalate (security) → Claude verifies | done | de133f5 + test:db 21/21 |
| T1b | Roles revision: CEO platform role, school roles admin/user, last-admin guard, CEO-only create_school, grant_ceo; update checks | S2 S3 S5 S10 | Gentle Shell, risk: escalate → Claude verifies | done | 979100d + test:db 34/34 |
| T2 | App shell: Supabase client, auth (login, signup, password reset), protected routes, active-school context + switcher, module registry, layout (sidebar/dock), design tokens, CEO "Escuelas" page (create school, list) | S1 S3 S4 S8 S9 | Gentle Shell (part 1) + Claude | done | e72b075 (GS) + T2 commit; lint 0 errors, 8 tests, build ok |
| T2b | Landing page `/`, `/login`, password reset, `/bienvenida` (done in T2) + Edge Function `invite-member` + Miembros page | S3 S8 S11 | Gentle Shell (function) + Claude | done | 47d5931; test:db 40/40; landing/login screenshots 1440/390 |
| T3 | Catalogs: specialties + tags (DB + module) | S6 | Claude (Gentle Shell hit quota) | done | migration 20261112000001; Ajustes → Catálogos; browser QA |
| T4 | Students module | S6 S7 | Claude (Gentle Shell hit quota) | done | test:db 74/74 (25 new); 17 unit tests; browser QA 1440/390 on live DB with temp data, deleted |
| T5 | Teachers module | S6 | Claude (Gentle Shell skipped: quota) | done | migration 20261112000002; test:db 94/94 (20 new); 19 unit tests; browser QA as CEO + user role, 1440/390 |
| T6 | Plans module | S6 S7 | Claude | done | migration 20261112000003; test:db 112/112 (18 new); 25 unit tests; browser QA CEO + user role, 1440/390 |
| T7 | Enrollments module | S6 | Claude | done | migration 20261112000004; test:db 125/125 (13 new); browser QA at 390 as user role |
| T8 | Classes + schedule blocks | S6 | Claude | done | migration 20261112000005; test:db 146/146 (21 new); browser QA at 390 |
| T9 | Calendar (day/week/month) | S6 | Claude | done | frontend only; browser QA 390 + 1440 |
| T10 | Attendance | S6 | Claude | done | migration 20261112000006; test:db 158/158 (12 new); browser QA at 390 as user role |
| T11 | Payments (transfer/cash + admin confirmation) | S6 S7 S12 | Claude | done | migrations 20261112000007–09; test:db 178/178 (20 new); live storage + email QA |
| T12 | Settings: profile, school profile, logo upload (Storage), member invitations | S3 S6 | Claude | done | live logo upload (public URL 200); browser QA as CEO + user role |
| T13 | Dashboard (bento) + data export | S6 S8 | Claude | done | browser QA CEO + user (no money for users); 4 CSV downloads verified |
| T14 | Deploy: link Supabase project, push migrations, Netlify env vars | S1 S5 | Claude + user | done | Supabase `hjeholicsijqurubuntv` (sa-east-1); https://martialcrm-v2.netlify.app; live smoke test ok |
| T15 | Resend: SMTP for auth + Spanish templates, `_shared/email.ts`, `send-email` (template `test`), `email_log` + RLS, Ajustes → Correos | S12 S5 | Claude + user | done (sender `onboarding@resend.dev` until the user has a domain) | test:db 49/49; live recovery email via Resend SMTP: HTTP 200 |

## Log

- **L1 (2026-11-10, user, verbatim):** "Quiero pasar a una version 2.0 de ese proyecto, creandolo desde 0 con ODD de Gentle Shell a traves de ti. Quiero crear un crm para diferentes escuelas de artes marciales, con perfiles y todo eso. Ademas quiero que sea escalable porquie quiero ir agregabdo y modificando muchas cosas. Tambien considerar como diseño ui la pagina de submeta.io. La idea es que la base de datos y backend este toda en supabase y el frontend en netlify."
- **L2 (2026-11-10, user answers):**
  - Repo: "Público".
  - Frontend: "Vite + React + TS".
  - Supabase: "Proyecto nuevo".
  - Scope: "usa la v1 como plantilla y mejorala porque habran mas items como esos."
- **L3 (Claude):** Route rationale. Gentle Shell runs on the free Gemini tier with read/edit/write tools only (no shell), so:
  - Claude does the scaffold and tooling (T0) and the deploy (T14).
  - Gentle Shell gets one small module pedido at a time, referencing this doc.
  - Claude reviews every diff and runs lint/build/test before applying. T1 is security-critical, so Claude independently verifies its RLS.
  - If Gentle Shell fails on quota, Claude implements the unit and logs it here.
- **L4 (2026-11-10, Claude): T1 verification.**
  - Gentle Shell (attempt 3, 52s) wrote the migration and the pgTAP file.
  - Independent PGlite checks: 21/21 pass. Covered: school isolation, anon blocked, slug rules, admin cannot create/demote/remove an owner or delete the school, profile visibility only across shared schools, RLS on every table.
  - Claude fixed three pgTAP bugs: anon error is `42501` (no EXECUTE grant), not `P0001`; `update … returning` inside a subquery is invalid SQL; A cannot read school B's id under RLS, so it is captured as superuser first.
  - Open finding, not fixed (no spec covers it): an owner can demote or remove themselves, leaving a school with no owner. Proposed follow-up is a "last owner" guard trigger, pending user decision.
  - Next: T2 app shell.
- **L5 (2026-11-11, user, verbatim):** "crea tu todo, incluido el push y todo. La idea tambien como es un CRM, crea una landing page para logear en la cuenta. Mi cuenta, de correo [correo del usuario, omitido: repo público], se va a loguear como una cuenta "CEO". Normalente los usuarios tendran cuenta de "administrador" y tambien abráb otros de "usuario"."
  - Effect: S3 rewritten, S11 added, T1b and T2b added, and the last-admin guard accepted ("crea tu todo").
  - The user's email is redacted from this public log (privacy over verbatim). It is not used in code or migrations: the CEO is granted from the live database (S5).
  - T1's migration was never deployed, so T1b edits it in place instead of stacking an alter migration.
- **L6 (2026-11-11, Claude): T1b verification.**
  - Gentle Shell (attempt 3, 58s) rewrote the migration. PGlite checks 34/34 pass. Covered: CEO via `grant_ceo` (superuser only, case-insensitive), CEO-only school creation, isolation, admin vs user limits, last-admin guard including CEO, and cascade delete of a school passing the guard.
  - Claude fixed the pgTAP file again: the CEO inserted into `schools` directly, which RLS forbids. It now uses `create_school`.
  - The pgTAP files have not been executed (no Docker); the PGlite checks are the executed evidence.
  - `supabase/config.toml`: `enable_signup = false` (invite-only, S3), local site URL set to Vite's port.
- **L7 (2026-11-11, Claude): T2 route change.**
  - Gentle Shell wrote `src/lib/{supabase,database.types,auth,school}.ts(x)` and `src/modules/types.ts` across two pedidos. Each pedido was cut by the Gemini free-tier per-minute input token quota (250k) after about 2 files.
  - Per the L3 fallback, Claude wrote the rest: router, guards, layout, Inicio and Escuelas modules, landing, login, bienvenida, design tokens, and tests.
  - Review fixes to Gentle Shell's code:
    - The profile/CEO lookup inside `onAuthStateChange` is deferred, as Supabase recommends, to avoid a deadlock.
    - The school reload depends on the user id, so token refreshes do not refetch.
    - A missing Supabase env no longer crashes the landing page.
  - Next: Edge Function `invite-member` and the Miembros page, then T14 deploy.
- **L8 (2026-11-11, Claude): T2b.**
  - Gentle Shell wrote `invite-member`. Its run ended with "Incomplete JSON segment", but the file was complete.
  - Claude's fixes and additions:
    - Removed an `any`.
    - A lookup error no longer falls through to sending a second invitation.
    - Added migration `20261111000001_members.sql`: `profiles.email` mirror and the service-only `find_user_id_by_email`, with 6/6 checks.
    - Added the Miembros page: invite, change role, remove with inline confirmation; last-admin errors are shown in Spanish.
  - Next: T14 deploy, which needs the user's `supabase login` and `netlify login`.
- **L9 (2026-11-11, user): "todo listo e instalado"** (after logging in to the Supabase and Netlify CLIs).
  - Claude did T14:
    - Created the Supabase project `martial-crm-v2` (sa-east-1). The DB password is kept outside the repo.
    - Pushed both migrations and the auth config: invite-only, `site_url` = Netlify, redirect wildcards.
    - Deployed `invite-member` with the `SITE_URL` secret.
    - Created the Netlify site `martialcrm-v2` with `VITE_SUPABASE_*` env vars and deployed it with the CLI.
  - The CEO account was invited and `grant_ceo` was run from a script outside the repo. The email is not recorded here.
  - Live smoke test with a temporary user, deleted afterwards:
    - Sign-in works and public sign-up is blocked.
    - A user who is not a member sees 0 schools; `is_ceo` returns false; `create_school` is refused.
    - `invite-member` returns 403 for someone who is not an admin.
  - Next: T3+ modules.
- **L10 (2026-11-11, user): "instala altiro resend y vayamos probando todo esto. Porque igualmente se enviaran correos por pagos, informativos, etc.. asi vamos testeando altiro."**
  - Effect: S12 and T15 were added. The Ajustes module (T12) starts with its Correos section.
  - Claude implemented it without Gentle Shell because the user asked for it right away ("altiro"), and Gemini's quota cuts long pedidos.
  - The migration has 9 new checks, so test:db passes 49/49.
  - Blocked on the user: create a Resend account and an API key. A verified domain is needed before emails can go to people other than the account owner.
- **L11 (2026-11-11, user): "no tengo dominio propio aun" / "listo lo de la api"**
  - The Resend key (sending-only) is stored outside the repo.
  - Secrets set: `RESEND_API_KEY` and `EMAIL_FROM`, which is `onboarding@resend.dev` for now.
  - `config push` enabled the SMTP and the Spanish invite, recovery and magic-link templates.
  - A live recovery email was sent to the CEO.
  - Limitation: until a domain is verified in Resend, emails can only go to the Resend account owner.
  - Next: the user checks the email and the Ajustes → Correos test; then T3+.
- **L12 (2026-11-11, user): "listo entré y todo bien"**
  - The user confirmed CEO login and the email flow, so Claude continued with T3 and T4.
  - Gentle Shell was asked for the migration and failed 3 times on Gemini's free quota (429, 250k input tokens/min), leaving no changes. Claude wrote it.
  - One bug was caught by the PGlite checks: `concat_ws` is not immutable, so the generated `full_name` column now uses `||`.
  - Built:
    - `rut_is_valid` (modulo 11), with the RUT unique per school.
    - `prevent_school_change` trigger on all three tables.
    - Users can create and edit students; only admins delete them.
    - Catalogs are managed by admins only.
  - Architecture:
    - Types are now generated (`database.generated.ts`), and `database.types.ts` only holds aliases (S4).
    - Module routes are mounted as `<path>/*`, so a module owns its own sub-routes.
    - Shared styles (`.tag`, `.btn--danger`, `.chips`, `.sr-only`) moved to `index.css`.
  - "Improved" over v1 (S6):
    - Accent-insensitive search by name, RUT or email.
    - Active/inactive/all filter with counts.
    - Belt colour swatch; age and years in the school.
    - Inline field errors in Spanish; RUT formatted on blur.
  - Browser QA found and fixed:
    - The header row lost to `.page-head` in the CSS cascade.
    - The mobile shell spread spare height into the top bar.
    - RUT and weight were shown unformatted in the edit form.
  - Next: T5 Profesores (uses specialties).
- **L13 (2026-11-11, user): "Por UX, quiero que en el menu de escuelas, solo salga el cuadro grande de "nueva escuela" cuando no aya ninguna escuela creada, y despues que solo salga por ahi con in circulo blanco con el signo +."**
  - Escuelas page:
    - With no schools, the page is just the big "Nueva escuela" card.
    - With schools, the list is full width and a round white "+" button (`.fab`) opens the same form in a native `<dialog>` (`.modal`).
    - The dialog has autofocus and closes with Escape, Cancelar or a backdrop click; the form is empty on every open.
    - The form was extracted to `SchoolForm.tsx`.
  - `.fab`, `.modal` and `.page-head--row` are now shared styles for other modules.
  - Bug found in QA: `SchoolProvider.reload()` set the global `loading` flag, so `RequireRole` unmounted the page and the "escuela creada" notice was lost (this also happened before the change). Now only the first load for a user blocks the UI.
  - QA used a temporary CEO; the temporary user and schools were deleted afterwards.
  - Noted, not done: with 6+ modules the mobile dock overflows (CEO view). Proposal: a "Más" sheet.
- **L14 (2026-11-11, user): "si, haz el boton Más y despues sigue con profesores"**
  - Mobile dock:
    - `MobileDock.tsx` shows the first 4 modules plus "Más".
    - "Más" opens a bottom sheet (native `<dialog>`) with the remaining modules, the account and Salir.
    - The sheet closes on navigation, Escape, the close button or a backdrop click; "Más" is highlighted when the current route is inside it.
    - The dock no longer scrolls horizontally; items are flex 1.
  - QA as a temporary CEO at 390 and 320 px: no overflow, and logout from the sheet works.
- **L15 (2026-11-11, Claude): T5 Profesores.**
  - Gentle Shell was not tried after 4 straight quota failures.
  - DB:
    - `teachers` (name, RUT, contact, belt/degree, bio, optional `user_id` that must be a school member, active).
    - `teacher_specialties` join with composite FKs `(id, school_id)`, so cross-school links are impossible.
    - `set_teacher_specialties` RPC, security invoker, so RLS applies.
    - Removing a member unlinks their teacher record.
    - Members read; admins write.
  - UI:
    - Card grid with search, specialty filter and an inactive toggle.
    - Form with specialty pick-chips and a linked-account select that hides accounts already linked.
    - Users get a read-only form (disabled fieldset).
  - Shared refactor:
    - `src/ui/patterns.css` (toolbar, search, segmented, empty, avatar, belt, forms, pick-chips).
    - `src/lib/belts.ts`.
    - Alumnos also uses the round "+" once it has data (consistent with L13).
    - A mobile `.belt` offset was leaking out of alumnos.css; it is now scoped.
  - QA incident: a reused state file made cleanup miss the temporary CEO. It was found and deleted with a pattern sweep (`qa-*@example.com`, `qa-*` slugs). Live DB afterwards: 1 user, 1 platform admin.
  - Next: T6 Planes.
- **L16 (2026-11-11, user): "sigue con los planes, crearlos, editarlos, etc..."**
  - DB:
    - `billing_cycle` enum: mensual, trimestral, semestral, anual, unico.
    - `plans`:
      - CLP integers: price and enrollment_fee (matrícula).
      - Duration, sessions per week, class pack, description.
      - Flags: trial, default, active.
      - Discipline is a same-school specialty through a composite FK, set to null when the specialty is deleted.
    - Only one default plan per school (partial unique index plus a trigger that unmarks the previous one); the default cannot be inactive.
    - Members read; admins write.
  - UI:
    - Pricing-card grid with a default badge and an inactive toggle.
    - Editor:
      - Cycle segmented control that auto-fills the duration until it is edited by hand.
      - CLP formatting on blur and a sticky live preview card.
      - Duplicate action (copy is never default).
      - The default plan cannot be deactivated or deleted from the UI.
    - Read-only for users.
  - Shared:
    - `lib/money.ts` (formatCLP/parseCLP).
    - `.field` uses `align-content: start`, which fixes inputs misaligned when sibling hints differ in height (all forms).
  - QA used an isolated temporary environment with its own state file, then a pattern sweep. Live DB afterwards: 1 user, 1 platform admin.
  - Next: T7 Matrículas (students ↔ plans).
- **L17 (2026-11-11, user): "Voy a salir de este computador y quiero que implementes todo lo que tengas que implementar mientras no estoy y despues testeo mientras vayas comiteando voy testeando en mi celular. Asi que implementa todo lo necesario."**
  - Effect: Claude works through T7–T13 autonomously. Each module is committed, deployed and announced on Telegram so the user can test on the phone.
  - T7 Matrículas:
    - DB:
      - Price and fee are snapshotted at enrollment time.
      - Composite FKs to the student and plan of the same school; a plan with enrollments cannot be deleted.
      - One active enrollment per student and plan.
      - `set_created_by` trigger (no spoofing).
      - Members create and update; admins delete.
    - UI:
      - List with derived phases (vigente / por vencer ≤7 d / vencida / pausada / cancelada) and search.
      - New form preselects the default plan and auto-fills price, fee and end date.
      - Detail: renew (extends from the current end, or from today if expired), pause, reactivate and cancel.
      - The student page shows the student's enrollments plus a "Matricular" shortcut.
  - T8 Clases:
    - DB:
      - `classes`: discipline and teacher via composite FKs, a `class_level` enum, colour, capacity, room.
      - `class_tags` join table.
      - `class_schedules` (ISO weekday, start/end, end > start).
      - A btree_gist exclusion constraint stops the same teacher from having overlapping blocks; the teacher is kept in sync by triggers, including when a class's teacher is reassigned.
      - `set_class_details` saves tags and blocks atomically and refuses non-admins explicitly.
      - The PGlite harness now loads btree_gist and an `extensions` schema.
    - UI:
      - Class cards with a colour stripe, slot chips and tags; filter by weekday and search.
      - Editor with a colour swatch picker, editable weekly blocks and tag pick-chips.
      - A brand-new class whose schedule fails is rolled back.
  - T9 Calendario (frontend only, derived from active classes' weekly blocks):
    - View and date live in the URL; the default view comes from `schools.default_calendar_view`.
    - Desktop week is an hour grid with colour blocks; phones get a 7-day agenda.
    - Day view lists the classes; month view shows colour dots per day, and tapping a day opens the day view.
    - Every class links to "Asistencia" for that date.
    - New date helpers `startOfWeek`, `monthGrid` and `longDate`, with tests.
  - T10 Asistencia:
    - DB: `attendance` (one row = present), unique per class/student/date, composite FKs, no dates more than 1 day ahead, `created_by` trigger; any member marks and unmarks.
    - Also dropped `teachers_id_school_unique`, a duplicate constraint added in T8.
    - UI:
      - Date stepper, then the classes scheduled that weekday, plus "Otra clase".
      - Roster shows students with a current enrollment first; "Todos los alumnos" and search reveal the rest.
      - One-tap optimistic toggles with rollback, and a present count against capacity.
      - Calendar slots deep-link here with the class and date.
  - T11 Pagos:
    - DB:
      - Enums `payment_method` and `payment_status`; `payments` stores CLP integers.
      - Users can insert only 'pendiente'; admins update, confirm and delete.
      - A trigger stamps `paid_at`/`confirmed_by` on confirmation and clears them when the payment goes back.
      - Students with payments can't be deleted (FK restrict); deleting an enrollment sets the link to null.
    - Storage migration (skipped by PGlite, verified live):
      - Private `receipts` bucket under `<school>/<payment>/`; public `logos` bucket.
      - Policies check membership through `storage_school_id(name)`.
    - Bug found in live QA: user-role receipts never got linked, because payments UPDATE is admin-only and the error was swallowed.
      - Fix: the receipt is uploaded first under a client-generated id, and the payment is inserted already linked.
      - The narrow `attach_payment_receipt` RPC lets members attach while the payment is pending or has no receipt; admins always.
    - `send-email` gained a `payment_receipt` template (admin only, confirmed payments, sent to the student's email).
      - Verified live: built, sent and logged. Resend rejected example.com as expected while there is no domain.
    - UI:
      - KPIs (collected this month in Santiago time, pending) and status filters.
      - New form prefills from the enrollment (instalment or matrícula fee), with method and receipt upload.
      - Detail: confirm, mark failed, refund, back to pending; signed-URL receipt viewer; email receipt.
      - Payments section on the student page.
  - T12 Ajustes / Mi cuenta:
    - Ajustes gained an "Escuela" section: name, city, address, phone, email, description, default calendar view, and a logo in the public `logos` bucket (the old file is removed).
    - New "Mi cuenta" module for all roles: name, phone, password change (Spanish errors for same-password and weak), theme, and my schools with role.
    - Bug found in QA: every Supabase auth event (incl. the hourly TOKEN_REFRESHED and USER_UPDATED after a password change) re-ran the profile load with `loading=true`, so RequireAuth unmounted the app and wiped any half-filled form.
      - Fix: only a different user blocks the UI; other events refresh in the background.
      - Added `reloadProfile()`.
    - Member invitations already live in Miembros (T2b).
  - T13 Dashboard + export:
    - Inicio is a bento with:
      - Active students (+ new this month), current enrollments (+ expired), attendance this week.
      - Collected this month and pending confirmation (admin/CEO only; users see no money).
      - Today's classes with an attendance shortcut, and enrollments expiring within 7 days with a renew shortcut.
      - Stat tiles pair up on phones.
    - Ajustes → Exportar datos: CSV (`;`, BOM, CRLF) for students, enrollments, payments and attendance; opens directly in Excel (es-CL). `lib/csv.ts` has tests.
  - Close of L17:
    - All tasks T0–T14 are done. Totals: test:db 178/178 across 10 check files, 32 unit tests, lint 0 errors, build ok.
    - QA data swept, including storage files. Live DB afterwards: 1 user, 1 platform admin, 1 school.
    - Pending on the user:
      - Buy and verify a domain in Resend, so emails reach anyone (now only the owner).
      - Optional: link the Netlify site to GitHub for auto-deploys.
