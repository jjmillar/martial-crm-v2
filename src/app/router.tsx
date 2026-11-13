import { createBrowserRouter, Navigate, Outlet } from 'react-router-dom'
import { PageMotion } from '../ui/PageMotion'
import { modules } from '../modules/registry'
import { Landing } from '../pages/Landing'
import { Login } from '../pages/Login'
import { Bienvenida } from '../pages/Bienvenida'
import { Registro } from '../pages/Registro'
import { SchoolLanding } from '../pages/escuela/SchoolLanding'
import { SchoolLogin, SchoolSignup } from '../pages/escuela/SchoolAuth'
import { NotFound } from '../pages/NotFound'
import { AppLayout } from './AppLayout'
import { RequireAuth } from './RequireAuth'
import { RequireRole } from './RequireRole'
import { RedirectIfAuthed } from './RedirectIfAuthed'

export const router = createBrowserRouter([
  {
    // Public pages share the standard page transition (the app shell has its own inside AppLayout).
    element: <PageMotion><Outlet /></PageMotion>,
    children: [
      { path: '/', element: <RedirectIfAuthed><Landing /></RedirectIfAuthed> },
      { path: '/login', element: <RedirectIfAuthed><Login /></RedirectIfAuthed> },
      { path: '/bienvenida', element: <Bienvenida /> },
      { path: '/registro', element: <RedirectIfAuthed><Registro /></RedirectIfAuthed> },
      // Public page of each school, with its own student login and sign-up.
      { path: '/e/:slug', element: <SchoolLanding /> },
      { path: '/e/:slug/registro', element: <SchoolSignup /> },
      { path: '/e/:slug/ingresar', element: <SchoolLogin /> },
      { path: '*', element: <NotFound /> },
    ],
  },
  {
    path: '/app',
    element: <RequireAuth><AppLayout /></RequireAuth>,
    children: [
      { index: true, element: <Navigate to="inicio" replace /> },
      // Each module registers its own route (S4): adding a module never edits this file.
      // `/*` lets a module own sub-routes (list, new, detail) with its own <Routes>.
      ...modules.map((m) => ({ path: `${m.path}/*`, element: <RequireRole roles={m.roles}>{m.element}</RequireRole> })),
    ],
  },
])
