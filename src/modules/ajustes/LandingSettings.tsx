import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { useSchool } from '../../lib/school'
import type { School } from '../../lib/database.types'
import { landingThemes, themeColors, type LandingTheme } from '../../lib/landingThemes'
import { Icon } from '../../ui/Icon'

const MAX_PHOTO = 5 * 1024 * 1024
const MAX_PHOTOS = 10
type Photo = { id: string; path: string; caption: string | null; position: number }
const photoUrl = (path: string) => supabase.storage.from('landing').getPublicUrl(path).data.publicUrl

// Ajustes → Landing page: the school's public page (/e/<slug>) — on/off, theme, texts, sections, photos.
export function LandingSettings({ school }: { school: School }) {
  const { reload } = useSchool()
  const qc = useQueryClient()
  const url = `${window.location.origin}/e/${school.slug}`
  const [f, setF] = useState({
    landing_enabled: school.landing_enabled,
    landing_theme: school.landing_theme as LandingTheme,
    landing_primary: school.landing_primary ?? '#e0492c',
    landing_accent: school.landing_accent ?? '#f5a524',
    landing_tagline: school.landing_tagline ?? '',
    landing_about: school.landing_about ?? '',
    landing_show_schedule: school.landing_show_schedule,
    landing_show_plans: school.landing_show_plans,
    landing_instagram: school.landing_instagram ?? '',
    landing_whatsapp: school.landing_whatsapp ?? '',
  })
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => { setF((x) => ({ ...x, [k]: v })); setMsg(null) }
  const preview = themeColors(f.landing_theme, f.landing_primary, f.landing_accent)

  const save = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('schools').update({
        ...f,
        landing_primary: f.landing_theme === 'custom' ? f.landing_primary : school.landing_primary,
        landing_accent: f.landing_theme === 'custom' ? f.landing_accent : school.landing_accent,
        landing_tagline: f.landing_tagline.trim() || null,
        landing_about: f.landing_about.trim() || null,
        landing_instagram: f.landing_instagram.trim() || null,
        landing_whatsapp: f.landing_whatsapp.trim() || null,
      }).eq('id', school.id)
      if (error) throw new Error('No se pudo guardar la página. Solo los administradores pueden editarla.')
      await reload()
      await qc.invalidateQueries({ queryKey: ['landing', school.slug] })
    },
    onSuccess: () => setMsg({ ok: true, text: 'Página guardada.' }),
    onError: (e: Error) => setMsg({ ok: false, text: e.message }),
  })

  async function copy() {
    try { await navigator.clipboard.writeText(url); setMsg({ ok: true, text: 'Link copiado.' }) } catch { setMsg({ ok: false, text: 'No se pudo copiar el link.' }) }
  }

  return (
    <section className="card ajustes__section landing-settings" aria-labelledby="landing-h" id="landing">
      <div className="ajustes__section-head">
        <div>
          <h2 id="landing-h">Landing page</h2>
          <p className="hint">Página pública de la escuela. Desde ahí tus alumnos se registran e ingresan, y sus cuentas quedan asignadas a esta escuela.</p>
        </div>
        <label className="switch switch--inline">
          <input type="checkbox" checked={f.landing_enabled} onChange={(e) => set('landing_enabled', e.target.checked)} />
          <span>{f.landing_enabled ? 'Publicada' : 'Oculta'}</span>
        </label>
      </div>

      <div className="landing-link">
        <input className="input" readOnly value={url} aria-label="Link de la página" onFocus={(e) => e.target.select()} />
        <div className="form-actions">
          <a className="btn btn--ghost" href={`/e/${school.slug}`} target="_blank" rel="noopener noreferrer"><Icon name="globe" size={16} /> Ver página</a>
          <button type="button" className="btn btn--ghost" onClick={copy}>Copiar link</button>
          <a className="btn btn--ghost" href={`https://wa.me/?text=${encodeURIComponent(`Conoce ${school.name} y crea tu cuenta de alumno: ${url}`)}`} target="_blank" rel="noopener noreferrer">Compartir por WhatsApp</a>
        </div>
        {!f.landing_enabled && <p className="hint">Oculta: el link muestra "Página no disponible" y nadie puede registrarse por ahí.</p>}
      </div>

      <div className="field">
        <span className="field__label" id="landing-theme">Colores</span>
        <div className="theme-picker" role="radiogroup" aria-labelledby="landing-theme">
          {landingThemes.map((t) => (
            <button key={t.id} type="button" role="radio" aria-checked={f.landing_theme === t.id} className="theme-swatch" onClick={() => set('landing_theme', t.id)}>
              <span className="theme-swatch__colors" style={{ background: `linear-gradient(135deg, ${t.primary} 50%, ${t.accent} 50%)` }} />
              <span>{t.label}</span>
            </button>
          ))}
          <button type="button" role="radio" aria-checked={f.landing_theme === 'custom'} className="theme-swatch" onClick={() => set('landing_theme', 'custom')}>
            <span className="theme-swatch__colors" style={{ background: `linear-gradient(135deg, ${f.landing_primary} 50%, ${f.landing_accent} 50%)` }} />
            <span>Personalizado</span>
          </button>
        </div>
        {f.landing_theme === 'custom' && (
          <div className="custom-colors">
            <label><input type="color" value={f.landing_primary} onChange={(e) => set('landing_primary', e.target.value)} /> Color principal</label>
            <label><input type="color" value={f.landing_accent} onChange={(e) => set('landing_accent', e.target.value)} /> Color secundario</label>
          </div>
        )}
        <div className="theme-preview" style={{ background: `radial-gradient(circle at 10% 10%, ${preview.accent}66, transparent 60%), ${preview.primary}33` }}>
          <span style={{ background: preview.primary }}>Crear cuenta</span>
          <b style={{ color: preview.primary }}>{school.name}</b>
        </div>
      </div>

      <div className="form-grid">
        <div className="field field--wide">
          <label htmlFor="lp-tagline">Frase principal</label>
          <input id="lp-tagline" className="input" maxLength={120} value={f.landing_tagline} onChange={(e) => set('landing_tagline', e.target.value)} placeholder="Ej: Jiu-jitsu para todos los niveles en Antofagasta" />
        </div>
        <div className="field field--wide">
          <label htmlFor="lp-about">Sobre la escuela</label>
          <textarea id="lp-about" className="input" rows={4} maxLength={1500} value={f.landing_about} onChange={(e) => set('landing_about', e.target.value)} placeholder="Historia, profesores, lo que hace especial a tu escuela… (si lo dejas vacío se usa la descripción)" />
        </div>
        <div className="field">
          <label htmlFor="lp-wa">WhatsApp</label>
          <input id="lp-wa" className="input" type="tel" maxLength={30} value={f.landing_whatsapp} onChange={(e) => set('landing_whatsapp', e.target.value)} placeholder="+56 9 1234 5678" />
        </div>
        <div className="field">
          <label htmlFor="lp-ig">Instagram</label>
          <input id="lp-ig" className="input" maxLength={60} value={f.landing_instagram} onChange={(e) => set('landing_instagram', e.target.value)} placeholder="@tuescuela" />
        </div>
      </div>

      <div className="landing-toggles">
        <label className="switch"><input type="checkbox" checked={f.landing_show_schedule} onChange={(e) => set('landing_show_schedule', e.target.checked)} /><span><strong>Mostrar horarios</strong><span className="hint">Clases activas con sus días y horas.</span></span></label>
        <label className="switch"><input type="checkbox" checked={f.landing_show_plans} onChange={(e) => set('landing_show_plans', e.target.checked)} /><span><strong>Mostrar planes y precios</strong><span className="hint">Planes activos y la matrícula anual.</span></span></label>
      </div>
      <p className="hint">La dirección, teléfono, correo, ciudad y logo se toman de los datos de la escuela (arriba).</p>

      {msg && <p className={`alert${msg.ok ? ' alert--ok' : ''}`} role={msg.ok ? 'status' : 'alert'}>{msg.text}</p>}
      <div className="form-actions"><button type="button" className="btn" disabled={save.isPending} onClick={() => save.mutate()}>{save.isPending ? 'Guardando…' : 'Guardar página'}</button></div>

      <Photos school={school} />
    </section>
  )
}

function Photos({ school }: { school: School }) {
  const qc = useQueryClient()
  const key = ['school-photos', school.id]
  const photos = useQuery({
    queryKey: key,
    queryFn: async () => {
      const { data, error } = await supabase.from('school_photos').select('id, path, caption, position').eq('school_id', school.id).order('position').order('created_at')
      if (error) throw error
      return data as Photo[]
    },
  })
  const [error, setError] = useState<string | null>(null)
  const list = photos.data ?? []
  const refresh = () => Promise.all([qc.invalidateQueries({ queryKey: key }), qc.invalidateQueries({ queryKey: ['landing', school.slug] })])

  const upload = useMutation({
    mutationFn: async (files: File[]) => {
      const room = MAX_PHOTOS - list.length
      if (room <= 0) throw new Error(`Máximo ${MAX_PHOTOS} fotos.`)
      const take = files.slice(0, room)
      let pos = list.length ? Math.max(...list.map((p) => p.position)) + 1 : 0
      for (const file of take) {
        if (file.size > MAX_PHOTO) throw new Error(`"${file.name}" supera los 5 MB.`)
        const ext = (file.name.split('.').pop() ?? 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg'
        const path = `${school.id}/${crypto.randomUUID()}.${ext}`
        const up = await supabase.storage.from('landing').upload(path, file, { contentType: file.type || undefined })
        if (up.error) throw new Error(up.error.message.includes('mime') ? 'Formato no permitido: usa JPG, PNG o WEBP.' : 'No se pudo subir la foto.')
        const { error: e } = await supabase.from('school_photos').insert({ school_id: school.id, path, position: pos++ })
        if (e) throw new Error('No se pudo guardar la foto.')
      }
      if (files.length > take.length) throw new Error(`Se subieron ${take.length}; el máximo es ${MAX_PHOTOS} fotos.`)
    },
    onMutate: () => setError(null),
    onSettled: refresh,
    onError: (e: Error) => setError(e.message),
  })
  const remove = useMutation({
    mutationFn: async (p: Photo) => {
      const { error: e } = await supabase.from('school_photos').delete().eq('id', p.id)
      if (e) throw new Error('No se pudo quitar la foto.')
      await supabase.storage.from('landing').remove([p.path])
    },
    onSettled: refresh,
    onError: (e: Error) => setError(e.message),
  })
  const move = useMutation({
    mutationFn: async ({ i, dir }: { i: number; dir: -1 | 1 }) => {
      const a = list[i], b = list[i + dir]
      if (!a || !b) return
      // Renumber everything so ties from older rows never block a move.
      const order = [...list]
      order[i] = b
      order[i + dir] = a
      await Promise.all(order.map((p, n) => supabase.from('school_photos').update({ position: n }).eq('id', p.id)))
    },
    onSettled: refresh,
  })
  const caption = useMutation({
    mutationFn: async ({ id, text }: { id: string; text: string }) => {
      await supabase.from('school_photos').update({ caption: text.trim() || null }).eq('id', id)
    },
    onSettled: refresh,
  })

  return (
    <div className="landing-photos">
      <div className="ajustes__section-head">
        <div>
          <h3>Fotos del carrusel</h3>
          <p className="hint">Se muestran en la portada, en este orden. JPG, PNG o WEBP de hasta 5 MB; máximo {MAX_PHOTOS}. Mejor en horizontal.</p>
        </div>
        <label className={`btn file-btn${list.length >= MAX_PHOTOS ? ' is-disabled' : ''}`}>
          <Icon name="image" size={16} /> {upload.isPending ? 'Subiendo…' : 'Subir fotos'}
          <input type="file" accept="image/jpeg,image/png,image/webp" multiple disabled={upload.isPending || list.length >= MAX_PHOTOS} onChange={(e) => { const files = [...(e.target.files ?? [])]; if (files.length) upload.mutate(files); e.target.value = '' }} />
        </label>
      </div>
      {error && <p className="alert" role="alert">{error}</p>}
      {photos.isSuccess && list.length === 0 && <p className="hint">Sin fotos: la portada usa un fondo con los colores de la escuela.</p>}
      <ul className="photo-list">
        {list.map((p, i) => (
          <li key={p.id} className="photo-item">
            <img src={photoUrl(p.path)} alt={p.caption ?? `Foto ${i + 1}`} loading="lazy" />
            <input className="input" maxLength={120} defaultValue={p.caption ?? ''} placeholder="Texto (opcional)" aria-label={`Texto de la foto ${i + 1}`} onBlur={(e) => { if (e.target.value !== (p.caption ?? '')) caption.mutate({ id: p.id, text: e.target.value }) }} />
            <div className="photo-item__actions">
              <button type="button" className="icon-btn" disabled={i === 0 || move.isPending} onClick={() => move.mutate({ i, dir: -1 })} aria-label="Subir"><Icon name="up" size={16} /></button>
              <button type="button" className="icon-btn" disabled={i === list.length - 1 || move.isPending} onClick={() => move.mutate({ i, dir: 1 })} aria-label="Bajar"><Icon name="down" size={16} /></button>
              <button type="button" className="icon-btn" disabled={remove.isPending} onClick={() => remove.mutate(p)} aria-label="Quitar foto"><Icon name="trash" size={16} /></button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
