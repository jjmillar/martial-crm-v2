import { useState, type FormEvent } from 'react'
import { useMutation } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/auth'
import { useSchool } from '../../lib/school'
import { roleLabel } from '../../lib/roles'
import { ThemeToggle } from '../../ui/ThemeToggle'

// Personal settings for every role (S6 "personal profile").
export function CuentaPage() {
  const { user, profile, reloadProfile, updatePassword } = useAuth()
  const { role, schools, memberships } = useSchool()
  const [name, setName] = useState(profile?.full_name ?? '')
  const [phone, setPhone] = useState(profile?.phone ?? '')
  const [pw, setPw] = useState('')
  const [pw2, setPw2] = useState('')
  const [profileMsg, setProfileMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [pwMsg, setPwMsg] = useState<{ ok: boolean; text: string } | null>(null)

  const saveProfile = useMutation({
    mutationFn: async () => {
      if (!name.trim()) throw new Error('Escribe tu nombre.')
      const { error } = await supabase.from('profiles').update({ full_name: name.trim(), phone: phone.trim() || null }).eq('id', user!.id)
      if (error) throw new Error('No se pudo guardar tu perfil.')
      await reloadProfile()
    },
    onSuccess: () => setProfileMsg({ ok: true, text: 'Perfil actualizado.' }),
    onError: (e: Error) => setProfileMsg({ ok: false, text: e.message }),
  })

  const savePw = useMutation({
    mutationFn: async () => {
      if (pw.length < 8) throw new Error('La contraseña debe tener al menos 8 caracteres.')
      if (pw !== pw2) throw new Error('Las contraseñas no coinciden.')
      const { error } = await updatePassword(pw)
      if (error?.message.includes('different from the old')) throw new Error('La nueva contraseña debe ser distinta a la actual.')
      if (error?.message.toLowerCase().includes('weak')) throw new Error('La contraseña es muy débil: usa más caracteres, mezcla letras y números.')
      if (error) throw new Error('No se pudo cambiar la contraseña. Si hace mucho que iniciaste sesión, vuelve a entrar e inténtalo de nuevo.')
    },
    onSuccess: () => { setPw(''); setPw2(''); setPwMsg({ ok: true, text: 'Contraseña actualizada.' }) },
    onError: (e: Error) => setPwMsg({ ok: false, text: e.message }),
  })

  const onProfile = (e: FormEvent) => { e.preventDefault(); setProfileMsg(null); saveProfile.mutate() }
  const onPw = (e: FormEvent) => { e.preventDefault(); setPwMsg(null); savePw.mutate() }

  return (
    <div className="alumno-form">
      <header className="page-head">
        <span className="eyebrow">{role ? roleLabel[role] : 'Cuenta'}</span>
        <h1>Mi cuenta</h1>
        <p className="hint">{user?.email}</p>
      </header>

      <form className="card form-section" onSubmit={onProfile} noValidate>
        <h2>Perfil</h2>
        <div className="form-grid">
          <div className="field">
            <label htmlFor="me-name">Nombre</label>
            <input id="me-name" className="input" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
          </div>
          <div className="field">
            <label htmlFor="me-phone">Teléfono</label>
            <input id="me-phone" className="input" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} autoComplete="tel" placeholder="+56 9 1234 5678" />
          </div>
          <div className="field">
            <label htmlFor="me-email">Correo</label>
            <input id="me-email" className="input" value={user?.email ?? ''} disabled />
            <span className="hint">Es tu usuario para ingresar.</span>
          </div>
        </div>
        {profileMsg && <p className={`alert${profileMsg.ok ? ' alert--ok' : ''}`} role={profileMsg.ok ? 'status' : 'alert'}>{profileMsg.text}</p>}
        <div className="form-actions"><button className="btn" type="submit" disabled={saveProfile.isPending}>Guardar perfil</button></div>
      </form>

      <form className="card form-section" onSubmit={onPw} noValidate>
        <h2>Contraseña</h2>
        <div className="form-grid">
          <div className="field">
            <label htmlFor="me-pw">Nueva contraseña</label>
            <input id="me-pw" className="input" type="password" autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="me-pw2">Repite la contraseña</label>
            <input id="me-pw2" className="input" type="password" autoComplete="new-password" value={pw2} onChange={(e) => setPw2(e.target.value)} />
          </div>
        </div>
        {pwMsg && <p className={`alert${pwMsg.ok ? ' alert--ok' : ''}`} role={pwMsg.ok ? 'status' : 'alert'}>{pwMsg.text}</p>}
        <div className="form-actions"><button className="btn" type="submit" disabled={savePw.isPending}>Cambiar contraseña</button></div>
      </form>

      <section className="card form-section">
        <div className="ajustes__section-head">
          <div>
            <h2>Apariencia</h2>
            <p className="hint">Tema claro u oscuro en este dispositivo.</p>
          </div>
          <ThemeToggle />
        </div>
      </section>

      {role !== 'ceo' && memberships.length > 0 && (
        <section className="card form-section">
          <h2>Mis escuelas</h2>
          <ul className="email-log">
            {memberships.map((m) => (
              <li key={m.id} className="email-log__row">
                <span className="email-log__main"><strong>{schools.find((s) => s.id === m.school_id)?.name ?? 'Escuela'}</strong></span>
                <span className="tag">{roleLabel[m.role]}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
