import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { formatCLP } from '../../lib/money'
import { hhmm, weekdays } from '../../lib/weekdays'
import type { BillingCycle, ClassLevel } from '../../lib/database.types'
import { cycleInfo } from '../../modules/planes/cycles'
import { levelLabel } from '../../modules/clases/api'
import { Icon } from '../../ui/Icon'
import { brandStyle, igLink, photoUrl, useLanding, waLink, type Landing } from './api'
import './escuela.css'

// Public page of a school (/e/<slug>): what the CEO chose to show, in the school's colors, plus the
// school's own student login and sign-up so new accounts belong to this school.
export function SchoolLanding() {
  const { slug } = useParams()
  const q = useLanding(slug)
  const s = q.data

  useEffect(() => {
    if (s) document.title = `${s.name} · Martial CRM`
    return () => { document.title = 'Martial CRM' }
  }, [s])

  if (q.isLoading) return <div className="school-page school-page--loading"><p className="hint">Cargando…</p></div>
  if (!s) return <NotAvailable />
  return <Page s={s} />
}

export function NotAvailable() {
  return (
    <div className="school-page school-page--empty">
      <h1>Página no disponible</h1>
      <p className="hint">Esta escuela no existe o su página está desactivada.</p>
      <Link className="btn" to="/">Ir a Martial CRM</Link>
    </div>
  )
}

function Page({ s }: { s: Landing }) {
  const about = s.about || s.description
  const [copied, setCopied] = useState(false)
  async function share() {
    const url = window.location.href
    try {
      if (navigator.share) await navigator.share({ title: s.name, text: s.tagline ?? s.name, url })
      else { await navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 2000) }
    } catch { /* cancelled */ }
  }

  return (
    <div className="school-page" style={brandStyle(s)}>
      <header className="sp-nav">
        <span className="sp-brand">
          {s.logo_url ? <img src={s.logo_url} alt="" /> : <span className="sp-brand__mono" aria-hidden="true">{s.name.slice(0, 2).toUpperCase()}</span>}
          <b>{s.name}</b>
        </span>
        <nav className="sp-nav__actions" aria-label="Cuenta">
          <Link className="sp-btn sp-btn--ghost" to={`/e/${s.slug}/ingresar`}>Ingresar</Link>
          <Link className="sp-btn" to={`/e/${s.slug}/registro`}>Crear cuenta</Link>
        </nav>
      </header>

      <Hero s={s} />

      <main className="sp-main">
        {about && (
          <section className="sp-section" aria-labelledby="sp-about">
            <h2 id="sp-about">Sobre nosotros</h2>
            <p className="sp-about">{about}</p>
          </section>
        )}

        {s.schedule && s.schedule.length > 0 && <Schedule rows={s.schedule} />}

        {s.plans && s.plans.length > 0 && (
          <section className="sp-section" aria-labelledby="sp-plans">
            <h2 id="sp-plans">Planes</h2>
            <div className="sp-plans">
              {s.plans.map((p) => (
                <article key={p.name} className={`sp-plan${p.trial ? ' sp-plan--trial' : ''}`}>
                  {p.trial && <span className="sp-chip">Prueba</span>}
                  <h3>{p.name}</h3>
                  <p className="sp-plan__price">{p.price === 0 ? 'Gratis' : formatCLP(p.price)} <span>{p.price === 0 ? '' : cycleInfo(p.cycle as BillingCycle)?.per}</span></p>
                  {p.description && <p className="sp-muted">{p.description}</p>}
                </article>
              ))}
            </div>
            {s.enrollment_fee > 0 && <p className="sp-muted">Matrícula anual: {formatCLP(s.enrollment_fee)} (aparte del plan).</p>}
          </section>
        )}

        <section className="sp-section sp-cta" aria-labelledby="sp-join">
          <h2 id="sp-join">¿Entrenas con nosotros?</h2>
          <p>Crea tu cuenta de alumno para marcar tu asistencia, ver tu nivel y tus skills, y revisar tus pagos.</p>
          <div className="sp-cta__actions">
            <Link className="sp-btn sp-btn--lg" to={`/e/${s.slug}/registro`}>Crear cuenta de alumno</Link>
            <Link className="sp-btn sp-btn--ghost sp-btn--lg" to={`/e/${s.slug}/ingresar`}>Ya tengo cuenta</Link>
          </div>
        </section>

        <Contact s={s} onShare={share} copied={copied} />
      </main>

      <footer className="sp-footer">
        <span>© {new Date().getFullYear()} {s.name}</span>
        <Link to="/">Hecho con Martial CRM</Link>
      </footer>
    </div>
  )
}

function Hero({ s }: { s: Landing }) {
  const photos = s.photos
  const track = useRef<HTMLDivElement>(null)
  const [index, setIndex] = useState(0)
  const [paused, setPaused] = useState(false)

  const go = (i: number) => {
    const el = track.current
    if (!el || photos.length === 0) return
    const n = (i + photos.length) % photos.length
    el.scrollTo({ left: n * el.clientWidth, behavior: 'smooth' })
  }

  // Auto-advance every 5 s; stops on interaction and for reduced motion.
  useEffect(() => {
    if (photos.length < 2 || paused || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const t = setInterval(() => go(index + 1), 5000)
    return () => clearInterval(t)
  })

  return (
    <section className={`sp-hero${photos.length ? '' : ' sp-hero--plain'}`} aria-label="Portada">
      {photos.length > 0 && (
        <div
          className="sp-carousel"
          ref={track}
          onScroll={(e) => setIndex(Math.round(e.currentTarget.scrollLeft / Math.max(1, e.currentTarget.clientWidth)))}
          onPointerDown={() => setPaused(true)}
          aria-roledescription="carrusel"
        >
          {photos.map((p, i) => (
            <figure key={p.path} className="sp-slide" aria-roledescription="foto" aria-label={`${i + 1} de ${photos.length}`}>
              <img src={photoUrl(p.path)} alt={p.caption ?? ''} loading={i === 0 ? 'eager' : 'lazy'} />
              {p.caption && <figcaption>{p.caption}</figcaption>}
            </figure>
          ))}
        </div>
      )}
      <div className="sp-hero__text">
        {s.city && <span className="sp-eyebrow"><Icon name="pin" size={14} /> {s.city}</span>}
        <h1>{s.name}</h1>
        {s.tagline && <p className="sp-tagline">{s.tagline}</p>}
        <div className="sp-hero__actions">
          <Link className="sp-btn sp-btn--lg" to={`/e/${s.slug}/registro`}>Únete</Link>
          {s.whatsapp && <a className="sp-btn sp-btn--ghost sp-btn--lg" href={waLink(s.whatsapp, `Hola ${s.name}, quiero información`)} target="_blank" rel="noopener noreferrer">WhatsApp</a>}
        </div>
      </div>
      {photos.length > 1 && (
        <>
          <button type="button" className="sp-arrow sp-arrow--prev" onClick={() => { setPaused(true); go(index - 1) }} aria-label="Foto anterior"><Icon name="back" size={18} /></button>
          <button type="button" className="sp-arrow sp-arrow--next" onClick={() => { setPaused(true); go(index + 1) }} aria-label="Foto siguiente"><Icon name="arrow" size={18} /></button>
          <div className="sp-dots" role="tablist" aria-label="Fotos">
            {photos.map((p, i) => (
              <button key={p.path} type="button" role="tab" aria-selected={i === index} aria-label={`Foto ${i + 1}`} onClick={() => { setPaused(true); go(i) }} />
            ))}
          </div>
        </>
      )}
    </section>
  )
}

function Schedule({ rows }: { rows: NonNullable<Landing['schedule']> }) {
  const days = useMemo(() => weekdays.map((d, i) => ({ ...d, n: i + 1, items: rows.filter((r) => r.weekday === i + 1) })).filter((d) => d.items.length), [rows])
  return (
    <section className="sp-section" aria-labelledby="sp-schedule">
      <h2 id="sp-schedule">Horarios</h2>
      <div className="sp-week">
        {days.map((d) => (
          <div key={d.n} className="sp-day">
            <h3>{d.long}</h3>
            <ul>
              {d.items.map((r, i) => (
                <li key={i} style={{ ['--class-color' as string]: r.color }}>
                  <span className="sp-time">{hhmm(r.start)}–{hhmm(r.end)}</span>
                  <span className="sp-class"><b>{r.name}</b><span className="sp-muted">{[r.discipline, levelLabel[r.level as ClassLevel]].filter(Boolean).join(' · ')}</span></span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  )
}

function Contact({ s, onShare, copied }: { s: Landing; onShare: () => void; copied: boolean }) {
  const map = s.address ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent([s.address, s.city].filter(Boolean).join(', '))}` : null
  const items = [
    map && { href: map, icon: 'pin' as const, label: [s.address, s.city].filter(Boolean).join(', ') },
    s.phone && { href: `tel:${s.phone.replace(/\s/g, '')}`, icon: 'phone' as const, label: s.phone },
    s.whatsapp && { href: waLink(s.whatsapp), icon: 'chat' as const, label: 'WhatsApp' },
    s.instagram && { href: igLink(s.instagram), icon: 'instagram' as const, label: `@${s.instagram.replace(/^@/, '').replace(/^https?:\/\/(www\.)?instagram\.com\//, '').replace(/\/$/, '')}` },
    s.email && { href: `mailto:${s.email}`, icon: 'mail' as const, label: s.email },
  ].filter(Boolean) as { href: string; icon: 'pin' | 'phone' | 'chat' | 'instagram' | 'mail'; label: string }[]
  return (
    <section className="sp-section" aria-labelledby="sp-contact">
      <h2 id="sp-contact">Contacto</h2>
      <ul className="sp-contact">
        {items.map((it) => (
          <li key={it.href}>
            <a href={it.href} target={it.href.startsWith('http') ? '_blank' : undefined} rel="noopener noreferrer"><Icon name={it.icon} size={18} /> <span>{it.label}</span></a>
          </li>
        ))}
        <li><button type="button" onClick={onShare}><Icon name="share" size={18} /> <span>{copied ? 'Link copiado' : 'Compartir esta página'}</span></button></li>
      </ul>
    </section>
  )
}
