import { useState, type FormEvent, type ReactNode } from 'react'
import { Link, Navigate, useNavigate, useParams } from '../../lib/nav'
import { useAuth } from '../../lib/auth'
import { Icon } from '../../ui/Icon'
import { SignupForm } from '../SignupForm'
import { brandStyle, useLanding, type Landing } from './api'
import { NotAvailable } from './SchoolLanding'

const ACTIVE_SCHOOL_KEY = 'mcrm.activeSchool'
const rememberSchool = (id: string) => { try { localStorage.setItem(ACTIVE_SCHOOL_KEY, id) } catch { /* ignore */ } }

function Shell({ s, children }: { s: Landing; children: ReactNode }) {
  return (
    <div className="auth school-auth" style={brandStyle(s)}>
      <header className="auth__nav">
        <Link className="sp-brand" to={`/e/${s.slug}`}>
          {s.logo_url ? <img src={s.logo_url} alt="" /> : <span className="sp-brand__mono" aria-hidden="true">{s.name.slice(0, 2).toUpperCase()}</span>}
          <b>{s.name}</b>
        </Link>
        <Link className="link-btn" to={`/e/${s.slug}`}>Volver</Link>
      </header>
      <main className="auth__main">{children}</main>
    </div>
  )
}

function useSchoolPage() {
  const { slug } = useParams()
  const q = useLanding(slug)
  const { session, loading } = useAuth()
  return { q, s: q.data, signedIn: !loading && Boolean(session) }
}

/** /e/<slug>/registro — student account tied to this school (pending until its CEO approves). */
export function SchoolSignup() {
  const { q, s, signedIn } = useSchoolPage()
  if (q.isLoading) return <p className="hint school-page--loading">Cargando…</p>
  if (!s) return <NotAvailable />
  if (signedIn) { rememberSchool(s.id); return <Navigate to="/app" replace /> }
  return (
    <Shell s={s}>
      <SignupForm
        kind="alumno"
        school={{ id: s.id, slug: s.slug }}
        loginTo={`/e/${s.slug}/ingresar`}
        head={
          <>
            <span className="eyebrow">Alumnos · {s.name}</span>
            <h1>Crea tu cuenta</h1>
            <p className="hint">La escuela revisa y aprueba tu cuenta. Después podrás completar tu ficha, marcar asistencia y ver tu nivel.</p>
          </>
        }
      />
    </Shell>
  )
}

/** /e/<slug>/ingresar — login that opens the app on this school. */
export function SchoolLogin() {
  const { q, s, signedIn } = useSchoolPage()
  const { signIn } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [show, setShow] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (q.isLoading) return <p className="hint school-page--loading">Cargando…</p>
  if (!s) return <NotAvailable />
  if (signedIn) { rememberSchool(s.id); return <Navigate to="/app" replace /> }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    if (!email.trim()) return setError('Escribe tu correo.')
    setBusy(true)
    rememberSchool(s!.id)
    const { error: err } = await signIn(email.trim(), password)
    setBusy(false)
    if (err) return setError('Correo o contraseña incorrectos.')
    navigate('/app', { replace: true })
  }

  return (
    <Shell s={s}>
      <form className="auth__card card rise" onSubmit={onSubmit} noValidate>
        <div className="auth__head">
          <span className="eyebrow">{s.name}</span>
          <h1>Ingresa a tu cuenta</h1>
        </div>
        <div className="field">
          <label htmlFor="sl-email">Correo</label>
          <input id="sl-email" className="input" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="sl-pw">Contraseña</label>
          <div className="password">
            <input id="sl-pw" className="input" type={show ? 'text' : 'password'} autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
            <button type="button" className="password__toggle" onClick={() => setShow((v) => !v)} aria-label={show ? 'Ocultar contraseña' : 'Mostrar contraseña'}><Icon name={show ? 'eyeOff' : 'eye'} /></button>
          </div>
        </div>
        {error && <p className="alert" role="alert">{error}</p>}
        <button className="btn" type="submit" disabled={busy}>{busy ? 'Ingresando…' : 'Ingresar'}</button>
        <p className="hint">¿No tienes cuenta? <Link to={`/e/${s.slug}/registro`}>Crear cuenta de alumno</Link></p>
      </form>
    </Shell>
  )
}
