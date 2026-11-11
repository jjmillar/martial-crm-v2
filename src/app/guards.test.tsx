import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { RequireAuth } from './RequireAuth'
import { RequireRole } from './RequireRole'
import { modulesFor } from '../modules/registry'

const auth = { session: null as unknown, loading: false }
const school = { role: null as 'ceo' | 'admin' | 'user' | null, loading: false }
vi.mock('../lib/auth', () => ({ useAuth: () => auth }))
vi.mock('../lib/school', () => ({ useSchool: () => school }))
vi.mock('../lib/supabase', () => ({ supabase: {}, supabaseConfigured: true, configError: '' }))

beforeEach(() => { auth.session = null; auth.loading = false; school.role = null })

function renderAt(path: string, el: React.ReactNode) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/login" element={<p>pantalla login</p>} />
        <Route path="/app" element={el} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('RequireAuth', () => {
  it('redirects to /login without a session', () => {
    renderAt('/app', <RequireAuth><p>privado</p></RequireAuth>)
    expect(screen.getByText('pantalla login')).toBeInTheDocument()
  })
  it('renders children with a session', () => {
    auth.session = { user: { id: 'u1' } }
    renderAt('/app', <RequireAuth><p>privado</p></RequireAuth>)
    expect(screen.getByText('privado')).toBeInTheDocument()
  })
})

describe('RequireRole', () => {
  it('blocks a user from a CEO-only section', () => {
    school.role = 'user'
    renderAt('/app', <RequireRole roles={['ceo']}><p>escuelas</p></RequireRole>)
    expect(screen.getByText('No tienes acceso a esta sección.')).toBeInTheDocument()
  })
  it('lets the CEO in', () => {
    school.role = 'ceo'
    renderAt('/app', <RequireRole roles={['ceo']}><p>escuelas</p></RequireRole>)
    expect(screen.getByText('escuelas')).toBeInTheDocument()
  })
})

describe('modulesFor', () => {
  it('shows Escuelas only to the CEO', () => {
    expect(modulesFor('ceo').map((m) => m.id)).toContain('escuelas')
    expect(modulesFor('admin').map((m) => m.id)).not.toContain('escuelas')
    expect(modulesFor(null)).toEqual([])
  })
})
