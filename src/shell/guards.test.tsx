import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { RequireAuth } from './RequireAuth'
import { RequireRole } from './RequireRole'
import { resolvePath } from '../lib/nav'
import { modulesFor } from '../modules/registry'

const auth = { session: null as unknown, loading: false }
const school = { role: null as 'ceo' | 'admin' | 'user' | 'alumno' | null, loading: false }
const router = { push: vi.fn(), replace: vi.fn(), back: vi.fn(), forward: vi.fn() }
vi.mock('../lib/auth', () => ({ useAuth: () => auth }))
vi.mock('../lib/school', () => ({ useSchool: () => school }))
vi.mock('../lib/supabase', () => ({ supabase: {}, supabaseConfigured: true, configError: '' }))
vi.mock('next/navigation', () => ({
  useRouter: () => router,
  usePathname: () => '/app/escuelas',
  useSearchParams: () => new URLSearchParams(),
  useParams: () => ({}),
}))

beforeEach(() => {
  auth.session = null; auth.loading = false; school.role = null; router.replace.mockClear()
  // Each test starts after any earlier navigation has settled (nav.tsx remembers in-flight navigations for 3 s).
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(Date.now() + 60_000))
})

const renderAt = (el: React.ReactNode) => render(<>{el}</>)

describe('RequireAuth', () => {
  it('redirects to /login without a session', () => {
    renderAt(<RequireAuth><p>privado</p></RequireAuth>)
    expect(screen.queryByText('privado')).toBeNull()
    expect(router.replace).toHaveBeenCalledWith('/login')
  })
  it('redirects only once even if it re-renders (keeps "come back to" intact)', () => {
    const { rerender } = renderAt(<RequireAuth><p>privado</p></RequireAuth>)
    rerender(<RequireAuth><p>privado</p></RequireAuth>)
    rerender(<RequireAuth><p>privado</p></RequireAuth>)
    expect(router.replace).toHaveBeenCalledTimes(1)
  })
  it('renders children with a session', () => {
    auth.session = { user: { id: 'u1' } }
    renderAt(<RequireAuth><p>privado</p></RequireAuth>)
    expect(screen.getByText('privado')).toBeInTheDocument()
    expect(router.replace).not.toHaveBeenCalled()
  })
})

describe('resolvePath (relative links)', () => {
  it('works like the screens expect', () => {
    expect(resolvePath('..', '/app/alumnos/123')).toBe('/app/alumnos')
    expect(resolvePath('nuevo', '/app/alumnos')).toBe('/app/alumnos/nuevo')
    expect(resolvePath('../nuevo', '/app/planes/abc')).toBe('/app/planes/nuevo')
    expect(resolvePath('/app/tareas', '/app/x')).toBe('/app/tareas')
    expect(resolvePath('?vista=mes', '/app/calendario')).toBe('/app/calendario?vista=mes')
    expect(resolvePath('#landing', '/app/ajustes')).toBe('/app/ajustes#landing')
  })
})

describe('RequireRole', () => {
  it('blocks a user from a CEO-only section', () => {
    school.role = 'user'
    renderAt(<RequireRole roles={['ceo']}><p>escuelas</p></RequireRole>)
    expect(screen.getByText('No tienes acceso a esta sección.')).toBeInTheDocument()
  })
  it('lets the CEO in', () => {
    school.role = 'ceo'
    renderAt(<RequireRole roles={['ceo']}><p>escuelas</p></RequireRole>)
    expect(screen.getByText('escuelas')).toBeInTheDocument()
  })
})

describe('modulesFor', () => {
  it('shows Escuelas only to the CEO', () => {
    expect(modulesFor('ceo').map((m) => m.id)).toContain('escuelas')
    expect(modulesFor('admin').map((m) => m.id)).not.toContain('escuelas')
    expect(modulesFor(null)).toEqual([])
  })
  it('puts Mi cuenta inside Ajustes for every role and shows Tareas to staff only', () => {
    for (const r of ['ceo', 'admin', 'user', 'alumno'] as const) {
      const ids = modulesFor(r).map((m) => m.id)
      expect(ids).toContain('ajustes')
      expect(ids).not.toContain('cuenta')
      expect(ids).not.toContain('pendientes')
      expect(ids.includes('tareas')).toBe(r !== 'alumno')
    }
  })
})
