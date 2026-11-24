import { Link } from '../lib/nav'
import { Wordmark } from '../ui/Wordmark'
import { LEGAL_TITLE, Privacidad, TERMS_DATE, TERMS_VERSION, Terminos, type LegalKind } from './legal'

/** Body of a legal document: shared by its public page and the pop-up opened from the sign-up forms. */
export function LegalBody({ kind }: { kind: LegalKind }) {
  return (
    <div className="legal">
      <p className="hint">Versión {TERMS_VERSION} · vigente desde el {TERMS_DATE}</p>
      {kind === 'terminos' ? <Terminos /> : <Privacidad />}
    </div>
  )
}

// /terminos and /privacidad: public, readable without an account.
export function LegalPage({ kind }: { kind: LegalKind }) {
  const other: LegalKind = kind === 'terminos' ? 'privacidad' : 'terminos'
  return (
    <div className="auth">
      <header className="auth__nav">
        <Wordmark />
        <Link className="link-btn" to={`/${other}`}>{LEGAL_TITLE[other]}</Link>
      </header>
      <main className="legal-page">
        <span className="eyebrow">Martial CRM</span>
        <h1>{LEGAL_TITLE[kind]}</h1>
        <LegalBody kind={kind} />
      </main>
    </div>
  )
}
