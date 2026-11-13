# Martial CRM

CRM for martial arts academies: students, classes, attendance, payments and a public page per school. Spanish UI, mobile first.

## Stack

- **Next.js 16** (App Router) + **React 19** + **TypeScript**, hosted on **Netlify** (official Next.js adapter).
- **Supabase**: Postgres with RLS (per-customer isolation), SQL functions, Auth, Storage, Edge Functions (`supabase/functions`), pg_cron.
- TanStack Query for server data, Zod for validation, AutoAnimate for list motion. Plain CSS with tokens, no UI framework.

## How it is put together

| Folder | What lives there |
|---|---|
| `app/` | Routes only (Next.js). `(public)/` holds the visitor pages, `app/` the signed-in app. |
| `src/shell/` | App frame: sidebar, mobile menu, auth/role guards, `ModulePage`. |
| `src/modules/<name>/` | One folder per section (screens, `api.ts`, CSS). `modules/registry.ts` lists them for the menu and their allowed roles. |
| `src/screens/` | Public screens: home, login, sign-up, and the school page (`screens/escuela`). |
| `src/ui/` | Shared components and the motion system. |
| `src/lib/` | Session, active school, Supabase client, helpers. `lib/nav.tsx` is the navigation API every screen uses (Link, NavLink, useNavigate…) on top of Next.js. |

Rendering:
- **Public pages** are rendered on the server.
- **The school page** (`/e/<slug>`) loads its data on the server, so Google and WhatsApp previews see the full page with title, description and photo.
- **The signed-in app** renders in the browser; its data and permissions come from Supabase.

Rules for new work: see [`docs/ui-standards.md`](docs/ui-standards.md) (motion and toggles). All stylesheets are imported once in `app/layout.tsx` in a fixed order; add new ones there, not inside components.

## Commands

```bash
npm run dev        # local development (http://localhost:3000)
npm run build      # production build
npm run lint       # ESLint (includes the UI standards)
npm test           # unit tests (Vitest)
npm run test:db    # database checks (RLS and SQL functions) on an in-memory Postgres
```

Environment: `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` (the old `VITE_` names are accepted too). See `.env.example`.
