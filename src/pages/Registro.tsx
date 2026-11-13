import { useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '../lib/auth'
import { supabase } from '../lib/supabase'
import { formatRut, normalizeRut } from '../lib/rut'
import { Icon } from '../ui/Icon'
import { Wordmark } from '../ui/Wordmark'
import './auth.css'

// /registro/:code — a student creates their own account through the school's link.
// RUT + email matching their record links it at once; otherwise the school approves it.
export function Registro() {
  const { code = '' } = useParams()
  const { signIn } = useAuth()
  const navigate = useNavigate()
  const school = useQuery({
    queryKey: ['signup-school', code],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('signup_school', { p_code: code })
      if (error) throw error
      return data?.[0] ?? null
    },
  })
  const [f, setF] = useState({ first_name: '', first_last_name: '', rut: '', email: '', phone: '', password: '', password2: '' })
  const [show, setShow] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const set = (k: keyof typeof f, v: string) => { setF((x) => ({ ...x, [k]: v })); setError(null) }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (!f.first_name.trim() || !f.first_last_name.trim()) return setError('Escribe tu nombre y apellido.')
    if (!normalizeRut(f.rut)) return setError('RUT inválido. Ej: 12.345.678-5')
    if (!/^\S+@\S+\.\S+$/.test(f.email.trim())) return setError('Correo inválido.')
    if (f.password.length < 8) return setError('La contraseña debe tener al menos 8 caracteres.')
    if (f.password !== f.password2) return setError('Las contraseñas no coinciden.')
    setBusy(true)
    const { data, error: fnError } = await supabase.functions.invoke<{ ok: boolean; linked: boolean; error?: string }>('student-signup', {
      body: { code, first_name: f.first_name, first_last_name: f.first_last_name, rut: normalizeRut(f.rut), email: f.email, phone: f.phone, password: f.password },
    })
    if (fnError) {
      const ctx = (fnError as { context?: Response }).context
      const res = ctx ? await ctx.json().catch(() => null) : null
      setBusy(false)
      return setError(res?.error ?? 'No se pudo crear la cuenta. Intenta de nuevo.')
    }
    const { error: loginError } = await signIn(f.email.trim().toLowerCase(), f.password)
    setBusy(false)
    if (loginError) return setError('Tu cuenta se creó, pero no pudimos iniciar sesión. Ingresa desde "Iniciar sesión".')
    navigate('/app/inicio', { replace: true, state: { flash: data?.linked ? '¡Listo! Tu cuenta quedó vinculada.' : undefined } })
  }

  return (
    <div className="auth">
      <header className="auth__nav">
        <Wordmark />
        <Link className="link-btn" to="/login">Iniciar sesión</Link>
      </header>
      <main className="auth__main">
        {school.isLoading && <p className="hint">Cargando…</p>}
        {school.isSuccess && !school.data && (
          <div className="auth__card card rise">
            <div className="auth__head">
              <span className="eyebrow">Registro</span>
              <h1>Link no disponible</h1>
            </div>
            <p className="hint">Este link de registro no existe o tu escuela lo desactivó. Pídele uno nuevo a tu escuela.</p>
          </div>
        )}
        {school.data && (
          <form className="auth__card card rise" onSubmit={onSubmit} noValidate>
            <div className="auth__head">
              {school.data.logo_url && <img className="auth__logo" src={school.data.logo_url} alt="" />}
              <span className="eyebrow">Registro de alumnos · {school.data.name}</span>
              <h1>Crea tu cuenta</h1>
              <p className="hint">Usa el mismo RUT y correo que diste en tu escuela para entrar al tiro; si no, tu escuela aprobará tu registro.</p>
            </div>
            <div className="field"><label htmlFor="r-first">Nombre</label><input id="r-first" className="input" autoComplete="given-name" value={f.first_name} onChange={(e) => set('first_name', e.target.value)} /></div>
            <div className="field"><label htmlFor="r-last">Apellido</label><input id="r-last" className="input" autoComplete="family-name" value={f.first_last_name} onChange={(e) => set('first_last_name', e.target.value)} /></div>
            <div className="field"><label htmlFor="r-rut">RUT</label><input id="r-rut" className="input" placeholder="12.345.678-5" value={f.rut} onChange={(e) => set('rut', e.target.value)} onBlur={() => { if (normalizeRut(f.rut)) set('rut', formatRut(f.rut)) }} /></div>
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
          </form>
        )}
      </main>
    </div>
  )
}
