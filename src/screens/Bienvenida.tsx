import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate } from '../lib/nav'
import { useAuth } from '../lib/auth'
import { Wordmark } from '../ui/Wordmark'
import { supabase } from '../lib/supabase'
import { TermsConsent } from '../legal/TermsConsent'
import { TERMS_VERSION } from '../legal/legal'

// Landing point for invitation and password-reset links (S11). supabase-js reads the session from the URL.
export function Bienvenida() {
  const { session, loading, updatePassword, profile } = useAuth()
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [terms, setTerms] = useState(false)
  // Invited staff accept the terms here (first time); a password reset of someone who already accepted skips it.
  const [needsTerms, setNeedsTerms] = useState(false)
  const userId = session?.user.id
  useEffect(() => {
    if (!userId) return
    let live = true
    supabase.from('terms_acceptances').select('id').eq('version', TERMS_VERSION).limit(1)
      .then(({ data, error: e }) => { if (live && !e) setNeedsTerms(!data?.length) })
    return () => { live = false }
  }, [userId])

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    if (password.length < 8) return setError('La contraseña debe tener al menos 8 caracteres.')
    if (password !== confirm) return setError('Las contraseñas no coinciden.')
    if (needsTerms && !terms) return setError('Para entrar debes aceptar los términos y la política de privacidad.')
    setBusy(true)
    if (needsTerms) {
      const { error: tErr } = await supabase.rpc('accept_terms', { p_version: TERMS_VERSION })
      if (tErr) { setBusy(false); return setError('No se pudo registrar tu aceptación. Intenta de nuevo.') }
    }
    const { error: err } = await updatePassword(password)
    setBusy(false)
    if (err) return setError('No se pudo guardar la contraseña. Pide un enlace nuevo.')
    navigate('/app', { replace: true })
  }

  return (
    <div className="auth">
      <header className="auth__nav">
        <Wordmark />
      </header>
      <main className="auth__main">
        {loading ? (
          <p className="hint">Cargando…</p>
        ) : !session ? (
          <div className="auth__card card">
            <div className="auth__head">
              <span className="eyebrow">Enlace no válido</span>
              <h1>Este enlace expiró o ya se usó</h1>
            </div>
            <p className="hint">Pide una invitación nueva o restablece tu contraseña desde el ingreso.</p>
            <Link className="btn btn--block" to="/login">Ir a ingresar</Link>
          </div>
        ) : (
          <form className="auth__card card rise" onSubmit={onSubmit} noValidate>
            <div className="auth__head">
              <span className="eyebrow">Bienvenida</span>
              <h1>{profile?.full_name ? `Hola, ${profile.full_name.split(' ')[0]}` : 'Crea tu contraseña'}</h1>
              <p className="hint">Elige una contraseña para entrar a Martial CRM.</p>
            </div>
            <div className="field">
              <label htmlFor="new-password">Nueva contraseña</label>
              <input id="new-password" className="input" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="confirm-password">Repite la contraseña</label>
              <input id="confirm-password" className="input" type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
            </div>
            {needsTerms && <TermsConsent accepted={terms} onAccepted={(v) => { setTerms(v); setError(null) }} />}
            {error && <p className="alert" role="alert">{error}</p>}
            <button className="btn btn--block" type="submit" disabled={busy}>{busy ? 'Guardando…' : 'Guardar y entrar'}</button>
          </form>
        )}
      </main>
    </div>
  )
}
