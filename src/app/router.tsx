import { createBrowserRouter, Navigate } from 'react-router-dom'
import { modules } from '../modules/registry'
import { Landing } from '../pages/Landing'
import { Login } from '../pages/Login'
import { Bienvenida } from '../pages/Bienvenida'
import { NotFound } from '../pages/NotFound'
import { AppLayout } from './AppLayout'
import { RequireAuth } from './RequireAuth'
import { RequireRole } from './RequireRole'
import { RedirectIfAuthed } from './RedirectIfAuthed'

export const router = createBrowserRouter([
  { path: '/', element: <RedirectIfAuthed><Landing /></RedirectIfAuthed> },
  { path: '/login', element: <RedirectIfAuthed><Login /></RedirectIfAuthed> },
  { path: '/bienvenida', element: <Bienvenida /> },
  {
    path: '/app',
    element: <RequireAuth><AppLayout /></RequireAuth>,
    children: [
      { index: true, element: <Navigate to="inicio" replace /> },
      // Each module registers its own route (S4): adding a module never edits this file.
      ...modules.map((m) => ({ path: m.path, element: <RequireRole roles={m.roles}>{m.element}</RequireRole> })),
    ],
  },
  { path: '*', element: <NotFound /> },
])
