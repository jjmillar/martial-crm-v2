// CLP helpers (S7): integer pesos in the DB, '$35.000' on screen.

const clp = new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 })

export function formatCLP(value: number | null | undefined): string {
  if (value === null || value === undefined) return ''
  return clp.format(value).replace(/\s/g, '')
}

/** Parses what a person types ('35.000', '$35000', '35 000') into integer pesos; null when empty, NaN when invalid. */
export function parseCLP(input: string): number | null {
  const t = input.trim()
  if (t === '') return null
  const cleaned = t.replace(/[$\s.]/g, '')
  if (!/^\d+$/.test(cleaned)) return Number.NaN
  return Number(cleaned)
}
