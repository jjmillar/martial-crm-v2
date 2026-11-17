import { useState, type FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { useSchool } from '../../lib/school'
import { formatDate, santiagoDate } from '../../lib/dates'
import { Icon } from '../../ui/Icon'

// Two-step verification (TOTP) with any authenticator app. Recommended for everyone, essential for the CEO:
// it protects the school's bank data and payment approvals even if the password leaks.
const key = ['mfa-factors'] as const
type Enroll = { id: string; qr: string; secret: string }

export function Seguridad() {
  const { role } = useSchool()
  const qc = useQueryClient()
  const factors = useQuery({
    queryKey: key,
    queryFn: async () => {
      const { data, error } = await supabase.auth.mfa.listFactors()
      if (error) throw error
      return data.all.filter((f) => f.factor_type === 'totp')
    },
  })
  const active = factors.data?.find((f) => f.status === 'verified')
  const [enroll, setEnroll] = useState<Enroll | null>(null)
  const [code, setCode] = useState('')
  const [confirmOff, setConfirmOff] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)

  const start = useMutation({
    mutationFn: async () => {
      // Clean up a half-finished enrollment first (one authenticator per account).
      for (const f of factors.data ?? []) if (f.status !== 'verified') await supabase.auth.mfa.unenroll({ factorId: f.id })
      const { data, error } = await supabase.auth.mfa.enroll({ factorType: 'totp', friendlyName: `Martial CRM ${Date.now()}` })
      if (error) throw new Error('No se pudo iniciar la activación. Intenta de nuevo.')
      return { id: data.id, qr: data.totp.qr_code, secret: data.totp.secret }
    },
    onMutate: () => setMsg(null),
    onSuccess: (e) => { setEnroll(e); setCode('') },
    onError: (e: Error) => setMsg({ ok: false, text: e.message }),
  })

  const verify = useMutation({
    mutationFn: async () => {
      if (!/^\d{6}$/.test(code)) throw new Error('Escribe los 6 dígitos que muestra tu app.')
      const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId: enroll!.id, code })
      if (error) throw new Error('Código incorrecto. Revisa que la hora de tu celular esté al día y prueba con el código actual.')
    },
    onMutate: () => setMsg(null),
    onSuccess: async () => {
      setEnroll(null); setCode('')
      await qc.invalidateQueries({ queryKey: key })
      setMsg({ ok: true, text: 'Verificación en dos pasos activada. Desde ahora te pediremos el código al ingresar.' })
    },
    onError: (e: Error) => setMsg({ ok: false, text: e.message }),
  })

  const off = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.auth.mfa.unenroll({ factorId: active!.id })
      if (error) throw new Error('No se pudo desactivar. Vuelve a ingresar con tu código e inténtalo de nuevo.')
      await supabase.auth.refreshSession()
    },
    onMutate: () => setMsg(null),
    onSuccess: async () => { setConfirmOff(false); await qc.invalidateQueries({ queryKey: key }); setMsg({ ok: true, text: 'Verificación en dos pasos desactivada.' }) },
    onError: (e: Error) => setMsg({ ok: false, text: e.message }),
  })

  const onVerify = (e: FormEvent) => { e.preventDefault(); verify.mutate() }

  return (
    <div className="form-section security" data-motion>
      <p className="hint">
        Además de tu contraseña, te pediremos un código de 6 dígitos de una app de autenticación (Google Authenticator, Microsoft Authenticator, 1Password…).
        {role === 'ceo' && <> <b>Muy recomendado para ti:</b> protege los datos bancarios de tus escuelas y la aprobación de pagos.</>}
      </p>
      {factors.isLoading && <p className="hint">Cargando…</p>}

      {active && (
        <div className="security__status">
          <span className="tag tag--ok"><Icon name="check" size={14} /> Activa</span>
          <span className="hint">Desde el {formatDate(santiagoDate(active.created_at))}</span>
        </div>
      )}
      {active && !confirmOff && <div className="form-actions"><button type="button" className="btn btn--ghost" onClick={() => setConfirmOff(true)}>Desactivar</button></div>}
      {active && confirmOff && (
        <div className="form-actions">
          <span className="hint">¿Desactivar? Tu cuenta quedará protegida solo con la contraseña.</span>
          <button type="button" className="btn btn--danger" disabled={off.isPending} onClick={() => off.mutate()}>Sí, desactivar</button>
          <button type="button" className="btn btn--ghost" onClick={() => setConfirmOff(false)}>No</button>
        </div>
      )}

      {!active && !enroll && factors.isSuccess && (
        <div className="form-actions">
          <button type="button" className="btn" disabled={start.isPending} onClick={() => start.mutate()}>
            <Icon name="lock" size={16} /> {start.isPending ? 'Preparando…' : 'Activar verificación en dos pasos'}
          </button>
        </div>
      )}

      {enroll && (
        <form className="security__enroll" onSubmit={onVerify} noValidate>
          <ol className="security__steps"><li>Abre tu app de autenticación y agrega una cuenta escaneando este código QR.</li></ol>
          <img className="security__qr" src={enroll.qr} alt="Código QR para tu app de autenticación" width={184} height={184} />
          <p className="hint">¿No puedes escanear? Escribe esta clave en la app: <code className="security__secret">{enroll.secret}</code></p>
          <ol className="security__steps" start={2}><li>Escribe el código de 6 dígitos que muestra la app.</li></ol>
          <div className="field">
            <label htmlFor="mfa-new">Código</label>
            <input id="mfa-new" className="input mfa-code" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code}
              onChange={(e) => { setCode(e.target.value.replace(/\D/g, '')); setMsg(null) }} />
          </div>
          <div className="form-actions">
            <button className="btn" type="submit" disabled={verify.isPending}>{verify.isPending ? 'Verificando…' : 'Confirmar y activar'}</button>
            <button type="button" className="btn btn--ghost" onClick={() => setEnroll(null)}>Cancelar</button>
          </div>
        </form>
      )}
      {msg && <p className={`alert${msg.ok ? ' alert--ok' : ''}`} role={msg.ok ? 'status' : 'alert'}>{msg.text}</p>}
    </div>
  )
}
