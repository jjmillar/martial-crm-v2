import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { useSchool } from '../../lib/school'
import { slugify } from '../../lib/slug'
import { Icon } from '../../ui/Icon'
import { Toggle } from '../../ui/Toggle'

// The student's own public page (/e/<school>/a/<handle>): name, belt, level and skills, with the student choosing
// what to show. Private data (RUT, contact, birth date, address) is never part of it.
type Row = {
  handle: string; published: boolean; headline: string | null; bio: string | null
  show_belt: boolean; show_skills: boolean; show_stats: boolean
}
const key = (id: string | undefined) => ['my-public-profile', id] as const

export function PerfilPublico() {
  const { student } = useSchool()
  const id = student?.id
  const q = useQuery({
    queryKey: key(id),
    queryFn: async () => {
      const { data, error } = await supabase.from('student_profiles').select('handle, published, headline, bio, show_belt, show_skills, show_stats').eq('student_id', id!).maybeSingle()
      if (error) throw error
      return data as Row | null
    },
    enabled: Boolean(id),
  })
  const names = useQuery({
    queryKey: ['my-student-name', id],
    queryFn: async () => {
      const { data, error } = await supabase.from('students').select('first_name, first_last_name').eq('id', id!).single()
      if (error) throw error
      return data
    },
    enabled: Boolean(id),
  })
  if (!id || q.isLoading || names.isLoading) return <p className="hint">Cargando…</p>
  const suggested = slugify(`${names.data?.first_name ?? ''} ${names.data?.first_last_name ?? ''}`).slice(0, 40) || 'mi-perfil'
  return <Form key={id} studentId={id} row={q.data ?? null} suggested={suggested} />
}

function Form({ studentId, row, suggested }: { studentId: string; row: Row | null; suggested: string }) {
  const { activeSchool } = useSchool()
  const qc = useQueryClient()
  const [f, setF] = useState({
    handle: row?.handle ?? suggested, published: row?.published ?? false, headline: row?.headline ?? '', bio: row?.bio ?? '',
    show_belt: row?.show_belt ?? true, show_skills: row?.show_skills ?? true, show_stats: row?.show_stats ?? true,
  })
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [copied, setCopied] = useState(false)
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => { setF((x) => ({ ...x, [k]: v })); setMsg(null) }

  const path = `/e/${activeSchool?.slug}/a/${row?.handle ?? f.handle}`
  const url = typeof window !== 'undefined' ? `${window.location.origin}${path}` : path
  const live = Boolean(row?.published)

  const save = useMutation({
    mutationFn: async () => {
      const handle = f.handle.trim().toLowerCase()
      if (!/^[a-z0-9-]{3,40}$/.test(handle)) throw new Error('La dirección usa de 3 a 40 letras minúsculas, números o guiones (sin tildes ni espacios).')
      const { error } = await supabase.rpc('save_my_public_profile', {
        p_student_id: studentId, p_handle: handle, p_published: f.published, p_headline: f.headline, p_bio: f.bio,
        p_show_belt: f.show_belt, p_show_skills: f.show_skills, p_show_stats: f.show_stats,
      })
      if (error?.message.includes('handle taken')) throw new Error('Esa dirección ya la usa otro alumno de tu escuela. Prueba con otra.')
      if (error) throw new Error('No se pudo guardar tu perfil público.')
      await qc.invalidateQueries({ queryKey: key(studentId) })
    },
    onSuccess: () => setMsg({ ok: true, text: f.published ? 'Perfil publicado.' : 'Guardado. Tu perfil sigue oculto.' }),
    onError: (e: Error) => setMsg({ ok: false, text: e.message }),
  })

  async function copy() {
    try { await navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 2000) } catch { /* ignore */ }
  }

  return (
    <form className="card form-section" onSubmit={(e) => { e.preventDefault(); setMsg(null); save.mutate() }} noValidate id="perfil-publico-form">
      <h2>Mi perfil público</h2>
      <p className="hint">Tu página personal, con tu cinturón, nivel y skills. Ahí iremos sumando tus logros. Nunca muestra tu RUT, contacto, dirección ni fecha de nacimiento.</p>

      <Toggle checked={f.published} onChange={(v) => set('published', v)} label="Publicar mi perfil" hint="Si está apagado, nadie puede verlo." />

      <div className="form-grid">
        <div className="field field--wide">
          <label htmlFor="pp-handle">Dirección de tu perfil</label>
          <div className="pp-handle">
            <span className="pp-handle__prefix">/e/{activeSchool?.slug}/a/</span>
            <input id="pp-handle" className="input" autoComplete="off" autoCapitalize="none" spellCheck={false} maxLength={40} value={f.handle}
              onChange={(e) => set('handle', e.target.value.toLowerCase().replace(/\s+/g, '-'))} />
          </div>
        </div>
        <div className="field field--wide">
          <label htmlFor="pp-headline">Frase corta</label>
          <input id="pp-headline" className="input" maxLength={80} placeholder="Ej: Cinturón azul · competidora de BJJ" value={f.headline} onChange={(e) => set('headline', e.target.value)} />
        </div>
        <div className="field field--wide">
          <label htmlFor="pp-bio">Sobre mí</label>
          <textarea id="pp-bio" className="input" rows={3} maxLength={500} placeholder="Cuándo empezaste, qué te gusta entrenar, tus metas…" value={f.bio} onChange={(e) => set('bio', e.target.value)} />
        </div>
      </div>

      <h3 className="ajustes__sub">Qué mostrar</h3>
      <div className="pp-toggles">
        <Toggle checked={f.show_belt} onChange={(v) => set('show_belt', v)} label="Cinturón y grado" />
        <Toggle checked={f.show_stats} onChange={(v) => set('show_stats', v)} label="Nivel, XP y clases" />
        <Toggle checked={f.show_skills} onChange={(v) => set('show_skills', v)} label="Skills" />
      </div>

      {msg && <p className={`alert${msg.ok ? ' alert--ok' : ''}`} role={msg.ok ? 'status' : 'alert'}>{msg.text}</p>}
      <div className="form-actions">
        <button className="btn" type="submit" disabled={save.isPending}>{save.isPending ? 'Guardando…' : 'Guardar perfil público'}</button>
        {live && (
          <>
            <a className="btn btn--ghost" href={path} target="_blank" rel="noreferrer"><Icon name="globe" size={16} /> Ver mi perfil</a>
            <button type="button" className="btn btn--ghost" onClick={copy}><Icon name="share" size={16} /> {copied ? 'Enlace copiado' : 'Copiar enlace'}</button>
          </>
        )}
      </div>
    </form>
  )
}
