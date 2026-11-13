// Color themes for school landing pages (/e/<slug>). "custom" uses the school's own two colors.
export type LandingTheme = 'brasa' | 'oceano' | 'bosque' | 'violeta' | 'oro' | 'grafito' | 'custom'

export const landingThemes: { id: Exclude<LandingTheme, 'custom'>; label: string; primary: string; accent: string }[] = [
  { id: 'brasa', label: 'Brasa', primary: '#e0492c', accent: '#f5a524' },
  { id: 'oceano', label: 'Océano', primary: '#2563eb', accent: '#22d3ee' },
  { id: 'bosque', label: 'Bosque', primary: '#16a34a', accent: '#a3e635' },
  { id: 'violeta', label: 'Violeta', primary: '#7c3aed', accent: '#f472b6' },
  { id: 'oro', label: 'Oro', primary: '#c8961e', accent: '#f3d27a' },
  { id: 'grafito', label: 'Grafito', primary: '#3f3f46', accent: '#a1a1aa' }, // monochrome: follows the page's text color
]

export function themeColors(theme: string | null | undefined, primary?: string | null, accent?: string | null) {
  if (theme === 'custom' && primary) return { primary, accent: accent || primary }
  const t = landingThemes.find((x) => x.id === theme) ?? landingThemes[0]
  return { primary: t.primary, accent: t.accent }
}

// Readable text color on top of a brand color.
export function onColor(hex: string) {
  const n = parseInt(hex.slice(1), 16)
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255]
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.62 ? '#111111' : '#ffffff'
}
