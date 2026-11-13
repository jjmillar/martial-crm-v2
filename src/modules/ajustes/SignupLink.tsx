import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { useSchool } from '../../lib/school'
import type { School } from '../../lib/database.types'

// Student self-signup link (admins): turn it on, share it, rotate it.
export function SignupLink({ school }: { school: School }) {
  const { reload } = useSchool()
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  // Optimistic switch: flips at once, reverts if saving fails.
  const [on, setOn] = useState(school.signup_enabled)
  const url = `${window.location.origin}/registro/${school.signup_code}`
  const shareText = `Regístrate como alumno de ${school.name} en Martial CRM: ${url}`

  const toggle = useMutation({
    mutationFn: async (on: boolean) => {
      const { error } = await supabase.from('schools').update({ signup_enabled: on }).eq('id', school.id)
      if (error) throw new Error('No se pudo cambiar. Solo los administradores pueden hacerlo.')
      await reload()
      return on
    },
    onMutate: () => setMsg(null),
    onSuccess: (on) => setMsg({ ok: true, text: on ? 'Registro abierto: comparte el link con tus alumnos.' : 'Registro cerrado: el link ya no funciona.' }),
    onError: (e: Error, v) => { setOn(!v); setMsg({ ok: false, text: e.message }) },
  })
  const rotate = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc('regenerate_signup_code', { p_school_id: school.id })
      if (error) throw new Error('No se pudo generar un link nuevo.')
      await reload()
    },
    onMutate: () => setMsg(null),
    onSuccess: () => setMsg({ ok: true, text: 'Link nuevo generado. El anterior dejó de funcionar.' }),
    onError: (e: Error) => setMsg({ ok: false, text: e.message }),
  })

  async function copy() {
    try {
      await navigator.clipboard.writeText(url)
      setMsg({ ok: true, text: 'Link copiado.' })
    } catch {
      setMsg({ ok: false, text: 'No se pudo copiar: selecciona el link y cópialo a mano.' })
    }
  }

  return (
    <section className="card ajustes__section" aria-labelledby="signup-h" id="registro">
      <div className="ajustes__section-head">
        <div>
          <h2 id="signup-h">Registro de alumnos</h2>
          <p className="hint">Con este link tus alumnos crean su propia cuenta. Si su RUT y correo coinciden con su ficha, entran al tiro; si no, te llega la solicitud para aprobar en Alumnos.</p>
        </div>
        <label className="switch switch--inline">
          <input type="checkbox" checked={on} disabled={toggle.isPending} onChange={(e) => { setOn(e.target.checked); toggle.mutate(e.target.checked) }} />
          <span>{on ? 'Abierto' : 'Cerrado'}</span>
        </label>
      </div>
      {on && (
        <>
          <input className="input signup-url" readOnly value={url} aria-label="Link de registro" onFocus={(e) => e.target.select()} />
          <div className="form-actions">
            <button type="button" className="btn" onClick={copy}>Copiar link</button>
            <a className="btn btn--ghost" href={`https://wa.me/?text=${encodeURIComponent(shareText)}`} target="_blank" rel="noopener noreferrer">Compartir por WhatsApp</a>
            <button type="button" className="btn btn--ghost" disabled={rotate.isPending} onClick={() => rotate.mutate()}>Generar link nuevo</button>
          </div>
        </>
      )}
      {msg && <p className={`alert${msg.ok ? ' alert--ok' : ''}`} role={msg.ok ? 'status' : 'alert'}>{msg.text}</p>}
    </section>
  )
}
