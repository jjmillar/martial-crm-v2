import { useState, type FormEvent } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { configError, supabaseConfigured } from '../lib/supabase'
import { Icon } from '../ui/Icon'
import { Wordmark } from '../ui/Wordmark'
import './auth.css'

type Mode = 'login' | 'reset'

export function Login() {
  const { signIn, sendPasswordReset } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const from = (location.state as { from?: { pathname?: string } } | null)?.from?.pathname ?? '/app'

  const [mode, setMode] = useState<Mode>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setNotice(null)
    if (!supabaseConfigured) return setError(configError)
    if (!email.trim()) return setError('Escribe tu correo.')

    setBusy(true)
    if (mode === 'login') {
      const { error: err } = await signIn(email.trim(), password)
      setBusy(false)
      if (err) return setError('Correo o contraseña incorrectos.')
      navigate(from, { replace: true })
    } else {
      const { error: err } = await sendPasswordReset(email.trim())
      setBusy(false)
      if (err) return setError('No pudimos enviar el correo. Intenta de nuevo en unos minutos.')
      setNotice('Si el correo tiene una cuenta, te enviamos un enlace para crear una nueva contraseña.')
    }
  }

  function switchMode(next: Mode) {
    setMode(next)
    setError(null)
    setNotice(null)
  }

  return (
    <div className="auth">
      <header className="auth__nav">
        <Wordmark />
        <Link className="link-btn" to="/">Volver</Link>
      </header>

      <main className="auth__main">
        <form className="auth__card card rise" onSubmit={onSubmit} noValidate>
          <div className="auth__head">
            <span className="eyebrow">{mode === 'login' ? 'Acceso' : 'Recuperar acceso'}</span>
            <h1>{mode === 'login' ? 'Ingresa a tu cuenta' : 'Restablecer contraseña'}</h1>
          </div>

          <div className="field">
            <label htmlFor="email">Correo</label>
            <input id="email" className="input" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>

          {mode === 'login' && (
            <div className="field">
              <label htmlFor="password">Contraseña</label>
              <div className="password">
                <input
                  id="password"
                  className="input"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
                <button type="button" className="password__toggle" onClick={() => setShowPassword((v) => !v)} aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}>
                  <Icon name={showPassword ? 'eyeOff' : 'eye'} />
                </button>
              </div>
            </div>
          )}

          {error && <p className="alert" role="alert">{error}</p>}
          {notice && <p className="alert alert--ok" role="status">{notice}</p>}

          <button className="btn btn--block" type="submit" disabled={busy}>
            {busy ? 'Un momento…' : mode === 'login' ? 'Ingresar' : 'Enviar enlace'}
          </button>

          {mode === 'login'
            ? <button type="button" className="link-btn" onClick={() => switchMode('reset')}>¿Olvidaste tu contraseña?</button>
            : <button type="button" className="link-btn" onClick={() => switchMode('login')}>Volver a ingresar</button>}
        </form>
        <p className="auth__foot hint">El acceso es por invitación. Si no tienes cuenta, pídela al administrador de tu academia.</p>
      </main>
    </div>
  )
}
