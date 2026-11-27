import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { Wordmark } from '../ui/Wordmark'

type State = { status: 'checking' } | { status: 'ok' } | { status: 'challenge'; factorId: string }

// Two-step verification: an account with an authenticator app must enter its 6-digit code after the password.
// The database enforces it too (aal2), so this screen only lets the person in; it is not the protection itself.
export function MfaGate({ children }: { children: ReactNode }) {
  const { session, signOut } = useAuth()
  const [state, setState] = useState<State>({ status: 'checking' })
  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let alive = true
    ;(async () => {
      const { data } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()
      if (!alive) return
      if (data?.currentLevel === 'aal1' && data.nextLevel === 'aal2') {
        const f = await supabase.auth.mfa.listFactors()
        const totp = f.data?.totp.find((x) => x.status === 'verified')
        if (alive) setState(totp ? { status: 'challenge', factorId: totp.id } : { status: 'ok' })
      } else setState({ status: 'ok' })
    })()
    return () => { alive = false }
  }, [session?.user.id])

  async function verify(e: FormEvent) {
    e.preventDefault()
    if (state.status !== 'challenge') return
    if (!/^\d{6}$/.test(code.trim())) return setError('Escribe los 6 dígitos de tu app de autenticación.')
    setBusy(true); setError(null)
    const { error: err } = await supabase.auth.mfa.challengeAndVerify({ factorId: state.factorId, code: code.trim() })
    if (err) { setBusy(false); setCode(''); return setError('Código incorrecto o vencido. Prueba con el código que aparece ahora.') }
    // The session is now aal2: reload so every query runs with it.
    window.location.reload()
  }

  if (state.status === 'checking') return <p className="center-screen">Cargando…</p>
  if (state.status === 'ok') return <>{children}</>
  return (
    <div className="auth">
      <header className="auth__nav"><Wordmark /></header>
      <main className="auth__main">
        <form className="auth__card card rise" onSubmit={verify} noValidate>
          <div className="auth__head">
            <h1>Ingresa tu código</h1>
            <p className="auth__school">Verificación en dos pasos</p>
            <p className="hint">Abre tu app de autenticación (Google Authenticator, Microsoft Authenticator, 1Password…) y escribe el código de Martial CRM.</p>
          </div>
          <div className="field">
            <label htmlFor="mfa-code">Código de 6 dígitos</label>
            <input id="mfa-code" className="input mfa-code" inputMode="numeric" autoComplete="one-time-code" maxLength={6} autoFocus value={code} onChange={(e) => { setCode(e.target.value.replace(/\D/g, '')); setError(null) }} />
          </div>
          {error && <p className="alert" role="alert">{error}</p>}
          <button className="btn btn--block" type="submit" disabled={busy}>{busy ? 'Verificando…' : 'Verificar'}</button>
          <button type="button" className="link-btn" onClick={() => signOut()}>Salir y usar otra cuenta</button>
        </form>
      </main>
    </div>
  )
}
