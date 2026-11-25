import { useEffect, useState, type FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { useSchool } from '../../lib/school'
import type { School } from '../../lib/database.types'
import { formatCLP, parseCLP } from '../../lib/money'
import { ensureSchoolGeo } from '../../lib/geocode'
import { artsKey, listArts, listTemplates, templatesKey } from '../artes/api'
import { ArtsPicker } from '../artes/ArtsPicker'
import { applyPicks, ARTS_REQUIRED, initialPicks, picksOk, type ArtPick } from '../artes/picks'

const MAX_LOGO = 2 * 1024 * 1024
type CalView = 'day' | 'week' | 'month'

// School profile (S6): admins edit name, contact, description, default calendar view and logo.
// `embedded`: rendered inside another container (the Escuelas pop-up), so no card frame of its own.
export function EscuelaPerfil({ school, embedded = false }: { school: School; embedded?: boolean }) {
  const { reload } = useSchool()
  const qc = useQueryClient()
  // The martial arts it teaches are required: belts and degrees come from them (Ajustes → Artes marciales).
  const arts = useQuery({ queryKey: artsKey(school.id), queryFn: () => listArts(school.id) })
  const templates = useQuery({ queryKey: templatesKey, queryFn: listTemplates, staleTime: Infinity })
  const [picks, setPicks] = useState<ArtPick[] | null>(null)
  const [artsInvalid, setArtsInvalid] = useState(false)
  // Built once from the saved arts (a background refetch never wipes what is being edited); rebuilt after saving.
  useEffect(() => {
    if (picks === null && arts.data && templates.data) setPicks(initialPicks(arts.data, templates.data))
  }, [picks, arts.data, templates.data])
  const [f, setF] = useState({
    name: school.name, address: school.address ?? '', city: school.city ?? '', phone: school.phone ?? '',
    email: school.email ?? '', description: school.description ?? '', default_calendar_view: school.default_calendar_view as CalView,
    enrollment_fee: school.enrollment_fee ? formatCLP(school.enrollment_fee) : '',
  })
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const set = (k: keyof typeof f, v: string) => { setF((x) => ({ ...x, [k]: v })); setMsg(null) }

  const save = useMutation({
    mutationFn: async () => {
      if (!f.name.trim()) throw new Error('La escuela necesita un nombre.')
      if (!picks || !arts.data) throw new Error('Espera a que carguen las artes marciales.')
      if (!picksOk(picks)) { setArtsInvalid(true); throw new Error(ARTS_REQUIRED) }
      if (f.email.trim() && !/^\S+@\S+\.\S+$/.test(f.email.trim())) throw new Error('Correo inválido.')
      const fee = f.enrollment_fee.trim() ? parseCLP(f.enrollment_fee) : 0
      if (fee === null || Number.isNaN(fee) || fee < 0) throw new Error('Matrícula inválida: usa pesos enteros, ej: 30.000.')
      const { error } = await supabase.from('schools').update({
        name: f.name.trim(), address: f.address.trim() || null, city: f.city.trim() || null, phone: f.phone.trim() || null,
        email: f.email.trim().toLowerCase() || null, description: f.description.trim() || null, default_calendar_view: f.default_calendar_view,
        enrollment_fee: fee,
      }).eq('id', school.id)
      if (error) throw new Error('No se pudo guardar. Solo los administradores editan la escuela.')
      try {
        await applyPicks(school.id, picks, arts.data)
      } catch {
        throw new Error('Los datos se guardaron, pero no se pudieron guardar las artes marciales. Intenta de nuevo.')
      } finally {
        await Promise.all([qc.invalidateQueries({ queryKey: artsKey(school.id) }), qc.invalidateQueries({ queryKey: ['school-student-arts', school.id] })])
        setPicks(null)
      }
      // The QR check-in uses the address's coordinates: refresh them when the address changed (best effort).
      const geo = await ensureSchoolGeo({ ...school, address: f.address.trim() || null, city: f.city.trim() || null,
        ...(f.address.trim() !== (school.address ?? '') || f.city.trim() !== (school.city ?? '') ? { geo_address: null, geo_lat: null, geo_lng: null } : {}) }).catch(() => 'ok' as const)
      await reload()
      return geo
    },
    onSuccess: (geo) => setMsg({ ok: true, text: geo === 'not_found'
      ? 'Datos guardados, pero no encontramos la dirección en el mapa (el QR de asistencia no podrá revisar la ubicación). Prueba con calle, número y comuna.'
      : 'Datos de la escuela guardados.' }),
    onError: (e: Error) => setMsg({ ok: false, text: e.message }),
  })

  const logo = useMutation({
    mutationFn: async (file: File) => {
      if (file.size > MAX_LOGO) throw new Error('El logo supera los 2 MB.')
      const ext = (file.name.split('.').pop() ?? 'png').toLowerCase().replace(/[^a-z0-9]/g, '') || 'png'
      const path = `${school.id}/logo-${Date.now()}.${ext}`
      const up = await supabase.storage.from('logos').upload(path, file, { contentType: file.type || undefined })
      if (up.error) throw new Error(up.error.message.includes('mime') ? 'Formato no permitido: usa PNG, JPG o WEBP.' : 'No se pudo subir el logo.')
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
          <p className="hint">Datos que aparecen en comprobantes y correos, y las artes marciales que enseña.</p>
        </div>
      </div>
      <div className="logo-row">
        <span className="logo-box">{school.logo_url ? <img src={school.logo_url} alt={`Logo de ${school.name}`} /> : <span aria-hidden="true">{school.name.slice(0, 2).toUpperCase()}</span>}</span>
        <label className="btn btn--ghost file-btn">
          {logo.isPending ? 'Subiendo…' : school.logo_url ? 'Cambiar logo' : 'Subir logo'}
          <input type="file" accept="image/png,image/jpeg,image/webp" onChange={(e) => { const file = e.target.files?.[0]; if (file) logo.mutate(file); e.target.value = '' }} />
        </label>
        <span className="hint">PNG, JPG o WEBP, máx. 2 MB.</span>
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
        <div className="field field--wide">
          {arts.data && !arts.data.some((x) => x.active) && <p className="alert" role="alert">Falta elegir las artes marciales que imparte la escuela: sin ellas no hay cinturones ni grados para los alumnos.</p>}
          {picks ? <ArtsPicker picks={picks} invalid={artsInvalid} idPrefix={`sc-arts-${school.id}`} onChange={(p) => { setPicks(p); setArtsInvalid(false); setMsg(null) }} />
            : arts.isError || templates.isError ? <p className="alert">No se pudieron cargar las artes marciales.</p> : <p className="hint">Cargando artes marciales…</p>}
        </div>
        <div className="field field--wide"><label htmlFor="sc-desc">Descripción</label><textarea id="sc-desc" className="input" rows={3} value={f.description} onChange={(e) => set('description', e.target.value)} /></div>
      </div>
      <fieldset className="fee-box">
        <legend>Matrícula</legend>
        <p className="hint">Cobro anual por año calendario (Matrícula 2026, 2027…), aparte del plan: aparece como pago pendiente en el perfil del alumno. Se genera sola al inscribir a un alumno nuevo (la del año en curso) y cada 1 de enero para todos los alumnos activos. Si la activas ahora, a los alumnos que ya existían se les cobra desde el próximo 1 de enero. Vacío o $0 = sin matrícula.</p>
        <div className="form-grid">
          <div className="field">
            <label htmlFor="sc-fee">Monto (CLP)</label>
            <input id="sc-fee" className="input" inputMode="numeric" placeholder="$0" value={f.enrollment_fee} onChange={(e) => set('enrollment_fee', e.target.value)} onBlur={() => { const n = parseCLP(f.enrollment_fee); if (n !== null && !Number.isNaN(n)) set('enrollment_fee', n ? formatCLP(n) : '') }} />
          </div>
        </div>
      </fieldset>
      {msg && <p className={`alert${msg.ok ? ' alert--ok' : ''}`} role={msg.ok ? 'status' : 'alert'}>{msg.text}</p>}
      <div className="form-actions"><button className="btn" type="submit" disabled={save.isPending}>{save.isPending ? 'Guardando…' : 'Guardar datos'}</button></div>
    </form>
  )
}
