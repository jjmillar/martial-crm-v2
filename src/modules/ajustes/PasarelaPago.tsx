import { useState, type FormEvent } from 'react'
import { useMutation } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { useSchool } from '../../lib/school'
import type { School } from '../../lib/database.types'
import { formatRut, normalizeRut } from '../../lib/rut'

const ACCOUNT_TYPES = ['Cuenta corriente', 'Cuenta vista', 'Cuenta RUT', 'Cuenta de ahorro']

// Payment gateway settings: the transfer data students see when they press "Pagar". Without an account number,
// the transfer option tells students to contact the school.
export function PasarelaPago({ school }: { school: School }) {
  const { reload } = useSchool()
  const [f, setF] = useState({
    bank: school.transfer_bank ?? '', type: school.transfer_account_type ?? '', number: school.transfer_account_number ?? '',
    holder: school.transfer_holder ?? '', rut: school.transfer_rut ? formatRut(school.transfer_rut) : '', email: school.transfer_email ?? '',
  })
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const set = (k: keyof typeof f, v: string) => { setF((x) => ({ ...x, [k]: v })); setMsg(null) }

  const save = useMutation({
    mutationFn: async () => {
      const filled = Object.values(f).some((v) => v.trim())
      if (filled && (!f.bank.trim() || !f.type.trim() || !f.number.trim() || !f.holder.trim() || !f.rut.trim()))
        throw new Error('Completa banco, tipo de cuenta, número, titular y RUT (el correo es opcional).')
      const rut = f.rut.trim() ? normalizeRut(f.rut) : null
      if (f.rut.trim() && !rut) throw new Error('RUT del titular inválido.')
      if (f.email.trim() && !/^\S+@\S+\.\S+$/.test(f.email.trim())) throw new Error('Correo inválido.')
      const { error } = await supabase.from('schools').update({
        transfer_bank: f.bank.trim() || null, transfer_account_type: f.type.trim() || null, transfer_account_number: f.number.trim() || null,
        transfer_holder: f.holder.trim() || null, transfer_rut: rut ? formatRut(rut) : null, transfer_email: f.email.trim().toLowerCase() || null,
      }).eq('id', school.id)
      if (error) throw new Error('No se pudo guardar. Solo los administradores editan la escuela.')
      await reload()
      return filled
    },
    onSuccess: (filled) => setMsg({ ok: true, text: filled ? 'Datos de transferencia guardados. Tus alumnos ya pueden pagar.' : 'Datos borrados: la transferencia queda deshabilitada.' }),
    onError: (e: Error) => setMsg({ ok: false, text: e.message }),
  })
  const onSubmit = (e: FormEvent) => { e.preventDefault(); save.mutate() }

  return (
    <form className="form-section" onSubmit={onSubmit} noValidate>
      <p className="hint">Cuando un alumno presiona <b>Pagar</b> (en Inicio o en Mis pagos), llega a la pasarela de pago. Por ahora el medio habilitado es la <b>transferencia</b>: ve estos datos, transfiere y te llega el pago a <b>Tareas → Pagos por aprobar</b>. Al aprobarlo queda como pagado.</p>
      <div className="form-grid">
        <div className="field"><label htmlFor="tr-bank">Banco</label><input id="tr-bank" className="input" maxLength={60} placeholder="Ej: Banco Estado" value={f.bank} onChange={(e) => set('bank', e.target.value)} /></div>
        <div className="field">
          <label htmlFor="tr-type">Tipo de cuenta</label>
          <select id="tr-type" className="input" value={f.type} onChange={(e) => set('type', e.target.value)}>
            <option value="">Elige…</option>
            {[...new Set([...ACCOUNT_TYPES, ...(f.type && !ACCOUNT_TYPES.includes(f.type) ? [f.type] : [])])].map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <div className="field"><label htmlFor="tr-number">N° de cuenta</label><input id="tr-number" className="input" inputMode="numeric" maxLength={40} value={f.number} onChange={(e) => set('number', e.target.value)} /></div>
        <div className="field"><label htmlFor="tr-holder">Titular</label><input id="tr-holder" className="input" maxLength={80} placeholder="Nombre o razón social" value={f.holder} onChange={(e) => set('holder', e.target.value)} /></div>
        <div className="field"><label htmlFor="tr-rut">RUT del titular</label><input id="tr-rut" className="input" maxLength={20} placeholder="76.123.456-7" value={f.rut} onChange={(e) => set('rut', e.target.value)} onBlur={() => { if (normalizeRut(f.rut)) set('rut', formatRut(f.rut)) }} /></div>
        <div className="field"><label htmlFor="tr-email">Correo para el comprobante (opcional)</label><input id="tr-email" className="input" type="email" maxLength={120} value={f.email} onChange={(e) => set('email', e.target.value)} /></div>
      </div>
      {msg && <p className={`alert${msg.ok ? ' alert--ok' : ''}`} role={msg.ok ? 'status' : 'alert'}>{msg.text}</p>}
      <div className="form-actions"><button className="btn" type="submit" disabled={save.isPending}>{save.isPending ? 'Guardando…' : 'Guardar datos de transferencia'}</button></div>
    </form>
  )
}
