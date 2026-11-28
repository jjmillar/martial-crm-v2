import { fireEvent, render, screen, within } from '@testing-library/react'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { Ayuda } from './Ayuda'
import { readTour } from './tour'

const school = { role: 'ceo' as 'ceo' | 'admin' | 'user' | 'alumno' }
const router = { push: vi.fn(), replace: vi.fn(), back: vi.fn(), forward: vi.fn() }
vi.mock('../../lib/auth', () => ({ useAuth: () => ({ user: { id: 'u1' } }) }))
vi.mock('../../lib/school', () => ({ useSchool: () => school }))
vi.mock('../../lib/supabase', () => ({ supabase: {}, supabaseConfigured: true, configError: '' }))
vi.mock('next/navigation', () => ({
  useRouter: () => router,
  usePathname: () => '/app/ajustes',
  useSearchParams: () => new URLSearchParams(),
  useParams: () => ({}),
}))

beforeAll(() => {
  // jsdom has no <dialog> methods
  HTMLDialogElement.prototype.showModal = function (this: HTMLDialogElement) { this.setAttribute('open', '') }
  HTMLDialogElement.prototype.close = function (this: HTMLDialogElement) { this.removeAttribute('open') }
})
beforeEach(() => {
  localStorage.clear(); router.push.mockClear(); school.role = 'ceo'
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(Date.now() + 60_000))
})

describe('Ayuda', () => {
  it('shows tutorials and the FAQ for the team, everything visible (no clicks to read the answers)', () => {
    render(<Ayuda />)
    expect(screen.getByRole('heading', { name: 'Tutoriales' })).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Preguntas frecuentes' })).toBeTruthy()
    expect(screen.getByRole('button', { name: /Primeros pasos/ })).toBeTruthy()
    expect(screen.getByText(/La prueba dura 14 días/)).toBeTruthy()
  })

  it('a student sees only student help', () => {
    school.role = 'alumno'
    render(<Ayuda />)
    expect(screen.getByRole('button', { name: /Marcar asistencia/ })).toBeTruthy()
    expect(screen.queryByRole('button', { name: /Primeros pasos/ })).toBeNull()
    expect(screen.queryByText(/Administrador y Usuario/)).toBeNull()
  })

  it('a tutorial opens as a normal pop-up with numbered steps and the way to its menu', () => {
    render(<Ayuda />)
    fireEvent.click(screen.getByRole('button', { name: /Check-in con QR/ }))
    const dlg = screen.getByRole('dialog', { name: 'Check-in con QR' })
    expect(within(dlg).getAllByRole('listitem').length).toBe(4)
    expect(within(dlg).getByRole('link', { name: /ver tu QR en Ajustes/ })).toBeTruthy()
    expect(dlg.querySelector('.tour__scrim')).toBeNull()
  })

  it('the first tutorial replays the guided tour on the real pages', () => {
    render(<Ayuda />)
    fireEvent.click(screen.getByRole('button', { name: /Primeros pasos/ }))
    fireEvent.click(screen.getByRole('button', { name: /Ver el recorrido guiado/ }))
    expect(readTour('u1')).toEqual({ status: 'active', step: 'intro' })
  })
})
