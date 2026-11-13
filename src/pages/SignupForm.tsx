import { useState, type FormEvent, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { supabase } from '../lib/supabase'
import { formatRut, normalizeRut } from '../lib/rut'
import { Icon } from '../ui/Icon'

const ACTIVE_SCHOOL_KEY = 'mcrm.activeSchool'

type Props = {
  kind: 'ceo' | 'alumno'
  school?: { id: string; slug: string }
  head: ReactNode
  loginTo: string
}

// Shared sign-up form: CEO on the main site, student on a school's landing page (tied to that school).
export function SignupForm({ kind, school, head, loginTo }: Props) {
  const { signIn } = useAuth()
  const navigate = useNavigate()
  const [f, setF] = useState({ first_name: '', first_last_name: '', rut: '', email: '', phone: '', password: '', password2: '' })
  const [show, setShow] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const set = (k: keyof typeof f, v: string) => { setF((x) => ({ ...x, [k]: v })); setError(null) }
  const student = kind === 'alumno'

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (!f.first_name.trim() || !f.first_last_name.trim()) return setError('Escribe tu nombre y apellido.')
    const rut = f.rut.trim() ? normalizeRut(f.rut) : null
    if (student && !rut) return setError('Escribe un RUT válido. Ej: 12.345.678-5')
    if (f.rut.trim() && !rut) return setError('RUT inválido. Ej: 12.345.678-5')
    if (!/^\S+@\S+\.\S+$/.test(f.email.trim())) return setError('Correo inválido.')
    if (f.password.length < 8) return setError('La contraseña debe tener al menos 8 caracteres.')
    if (f.password !== f.password2) return setError('Las contraseñas no coinciden.')
    setBusy(true)
    const { error: fnError } = await supabase.functions.invoke('account-signup', {
      body: { kind, school_slug: school?.slug, first_name: f.first_name, first_last_name: f.first_last_name, rut, email: f.email, phone: f.phone, password: f.password },
    })
    if (fnError) {
      const ctx = (fnError as { context?: Response }).context
      const res = ctx ? await ctx.json().catch(() => null) : null
      setBusy(false)
      return setError(res?.error ?? 'No se pudo crear la cuenta. Intenta de nuevo.')
    }
    if (school) {
      try { localStorage.setItem(ACTIVE_SCHOOL_KEY, school.id) } catch { /* ignore */ }
    }
    const { error: loginError } = await signIn(f.email.trim().toLowerCase(), f.password)
    setBusy(false)
    if (loginError) return setError('Tu cuenta se creó, pero no pudimos iniciar sesión. Entra desde "Iniciar sesión".')
    navigate(student ? '/app' : '/app/escuelas', { replace: true })
  }

  return (
    <form className="auth__card card rise" onSubmit={onSubmit} noValidate>
      <div className="auth__head">{head}</div>
      <div className="field"><label htmlFor="r-first">Nombre</label><input id="r-first" className="input" autoComplete="given-name" value={f.first_name} onChange={(e) => set('first_name', e.target.value)} /></div>
      <div className="field"><label htmlFor="r-last">Apellido</label><input id="r-last" className="input" autoComplete="family-name" value={f.first_last_name} onChange={(e) => set('first_last_name', e.target.value)} /></div>
      {student && (
        <div className="field">
          <label htmlFor="r-rut">RUT</label>
          <input id="r-rut" className="input" placeholder="12.345.678-5" value={f.rut} onChange={(e) => set('rut', e.target.value)} onBlur={() => { if (normalizeRut(f.rut)) set('rut', formatRut(f.rut)) }} />
        </div>
      )}
      <div className="field"><label htmlFor="r-email">Correo</label><input id="r-email" className="input" type="email" autoComplete="email" value={f.email} onChange={(e) => set('email', e.target.value)} /></div>
      <div className="field"><label htmlFor="r-phone">Teléfono (opcional)</label><input id="r-phone" className="input" type="tel" autoComplete="tel" placeholder="+56 9 1234 5678" value={f.phone} onChange={(e) => set('phone', e.target.value)} /></div>
      <div className="field">
        <label htmlFor="r-pw">Contraseña</label>
        <div className="password">
          <input id="r-pw" className="input" type={show ? 'text' : 'password'} autoComplete="new-password" value={f.password} onChange={(e) => set('password', e.target.value)} />
          <button type="button" className="password__toggle" onClick={() => setShow((v) => !v)} aria-label={show ? 'Ocultar contraseña' : 'Mostrar contraseña'}><Icon name={show ? 'eyeOff' : 'eye'} /></button>
        </div>
      </div>
      <div className="field"><label htmlFor="r-pw2">Repite la contraseña</label><input id="r-pw2" className="input" type={show ? 'text' : 'password'} autoComplete="new-password" value={f.password2} onChange={(e) => set('password2', e.target.value)} /></div>
      {error && <p className="alert" role="alert">{error}</p>}
      <button className="btn" type="submit" disabled={busy}>{busy ? 'Creando cuenta…' : 'Crear cuenta'}</button>
      <p className="hint">¿Ya tienes cuenta? <Link to={loginTo}>Inicia sesión</Link></p>
    </form>
  )
}
