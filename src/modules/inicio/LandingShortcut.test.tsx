import { act, fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { LandingShortcut } from './LandingShortcut'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/app/inicio',
  useSearchParams: () => new URLSearchParams(),
  useParams: () => ({}),
}))

describe('LandingShortcut', () => {
  it('shows the public address, opens it in a new tab and copies it', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.assign(navigator, { clipboard: { writeText } })
    render(<LandingShortcut slug="dojo-norte" enabled />)
    const url = `${window.location.origin}/e/dojo-norte`
    expect(screen.getByText(url.replace(/^https?:\/\//, ''))).toBeTruthy()
    const open = screen.getByRole('link', { name: /Abrir/ })
    expect(open.getAttribute('href')).toBe('/e/dojo-norte')
    expect(open.getAttribute('target')).toBe('_blank')
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /Copiar enlace/ })) })
    expect(writeText).toHaveBeenCalledWith(url)
    expect(screen.getByRole('button', { name: /Copiado/ })).toBeTruthy()
  })

  it('says when the page is hidden and links to its settings', () => {
    render(<LandingShortcut slug="dojo-norte" enabled={false} />)
    expect(screen.getByText('Oculta')).toBeTruthy()
    expect(screen.getByText(/Página no disponible/)).toBeTruthy()
    expect(screen.getByRole('link', { name: /Editar/ }).getAttribute('href')).toBe('/app/ajustes#landing')
  })
})
