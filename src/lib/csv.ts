// CSV export for Excel in Spanish locales (S6 "data export"): ';' separator, UTF-8 BOM, CRLF, quoted when needed.

type Cell = string | number | boolean | null | undefined

export function toCsv(headers: string[], rows: Cell[][]): string {
  const esc = (v: Cell) => {
    if (v === null || v === undefined) return ''
    const s = typeof v === 'boolean' ? (v ? 'Sí' : 'No') : String(v)
    return /[;"\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  return '﻿' + [headers, ...rows].map((r) => r.map(esc).join(';')).join('\r\n')
}

export function downloadCsv(filename: string, csv: string) {
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
