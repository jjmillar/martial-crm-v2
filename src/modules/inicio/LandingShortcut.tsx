import { useEffect, useState } from 'react'
import { Link } from '../../lib/nav'
import { Icon } from '../../ui/Icon'

// Inicio: shortcut to the school's public page (landing): see the address, open it, copy it to share.
export function LandingShortcut({ slug, enabled }: { slug: string; enabled: boolean }) {
  const path = `/e/${slug}`
  const url = `${window.location.origin}${path}`
  const [copied, setCopied] = useState(false)
  useEffect(() => {
    if (!copied) return
    const t = setTimeout(() => setCopied(false), 2000)
    return () => clearTimeout(t)
  }, [copied])

  async function copy() {
    try { await navigator.clipboard.writeText(url); setCopied(true) } catch { /* clipboard blocked: the address stays visible to copy by hand */ }
  }

  return (
    <section className="tile tile--wide landing-tile rise" style={{ animationDelay: '180ms' }} aria-labelledby="landing-tile-h">
      <div className="tile__head">
        <h2 className="tile__title" id="landing-tile-h">Tu página</h2>
        <Link className="link-btn" to="/app/ajustes#landing">Editar</Link>
      </div>
      <div className="landing-tile__row">
        <span className="landing-tile__url">
          <Icon name="globe" size={16} />
          <span className="landing-tile__addr">{url.replace(/^https?:\/\//, '')}</span>
          <span className={`tag${enabled ? ' tag--ok' : ''}`}>{enabled ? 'Publicada' : 'Oculta'}</span>
        </span>
        <span className="landing-tile__actions">
          <a className="btn btn--ghost" href={path} target="_blank" rel="noopener noreferrer">Abrir <Icon name="share" size={16} /></a>
          <button type="button" className="btn" onClick={copy} aria-live="polite">
            <Icon name={copied ? 'check' : 'copy'} size={16} /> {copied ? 'Copiado' : 'Copiar enlace'}
          </button>
        </span>
      </div>
      {!enabled && <p className="hint">Oculta: quien abra el enlace verá «Página no disponible». Publícala en Ajustes → Landing page.</p>}
    </section>
  )
}
