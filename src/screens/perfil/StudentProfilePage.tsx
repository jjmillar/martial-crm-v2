'use client'
import { useState } from 'react'
import type { StudentProfile } from '../../lib/landing-server'
import { brandStyle } from '../escuela/api'
import { Icon } from '../../ui/Icon'
import { Link } from '../../lib/nav'
import { BeltChip } from '../../modules/artes/Belt'
import { fromAchievement, fromMilestone, LogrosList, LogrosSummary } from '../../modules/artes/Logros'

import { levelInfo } from '../../modules/portal/xp'
import { SkillsBreakdown } from '../../modules/portal/SkillsBreakdown'

const sinceFmt = new Intl.DateTimeFormat('es-CL', { month: 'long', year: 'numeric', timeZone: 'UTC' })

// A student's public page (/e/<school>/a/<handle>): who they are, their belt, level and skills, in their school's
// colors, and their achievements. Only what the student chose to publish reaches this page.
export function StudentProfilePage({ p }: { p: StudentProfile | null }) {
  if (!p) {
    return (
      <div className="school-page school-page--empty">
        <h1>Perfil no disponible</h1>
        <p className="hint">Este perfil no existe o su dueño lo tiene oculto.</p>
        <Link className="btn" to="/">Ir a Martial CRM</Link>
      </div>
    )
  }
  const s = p.school
  const schoolHref = s.landing ? `/e/${s.slug}` : null
  const need = p.stats ? p.stats.next_level_xp ?? levelInfo(p.stats.xp).next_level_xp : 100
  const pct = p.stats ? Math.round((p.stats.level_xp / need) * 100) : 0

  return (
    <div className={`school-page sprof${s.theme === 'grafito' ? ' school-page--mono' : ''}`} style={brandStyle(s)}>
      <header className="sp-nav">
        <SchoolBrand s={s} href={schoolHref} />
        <ShareButton name={p.name} />
      </header>

      <main className="sprof__main">
        <section className="sprof__hero rise" aria-label="Perfil">
          <span className="sprof__avatar" aria-hidden="true">{p.initials}</span>
          <div className="sprof__id">
            <h1>{p.name}</h1>
            <p className="sp-meta">Alumno · {s.name}</p>
            {p.headline && <p className="sprof__headline">{p.headline}</p>}
            <div className="sprof__chips">
              {p.belt && !p.arts?.length && <span className="sp-chip">Cinturón {p.belt.toLowerCase()}{p.belt_degree ? ` · ${p.belt_degree}° grado` : ''}</span>}
              <span className="sp-chip">Desde {sinceFmt.format(new Date(p.since))}</span>
            </div>
          </div>
        </section>

        {Boolean(p.arts?.some((a) => a.belt)) && (
          <section className="sprof__card rise" style={{ animationDelay: '20ms' }} aria-label="Cinturones">
            <h2 className="sprof__title">{p.arts!.length > 1 ? 'Cinturones' : 'Cinturón'}</h2>
            <ul className="my-belts">
              {p.arts!.filter((a) => a.belt && a.color).map((a) => (
                <li key={a.art}>
                  <BeltChip size="lg" art={a.art} name={a.belt!} color={a.color!} stripe={a.stripe} bar={a.bar} pattern={a.pattern} degree={a.degree} degreeText={a.degree_text} />
                  {a.rank && <span className="sp-muted">{a.rank}</span>}
                </li>
              ))}
            </ul>
          </section>
        )}

        {p.stats && (
          <section className="sprof__card sprof__level rise" style={{ animationDelay: '40ms' }} aria-label="Nivel">
            <div className="level-badge" style={{ ['--pct' as string]: `${pct}%` }}>
              <span className="level-badge__inner"><span className="level-badge__label">Nivel</span><strong>{p.stats.level}</strong></span>
            </div>
            <dl className="sprof__stats">
              <div><dt>XP total</dt><dd>{p.stats.xp}</dd></div>
              <div><dt>Clases</dt><dd>{p.stats.attended}</dd></div>
              <div><dt>Al nivel {p.stats.level + 1}</dt><dd>{need - p.stats.level_xp} XP</dd></div>
            </dl>
          </section>
        )}

        {p.bio && (
          <section className="sprof__card rise" style={{ animationDelay: '80ms' }}>
            <h2 className="sprof__title">Sobre mí</h2>
            <p className="sp-about">{p.bio}</p>
          </section>
        )}

        {p.skills && (
          <section className="sprof__card rise" style={{ animationDelay: '120ms' }} aria-label="Skills">
            <h2 className="sprof__title">Skills</h2>
            <SkillsBreakdown skills={p.skills} own={false} emptyText="Las skills aparecen a medida que entrena." />
          </section>
        )}

        {p.achievements && (
          <section className="sprof__card rise" style={{ animationDelay: '160ms' }} aria-label="Logros">
            <h2 className="sprof__title">Logros</h2>
            <LogrosSummary medals={p.achievements.filter((a) => a.kind === 'torneo').map((a) => a.medal)} graduations={p.achievements.filter((a) => a.kind === 'graduacion').length} milestones={p.milestones?.length ?? 0} />
            <LogrosList
              empty="Los logros aparecen a medida que entrena: graduaciones, torneos e hitos."
              items={[
                ...p.achievements.map((a, i) => fromAchievement({ id: `a${i}`, kind: a.kind, title: a.title, detail: a.detail, date: a.date, medal: a.medal as never, category: a.category, status: 'aprobado', reject_reason: null, artName: a.art, color: a.color, stripe: a.stripe, bar: a.bar, pattern: a.pattern, badgeIcon: a.icon })),
                ...(p.milestones ?? []).map(fromMilestone),
              ]}
            />
          </section>
        )}
      </main>

      <footer className="sp-footer">
        <span>{schoolHref ? <a href={schoolHref}>{s.name}</a> : s.name}{s.city ? ` · ${s.city}` : ''}</span>
        <Link to="/">Hecho con Martial CRM</Link>
      </footer>
    </div>
  )
}

function SchoolBrand({ s, href }: { s: StudentProfile['school']; href: string | null }) {
  const inner = (
    <>
      {s.logo_url ? <img src={s.logo_url} alt="" /> : <span className="sp-brand__mono" aria-hidden="true">{s.name.slice(0, 2).toUpperCase()}</span>}
      <b>{s.name}</b>
    </>
  )
  return href ? <a className="sp-brand" href={href}>{inner}</a> : <span className="sp-brand">{inner}</span>
}

function ShareButton({ name }: { name: string }) {
  const [copied, setCopied] = useState(false)
  async function share() {
    const url = window.location.href
    try {
      if (navigator.share) await navigator.share({ title: name, url })
      else { await navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 2000) }
    } catch { /* cancelled */ }
  }
  return <button type="button" className="sp-btn sp-btn--ghost" onClick={share}><Icon name="share" size={16} /> {copied ? 'Copiado' : 'Compartir'}</button>
}
