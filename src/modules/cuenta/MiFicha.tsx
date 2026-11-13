import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { useSchool } from '../../lib/school'

// Students complete their own record after their account is approved (contact, emergency, health).
// Everything else (plan, belt, payments) stays in the school's hands.
type Me = { id: string; phone: string | null; birth_date: string | null; address: string | null; emergency_contact: string | null; emergency_phone: string | null; medical_notes: string | null }

export function MiFicha() {
  const { myStudent } = useSchool()
  const id = myStudent?.id
  const q = useQuery({
    queryKey: ['my-student', id],
    queryFn: async () => {
      const { data, error } = await supabase.from('students').select('id, phone, birth_date, address, emergency_contact, emergency_phone, medical_notes').eq('id', id!).single()
      if (error) throw error
      return data as Me
    },
    enabled: Boolean(id),
  })
  if (!q.data) return null
  return <FichaForm key={q.data.id} me={q.data} />
}

function FichaForm({ me }: { me: Me }) {
  const qc = useQueryClient()
  const [f, setF] = useState({
    phone: me.phone ?? '', birth_date: me.birth_date ?? '', address: me.address ?? '',
    emergency_contact: me.emergency_contact ?? '', emergency_phone: me.emergency_phone ?? '', medical_notes: me.medical_notes ?? '',
  })
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const set = (k: keyof typeof f, v: string) => { setF((x) => ({ ...x, [k]: v })); setMsg(null) }
  const missing = !me.phone || !me.birth_date || !me.emergency_contact || !me.emergency_phone

  const save = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc('update_my_student', {
        // birth date is nullable in SQL, the generated type says string
        p_student_id: me.id, p_phone: f.phone, p_birth_date: (f.birth_date || null) as unknown as string, p_address: f.address,
        p_emergency_contact: f.emergency_contact, p_emergency_phone: f.emergency_phone, p_medical_notes: f.medical_notes,
      })
      if (error) throw new Error('No se pudo guardar tu ficha.')
      await qc.invalidateQueries({ queryKey: ['my-student', me.id] })
    },
    onSuccess: () => setMsg({ ok: true, text: 'Ficha guardada.' }),
    onError: (e: Error) => setMsg({ ok: false, text: e.message }),
  })

  return (
    <form className="card form-section" onSubmit={(e) => { e.preventDefault(); save.mutate() }} noValidate id="ficha">
      <h2>Mi ficha de alumno</h2>
      <p className="hint">{missing ? 'Completa tus datos: tu escuela los necesita, sobre todo el contacto de emergencia.' : 'Tus datos de contacto y salud para la escuela.'}</p>
      <div className="form-grid">
        <div className="field"><label htmlFor="mf-phone">Teléfono</label><input id="mf-phone" className="input" type="tel" autoComplete="tel" value={f.phone} onChange={(e) => set('phone', e.target.value)} placeholder="+56 9 1234 5678" /></div>
        <div className="field"><label htmlFor="mf-birth">Fecha de nacimiento</label><input id="mf-birth" className="input" type="date" value={f.birth_date} onChange={(e) => set('birth_date', e.target.value)} /></div>
        <div className="field field--wide"><label htmlFor="mf-address">Dirección</label><input id="mf-address" className="input" autoComplete="street-address" value={f.address} onChange={(e) => set('address', e.target.value)} /></div>
        <div className="field"><label htmlFor="mf-ec">Contacto de emergencia</label><input id="mf-ec" className="input" value={f.emergency_contact} onChange={(e) => set('emergency_contact', e.target.value)} placeholder="Nombre y parentesco" /></div>
        <div className="field"><label htmlFor="mf-ep">Teléfono de emergencia</label><input id="mf-ep" className="input" type="tel" value={f.emergency_phone} onChange={(e) => set('emergency_phone', e.target.value)} /></div>
        <div className="field field--wide"><label htmlFor="mf-med">Notas médicas</label><textarea id="mf-med" className="input" rows={2} value={f.medical_notes} onChange={(e) => set('medical_notes', e.target.value)} placeholder="Alergias, lesiones, condiciones a considerar" /></div>
      </div>
      {msg && <p className={`alert${msg.ok ? ' alert--ok' : ''}`} role={msg.ok ? 'status' : 'alert'}>{msg.text}</p>}
      <div className="form-actions"><button className="btn" type="submit" disabled={save.isPending}>{save.isPending ? 'Guardando…' : 'Guardar ficha'}</button></div>
    </form>
  )
}
