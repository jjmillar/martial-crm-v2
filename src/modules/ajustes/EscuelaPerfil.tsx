import { useState, type FormEvent } from 'react'
import { useMutation } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { useSchool } from '../../lib/school'
import type { School } from '../../lib/database.types'

const MAX_LOGO = 2 * 1024 * 1024
type CalView = 'day' | 'week' | 'month'

// School profile (S6): admins edit name, contact, description, default calendar view and logo.
// `embedded`: rendered inside another container (the Escuelas pop-up), so no card frame of its own.
export function EscuelaPerfil({ school, embedded = false }: { school: School; embedded?: boolean }) {
  const { reload } = useSchool()
  const [f, setF] = useState({
    name: school.name, address: school.address ?? '', city: school.city ?? '', phone: school.phone ?? '',
    email: school.email ?? '', description: school.description ?? '', default_calendar_view: school.default_calendar_view as CalView,
  })
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const set = (k: keyof typeof f, v: string) => { setF((x) => ({ ...x, [k]: v })); setMsg(null) }

  const save = useMutation({
    mutationFn: async () => {
      if (!f.name.trim()) throw new Error('La escuela necesita un nombre.')
      if (f.email.trim() && !/^\S+@\S+\.\S+$/.test(f.email.trim())) throw new Error('Correo inválido.')
      const { error } = await supabase.from('schools').update({
        name: f.name.trim(), address: f.address.trim() || null, city: f.city.trim() || null, phone: f.phone.trim() || null,
        email: f.email.trim().toLowerCase() || null, description: f.description.trim() || null, default_calendar_view: f.default_calendar_view,
      }).eq('id', school.id)
      if (error) throw new Error('No se pudo guardar. Solo los administradores editan la escuela.')
      await reload()
    },
    onSuccess: () => setMsg({ ok: true, text: 'Datos de la escuela guardados.' }),
    onError: (e: Error) => setMsg({ ok: false, text: e.message }),
  })

  const logo = useMutation({
    mutationFn: async (file: File) => {
      if (file.size > MAX_LOGO) throw new Error('El logo supera los 2 MB.')
      const ext = (file.name.split('.').pop() ?? 'png').toLowerCase().replace(/[^a-z0-9]/g, '') || 'png'
      const path = `${school.id}/logo-${Date.now()}.${ext}`
      const up = await supabase.storage.from('logos').upload(path, file, { contentType: file.type || undefined })
      if (up.error) throw new Error(up.error.message.includes('mime') ? 'Formato no permitido: usa PNG, JPG, WEBP o SVG.' : 'No se pudo subir el logo.')
      const url = supabase.storage.from('logos').getPublicUrl(path).data.publicUrl
      const { error } = await supabase.from('schools').update({ logo_url: url }).eq('id', school.id)
      if (error) throw new Error('No se pudo guardar el logo.')
      // Remove the previous file (best effort).
      const prev = school.logo_url?.split('/logos/')[1]
      if (prev) await supabase.storage.from('logos').remove([decodeURIComponent(prev)])
      await reload()
    },
    onSuccess: () => setMsg({ ok: true, text: 'Logo actualizado.' }),
    onError: (e: Error) => setMsg({ ok: false, text: e.message }),
  })

  const onSubmit = (e: FormEvent) => { e.preventDefault(); save.mutate() }

  return (
    <form className={`ajustes__section${embedded ? '' : ' card'}`} onSubmit={onSubmit} noValidate aria-labelledby="escuela-h">
      <div className="ajustes__section-head">
        <div>
          <h2 id="escuela-h">{embedded ? school.name : 'Escuela'}</h2>
          <p className="hint">Datos que aparecen en comprobantes y correos.</p>
        </div>
      </div>
      <div className="logo-row">
        <span className="logo-box">{school.logo_url ? <img src={school.logo_url} alt={`Logo de ${school.name}`} /> : <span aria-hidden="true">{school.name.slice(0, 2).toUpperCase()}</span>}</span>
        <label className="btn btn--ghost file-btn">
          {logo.isPending ? 'Subiendo…' : school.logo_url ? 'Cambiar logo' : 'Subir logo'}
          <input type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" onChange={(e) => { const file = e.target.files?.[0]; if (file) logo.mutate(file); e.target.value = '' }} />
        </label>
        <span className="hint">PNG, JPG, WEBP o SVG, máx. 2 MB.</span>
      </div>
      <div className="form-grid">
        <div className="field"><label htmlFor="sc-name">Nombre *</label><input id="sc-name" className="input" value={f.name} onChange={(e) => set('name', e.target.value)} /></div>
        <div className="field"><label htmlFor="sc-city">Ciudad</label><input id="sc-city" className="input" value={f.city} onChange={(e) => set('city', e.target.value)} /></div>
        <div className="field"><label htmlFor="sc-address">Dirección</label><input id="sc-address" className="input" value={f.address} onChange={(e) => set('address', e.target.value)} /></div>
        <div className="field"><label htmlFor="sc-phone">Teléfono</label><input id="sc-phone" className="input" type="tel" value={f.phone} onChange={(e) => set('phone', e.target.value)} /></div>
        <div className="field"><label htmlFor="sc-email">Correo de contacto</label><input id="sc-email" className="input" type="email" value={f.email} onChange={(e) => set('email', e.target.value)} /></div>
        <div className="field">
          <label htmlFor="sc-cal">Vista inicial del calendario</label>
          <select id="sc-cal" className="input" value={f.default_calendar_view} onChange={(e) => set('default_calendar_view', e.target.value)}>
            <option value="day">Día</option>
            <option value="week">Semana</option>
            <option value="month">Mes</option>
          </select>
        </div>
        <div className="field field--wide"><label htmlFor="sc-desc">Descripción</label><textarea id="sc-desc" className="input" rows={3} value={f.description} onChange={(e) => set('description', e.target.value)} /></div>
      </div>
      {msg && <p className={`alert${msg.ok ? ' alert--ok' : ''}`} role={msg.ok ? 'status' : 'alert'}>{msg.text}</p>}
      <div className="form-actions"><button className="btn" type="submit" disabled={save.isPending}>{save.isPending ? 'Guardando…' : 'Guardar datos'}</button></div>
    </form>
  )
}
