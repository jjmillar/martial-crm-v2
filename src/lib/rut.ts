// Chilean RUT helpers (S7). Stored as 'NNNNNNNN-D' (no dots, uppercase K); shown as 'NN.NNN.NNN-D'.

export function cleanRut(input: string): string {
  return input.replace(/[^0-9kK]/g, '').toUpperCase()
}

export function checkDigit(body: string): string {
  let total = 0
  let factor = 2
  for (let i = body.length - 1; i >= 0; i--) {
    total += Number(body[i]) * factor
    factor = factor === 7 ? 2 : factor + 1
  }
  const r = 11 - (total % 11)
  return r === 11 ? '0' : r === 10 ? 'K' : String(r)
}

/** Returns the storage form 'NNNNNNNN-D', or null when the input is not a valid RUT. */
export function normalizeRut(input: string): string | null {
  const c = cleanRut(input)
  if (!/^[0-9]{7,8}[0-9K]$/.test(c)) return null
  const body = c.slice(0, -1)
  const dv = c.slice(-1)
  return checkDigit(body) === dv ? `${body}-${dv}` : null
}

export function formatRut(input: string | null | undefined): string {
  if (!input) return ''
  const c = cleanRut(input)
  if (c.length < 2) return c
  const body = c.slice(0, -1).replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  return `${body}-${c.slice(-1)}`
}
