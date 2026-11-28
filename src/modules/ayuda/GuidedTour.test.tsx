import { act, fireEvent, render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { GuidedTour, TourView } from './GuidedTour'
import { readTour, writeTour } from './tour'

const school = { role: 'ceo' as string | null, loading: false, schools: [] as { id: string }[], activeSchool: null as { id: string } | null }
const router = { push: vi.fn(), replace: vi.fn(), back: vi.fn(), forward: vi.fn() }
vi.mock('../../lib/auth', () => ({ useAuth: () => ({ user: { id: 'u1' } }) }))
vi.mock('../../lib/school', () => ({ useSchool: () => school }))
vi.mock('../../lib/supabase', () => ({ supabase: {}, supabaseConfigured: true, configError: '' }))
vi.mock('../clases/api', () => ({ classesKey: (id?: string) => ['classes', id], listClasses: async () => [] }))
vi.mock('../profesores/api', () => ({ teachersKey: (id?: string) => ['teachers', id], listTeachers: async () => [] }))
vi.mock('../planes/api', () => ({ plansKey: (id?: string) => ['plans', id], listPlans: async () => [] }))
vi.mock('next/navigation', () => ({
  useRouter: () => router,
  usePathname: () => '/app/inicio',
  useSearchParams: () => new URLSearchParams(),
  useParams: () => ({}),
}))

const wrap = (el: React.ReactNode) => render(<QueryClientProvider client={new QueryClient()}>{el}</QueryClientProvider>)

beforeEach(() => {
  localStorage.clear()
  school.role = 'ceo'; school.schools = []; school.activeSchool = null
  router.push.mockClear()
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(Date.now() + 60_000))
})

describe('GuidedTour', () => {
  it('starts by itself for a brand-new CEO and can be skipped for good', async () => {
    wrap(<GuidedTour />)
    expect(await screen.findByRole('heading', { name: 'Armemos tu escuela' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Lo hago solo' }))
    expect(readTour('u1')?.status).toBe('skipped')
    expect(screen.queryByRole('heading', { name: 'Armemos tu escuela' })).toBeNull()
  })

  it('does not start for a customer who already has a school', () => {
    school.schools = [{ id: 's1' }]; school.activeSchool = { id: 's1' }
    wrap(<GuidedTour />)
    expect(screen.queryByRole('region', { name: 'Recorrido guiado' })).toBeNull()
    expect(readTour('u1')).toBeNull()
  })

  it('never shows to a student, even when replayed', () => {
    school.role = 'alumno'
    writeTour('u1', { status: 'active', step: 'intro' })
    wrap(<GuidedTour />)
    expect(screen.queryByRole('region', { name: 'Recorrido guiado' })).toBeNull()
  })

  it('"Empezar" goes to the school step and its page', async () => {
    wrap(<GuidedTour />)
    fireEvent.click(await screen.findByRole('button', { name: /Empezar/ }))
    expect(readTour('u1')).toEqual({ status: 'active', step: 'escuela' })
    await act(async () => {})
    expect(screen.getByRole('heading', { name: 'Crea tu escuela' })).toBeTruthy()
  })
})

describe('TourView', () => {
  const base = { onGo: vi.fn(), onFinish: vi.fn(), onSkip: vi.fn() }
  it('a step is done only with the real data, then offers the next one', () => {
    const onGo = vi.fn()
    const { rerender } = render(<TourView {...base} onGo={onGo} step="clase" pathname="/app/escuelas" counts={{ schools: 1, classes: 0, teachers: 0, plans: 0 }} />)
    expect(screen.getByRole('heading', { name: 'Agrega una clase' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: /Seguir/ })).toBeNull()
    rerender(<TourView {...base} onGo={onGo} step="clase" pathname="/app/escuelas" counts={{ schools: 1, classes: 1, teachers: 0, plans: 0 }} />)
    expect(screen.getByRole('heading', { name: 'Clase creada' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /Seguir/ }))
    expect(onGo).toHaveBeenCalledWith('profesor')
  })
  it('on the form it gives the short version', () => {
    render(<TourView {...base} step="profesor" pathname="/app/profesores/nuevo" counts={{ schools: 1, classes: 1, teachers: 0, plans: 0 }} />)
    expect(screen.getByText('Nombre y primer apellido bastan. Guarda y seguimos.')).toBeTruthy()
    expect(screen.getByRole('img', { name: 'Paso 3 de 4' })).toBeTruthy()
  })
  it('the plan can be left for later', () => {
    const onGo = vi.fn()
    render(<TourView {...base} onGo={onGo} step="plan" pathname="/app/contabilidad" counts={{ schools: 1, classes: 1, teachers: 1, plans: 0 }} />)
    fireEvent.click(screen.getByRole('button', { name: 'Lo veo después' }))
    expect(onGo).toHaveBeenCalledWith('fin')
  })
  it('elsewhere in the app it offers to go back to the step', () => {
    const onGo = vi.fn()
    render(<TourView {...base} onGo={onGo} step="clase" pathname="/app/inicio" counts={{ schools: 1, classes: 0, teachers: 0, plans: 0 }} />)
    fireEvent.click(screen.getByRole('button', { name: /Ir al paso/ }))
    expect(onGo).toHaveBeenCalledWith('clase')
  })
})
