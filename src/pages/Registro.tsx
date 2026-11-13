import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '../lib/auth'
import { supabase } from '../lib/supabase'
import { formatRut, normalizeRut } from '../lib/rut'
import { Icon } from '../ui/Icon'
import { Wordmark } from '../ui/Wordmark'
import './auth.css'

type Kind = 'alumno' | 'miembro'

// /registro — open sign-up. The person says what the account is for and which school; the CEO (or the
// school's admins) approve it in "Pendientes" before any access is granted.
export function Registro() {
  const { signIn } = useAuth()
  const navigate = useNavigate()
  const schools = useQuery({
    queryKey: ['public-schools'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('public_schools')
      if (error) throw error
      return data ?? []
    },
  })
  const [kind, setKind] = useState<Kind>('alumno')
  const [f, setF] = useState({ school_id: '', first_name: '', first_last_name: '', rut: '', email: '', phone: '', password: '', password2: '' })
  const [show, setShow] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const set = (k: keyof typeof f, v: string) => { setF((x) => ({ ...x, [k]: v })); setError(null) }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (!f.school_id) return setError('Elige tu escuela.')
    if (!f.first_name.trim() || !f.first_last_name.trim()) return setError('Escribe tu nombre y apellido.')
    const rut = f.rut.trim() ? normalizeRut(f.rut) : null
    if (kind === 'alumno' && !rut) return setError('Escribe un RUT válido. Ej: 12.345.678-5')
    if (f.rut.trim() && !rut) return setError('RUT inválido. Ej: 12.345.678-5')
    if (!/^\S+@\S+\.\S+$/.test(f.email.trim())) return setError('Correo inválido.')
    if (f.password.length < 8) return setError('La contraseña debe tener al menos 8 caracteres.')
    if (f.password !== f.password2) return setError('Las contraseñas no coinciden.')
    setBusy(true)
    const { error: fnError } = await supabase.functions.invoke('account-signup', {
      body: { kind, school_id: f.school_id, first_name: f.first_name, first_last_name: f.first_last_name, rut, email: f.email, phone: f.phone, password: f.password },
    })
    if (fnError) {
      const ctx = (fnError as { context?: Response }).context
      const res = ctx ? await ctx.json().catch(() => null) : null
      setBusy(false)
      return setError(res?.error ?? 'No se pudo crear la cuenta. Intenta de nuevo.')
    }
    const { error: loginError } = await signIn(f.email.trim().toLowerCase(), f.password)
    setBusy(false)
    if (loginError) return setError('Tu cuenta se creó, pero no pudimos iniciar sesión. Entra desde "Iniciar sesión".')
    navigate('/app', { replace: true })
  }

  return (
    <div className="auth">
      <header className="auth__nav">
        <Wordmark />
        <Link className="link-btn" to="/login">Iniciar sesión</Link>
      </header>
      <main className="auth__main">
        <form className="auth__card card rise" onSubmit={onSubmit} noValidate>
          <div className="auth__head">
            <span className="eyebrow">Registro</span>
            <h1>Crea tu cuenta</h1>
            <p className="hint">Tu escuela revisa y aprueba la cuenta antes de que puedas entrar.</p>
          </div>

          <div className="field">
            <span className="field__label" id="r-kind">La cuenta es para</span>
            <div className="segmented" role="group" aria-labelledby="r-kind">
              <button type="button" aria-pressed={kind === 'alumno'} onClick={() => { setKind('alumno'); setError(null) }}>Alumno</button>
              <button type="button" aria-pressed={kind === 'miembro'} onClick={() => { setKind('miembro'); setError(null) }}>Equipo de la escuela</button>
            </div>
            <span className="hint">{kind === 'alumno' ? 'Entrenas en la escuela: verás tu nivel, skills, asistencia y pagos.' : 'Trabajas en la escuela: profesor, recepción o administración.'}</span>
          </div>

          <div className="field">
            <label htmlFor="r-school">Escuela</label>
            <select id="r-school" className="input" value={f.school_id} onChange={(e) => set('school_id', e.target.value)}>
              <option value="">{schools.isLoading ? 'Cargando…' : 'Elige tu escuela'}</option>
              {schools.data?.map((s) => <option key={s.id} value={s.id}>{s.name}{s.city ? ` · ${s.city}` : ''}</option>)}
            </select>
          </div>
          <div className="field"><label htmlFor="r-first">Nombre</label><input id="r-first" className="input" autoComplete="given-name" value={f.first_name} onChange={(e) => set('first_name', e.target.value)} /></div>
          <div className="field"><label htmlFor="r-last">Apellido</label><input id="r-last" className="input" autoComplete="family-name" value={f.first_last_name} onChange={(e) => set('first_last_name', e.target.value)} /></div>
          <div className="field">
            <label htmlFor="r-rut">RUT{kind === 'miembro' ? ' (opcional)' : ''}</label>
            <input id="r-rut" className="input" placeholder="12.345.678-5" value={f.rut} onChange={(e) => set('rut', e.target.value)} onBlur={() => { if (normalizeRut(f.rut)) set('rut', formatRut(f.rut)) }} />
          </div>
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
          <p className="hint">¿Ya tienes cuenta? <Link to="/login">Inicia sesión</Link></p>
        </form>
      </main>
    </div>
  )
}
