import { useState, type FormEvent } from 'react'
import { useMutation } from '@tanstack/react-query'
import { Icon } from '../../ui/Icon'
import { normalizeCode, type Redeemed } from './api'

// "¿Tienes un código de descuento?": collapsed link → input + Aplicar. Used at checkout, on a payment and on an
// enrollment. `apply` calls the matching RPC; `onApplied` refreshes the caller's data.
export function CodeField({ apply, onApplied, label = '¿Tienes un código de descuento?' }: {
  apply: (code: string) => Promise<Redeemed>
  onApplied: (r: Redeemed) => unknown
  label?: string
}) {
  const [open, setOpen] = useState(false)
  const [code, setCode] = useState('')
  const [err, setErr] = useState<string | null>(null)
  const m = useMutation({
    mutationFn: () => apply(code),
    onMutate: () => setErr(null),
    onSuccess: async (r) => { await onApplied(r); setOpen(false); setCode('') },
    onError: (e: Error) => setErr(e.message),
  })
  function submit(e: FormEvent) {
    e.preventDefault()
    if (normalizeCode(code).length < 3) return setErr('Escribe el código.')
    m.mutate()
  }

  if (!open) return <button type="button" className="link-btn code-field__open" onClick={() => setOpen(true)}><Icon name="tag" size={16} /> {label}</button>
  return (
    <form className="code-field" onSubmit={submit} noValidate>
      <label className="sr-only" htmlFor="code-field-in">Código de descuento</label>
      <input id="code-field-in" className="input code-input" autoFocus autoCapitalize="characters" autoComplete="off" maxLength={24} placeholder="Código"
        value={code} onChange={(e) => setCode(normalizeCode(e.target.value))} />
      <button type="submit" className="btn" disabled={m.isPending}>{m.isPending ? 'Aplicando…' : 'Aplicar'}</button>
      <button type="button" className="icon-btn" onClick={() => { setOpen(false); setErr(null) }} aria-label="Cancelar"><Icon name="close" size={16} /></button>
      {err && <p className="alert code-field__err" role="alert">{err}</p>}
    </form>
  )
}
