import { useState, type FormEvent } from 'react'
import { Navigate, useLocation } from '../../lib/nav'
import { useMutation, useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/auth'
import { useSchool } from '../../lib/school'
import { roleLabel } from '../../lib/roles'
import { Acc } from '../../ui/Accordion'
import { MiFicha } from './MiFicha'
import { Seguridad } from './Seguridad'
import { PerfilPublico } from './PerfilPublico'
import { MisHijos } from '../portal/MisHijos'
import { MiSuscripcion } from '../suscripcion/MiSuscripcion'
import { fetchMySubscription, mySubKey, subSummary } from '../suscripcion/api'

// "Mi cuenta" now lives inside Ajustes; old links (/app/cuenta#ficha) keep working.
export function CuentaPage() {
  const { hash } = useLocation()
  return <Navigate to={`/app/ajustes${hash || '#cuenta'}`} replace />
}

// Personal settings for every role (S6 "personal profile"), as accordions inside Ajustes.
export function CuentaSections() {
  const { user, profile, reloadProfile, updatePassword } = useAuth()
  const { role, schools, memberships, wards, student, myStudent } = useSchool()
  // Guardian looking at a child: the record and public profile sections act for that child.
  const kid = student && student.id !== myStudent?.id ? (student.full_name ?? '').split(' ')[0] : null
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
    <>
      <h2 className="acc-group" id="cuenta">Mi cuenta</h2>
      <Acc id="perfil" icon="user" title="Perfil" hint={`${user?.email ?? ''}${role ? ` · ${roleLabel[role]}` : ''}`}>
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
      </Acc>

      {role === 'alumno' && <Acc id="mi-ficha" icon="enroll" title={kid ? `Ficha de ${kid}` : 'Mi ficha de alumno'} hint="Contacto, emergencia y salud"><MiFicha /></Acc>}
      {role === 'alumno' && <Acc id="perfil-publico" icon="globe" title={kid ? `Perfil público de ${kid}` : 'Mi perfil público'} hint={kid ? 'Parte privado: tú decides si se publica' : 'Tu página personal: cinturón, nivel y skills'}><PerfilPublico /></Acc>}
      {role === 'alumno' && <Acc id="hijos" icon="users" title="Mis hijos" hint={wards.length ? `Apoderado de ${wards.length} ${wards.length === 1 ? 'alumno' : 'alumnos'}` : 'Agrega a tus hijos si entrenan en la escuela'}><MisHijos /></Acc>}

      {role === 'ceo' && <SubscriptionAcc />}

      <Acc id="seguridad" icon="lock" title="Verificación en dos pasos" hint="Código de una app además de tu contraseña"><Seguridad /></Acc>

      <Acc id="contrasena" icon="eye" title="Contraseña" hint="Cambia la contraseña con que ingresas">
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
      </Acc>

      {role !== 'ceo' && role !== 'alumno' && memberships.length > 0 && (
        <Acc id="mis-escuelas" icon="school" title="Mis escuelas">
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
        </Acc>
      )}
    </>
  )
}

/** The CEO's Martial CRM subscription (plan, state, paying by transfer). */
function SubscriptionAcc() {
  const q = useQuery({ queryKey: mySubKey, queryFn: fetchMySubscription })
  return (
    <Acc id="suscripcion" icon="wallet" title="Mi suscripción" hint={q.data ? subSummary(q.data) : 'Tu plan de Martial CRM y sus pagos'}>
      <MiSuscripcion />
    </Acc>
  )
}
