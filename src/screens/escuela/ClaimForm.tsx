import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from '../../lib/nav'
import { useAuth } from '../../lib/auth'
import { supabase } from '../../lib/supabase'
import { Icon } from '../../ui/Icon'

const ACTIVE_SCHOOL_KEY = 'mcrm.activeSchool'

import { formatClaimCode } from '../../lib/claimCode'
import { TermsConsent } from '../../legal/TermsConsent'
import { TERMS_VERSION } from '../../legal/legal'

// A child whose guardian handed over the account: their own login with the code. The student record (attendance,
// level, payments) is already there, so there is nothing to approve.
export function ClaimForm({ school, initialCode, onCancel }: { school: { id: string; slug: string; name: string }; initialCode: string; onCancel: () => void }) {
  const { signIn } = useAuth()
  const navigate = useNavigate()
  const [code, setCode] = useState(formatClaimCode(initialCode))
  const [email, setEmail] = useState('')
  const [pw, setPw] = useState('')
  const [pw2, setPw2] = useState('')
  const [show, setShow] = useState(false)
  const [terms, setTerms] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    if (code.replace(/-/g, '').length !== 12) return setError('El código tiene 12 caracteres, por ejemplo 1A2B-3C4D-5E6F.')
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) return setError('Correo inválido.')
    if (pw.length < 8) return setError('La contraseña debe tener al menos 8 caracteres.')
    if (pw !== pw2) return setError('Las contraseñas no coinciden.')
    if (!terms) return setError('Para activar la cuenta debes aceptar los términos y la política de privacidad.')
    setBusy(true)
    const { error: fnError } = await supabase.functions.invoke('account-signup', { body: { kind: 'claim', school_slug: school.slug, code, email, password: pw, accept_terms: true, terms_version: TERMS_VERSION } })
    if (fnError) {
      const ctx = (fnError as { context?: Response }).context
      const res = ctx ? await ctx.json().catch(() => null) : null
      setBusy(false)
      return setError(res?.error ?? 'No se pudo crear la cuenta. Intenta de nuevo.')
    }
    try { localStorage.setItem(ACTIVE_SCHOOL_KEY, school.id) } catch { /* ignore */ }
    const { error: loginError } = await signIn(email.trim().toLowerCase(), pw)
    setBusy(false)
    if (loginError) return setError('Tu cuenta se creó, pero no pudimos iniciar sesión. Entra desde "Iniciar sesión".')
    navigate('/app', { replace: true })
  }

  return (
    <form className="auth__card card rise" onSubmit={onSubmit} noValidate>
      <div className="auth__head">
        <h1>Activa tu propia cuenta</h1>
        <p className="auth__school">Alumnos · {school.name}</p>
        <p className="hint">Tu apoderado te dio un código. Con él creas tu cuenta y mantienes todo: asistencias, nivel, experiencia y pagos.</p>
      </div>
      <div className="field">
        <label htmlFor="cl-code">Código de tu apoderado</label>
        <input id="cl-code" className="input claim-code" autoComplete="off" autoCapitalize="characters" spellCheck={false} placeholder="1A2B-3C4D-5E6F" value={code} onChange={(e) => { setCode(formatClaimCode(e.target.value)); setError(null) }} />
      </div>
      <div className="field"><label htmlFor="cl-email">Tu correo</label><input id="cl-email" className="input" type="email" autoComplete="email" value={email} onChange={(e) => { setEmail(e.target.value); setError(null) }} /></div>
      <div className="field">
        <label htmlFor="cl-pw">Contraseña</label>
        <div className="password">
          <input id="cl-pw" className="input" type={show ? 'text' : 'password'} autoComplete="new-password" value={pw} onChange={(e) => { setPw(e.target.value); setError(null) }} />
          <button type="button" className="password__toggle" onClick={() => setShow((v) => !v)} aria-label={show ? 'Ocultar contraseña' : 'Mostrar contraseña'}><Icon name={show ? 'eyeOff' : 'eye'} /></button>
        </div>
      </div>
      <div className="field"><label htmlFor="cl-pw2">Repite la contraseña</label><input id="cl-pw2" className="input" type={show ? 'text' : 'password'} autoComplete="new-password" value={pw2} onChange={(e) => { setPw2(e.target.value); setError(null) }} /></div>
      <TermsConsent accepted={terms} onAccepted={(v) => { setTerms(v); setError(null) }} />
      {error && <p className="alert" role="alert">{error}</p>}
      <button className="btn" type="submit" disabled={busy}>{busy ? 'Activando…' : 'Activar mi cuenta'}</button>
      <p className="hint">¿No tienes código? <button type="button" className="link-btn" onClick={onCancel}>Crear cuenta de alumno</button> · <Link to={`/e/${school.slug}/ingresar`}>Iniciar sesión</Link></p>
    </form>
  )
}
