// Belt text is free (it varies by art); common colour names get a swatch.
const swatches: Record<string, string> = {
  blanco: '#f4f4f7', blanca: '#f4f4f7', gris: '#8a8a92', amarillo: '#e8c547', amarilla: '#e8c547',
  naranjo: '#e8873a', naranja: '#e8873a', verde: '#3fb27f', azul: '#3d7be0', morado: '#8a5cd6', purpura: '#8a5cd6',
  'púrpura': '#8a5cd6', cafe: '#7a5134', 'café': '#7a5134', marron: '#7a5134', 'marrón': '#7a5134', rojo: '#e0492c',
  roja: '#e0492c', negro: '#0b0b0d', negra: '#0b0b0d',
}

export function beltSwatch(belt: string | null | undefined): string | null {
  if (!belt) return null
  const first = belt.trim().toLowerCase().split(/\s+/)[0]
  return swatches[first] ?? null
}

export const beltSuggestions = ['Blanco', 'Gris', 'Amarillo', 'Naranjo', 'Verde', 'Azul', 'Morado', 'Café', 'Rojo', 'Negro']
