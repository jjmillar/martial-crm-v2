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
- **S9 Copyright.** Any footer shows `© <current year>` (2026).

### Quality

- **S10 Checks per task.** `npm run lint`, `npm run build` and `npm run test` pass. Every migration applies cleanly with `supabase db reset`. Each RLS-bearing table gets an isolation check proving that a member of school A cannot read or write school B's rows (assumption: SQL test file under `supabase/tests/`, run with `supabase test db`). Without Docker, `npm run test:db` runs `scripts/db/*.check.mjs` against PGlite with a stubbed `auth` schema; every task that adds tables adds its own `.check.mjs`.

## Tasks

| ID | Task | Specs | Route | Status | Evidence |
|---|---|---|---|---|---|
| T0 | Scaffold: Vite React TS, deps, Vitest, Supabase init, netlify.toml, this doc | S1 S4 S5 | inline (Claude) | done | initial commit |
| T1 | DB foundation (v1 roles; superseded by T1b): `schools`, `profiles`, `school_members`, role enum, helper functions, RLS, signup trigger, `create_school` RPC, isolation tests | S2 S3 S5 S10 | Gentle Shell, risk: escalate (security) → Claude verifies | done | de133f5 + test:db 21/21 |
| T1b | Roles revision: CEO platform role, school roles admin/user, last-admin guard, CEO-only create_school, grant_ceo; update checks | S2 S3 S5 S10 | Gentle Shell, risk: escalate → Claude verifies | done | 979100d + test:db 34/34 |
| T2 | App shell: Supabase client, auth (login, signup, password reset), protected routes, active-school context + switcher, module registry, layout (sidebar/dock), design tokens, CEO "Escuelas" page (create school, list) | S1 S3 S4 S8 S9 | Gentle Shell | pending | |
| T2b | Landing page `/`, `/login`, password reset, `/bienvenida`, Edge Function `invite-member` + members page | S3 S8 S11 | Gentle Shell | pending | |
| T3 | Catalogs: specialties + tags (DB + module) | S6 | Gentle Shell | pending | |
| T4 | Students module | S6 S7 | Gentle Shell | pending | |
| T5 | Teachers module | S6 | Gentle Shell | pending | |
| T6 | Plans module | S6 S7 | Gentle Shell | pending | |
| T7 | Enrollments module | S6 | Gentle Shell | pending | |
| T8 | Classes + schedule blocks | S6 | Gentle Shell | pending | |
| T9 | Calendar (day/week/month) | S6 | Gentle Shell | pending | |
| T10 | Attendance | S6 | Gentle Shell | pending | |
| T11 | Payments (transfer/cash + admin confirmation) | S6 S7 | Gentle Shell | pending | |
| T12 | Settings: profile, school profile, logo upload (Storage), member invitations | S3 S6 | Gentle Shell | pending | |
| T13 | Dashboard (bento) + data export | S6 S8 | Gentle Shell | pending | |
| T14 | Deploy: link Supabase project, push migrations, Netlify env vars | S1 S5 | Claude + user | blocked: waits for the user to run `supabase login` and `netlify login` (Claude creates both projects) | |

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
