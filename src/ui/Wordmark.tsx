import { Link } from '../lib/nav'

/** The CRM's mark. `plain`: just the mark, not a link (a signature). */
export function Wordmark({ to = '/', plain }: { to?: string; plain?: boolean }) {
  const mark = (
    <>
      <svg viewBox="0 0 32 32" width="26" height="26" aria-hidden="true">
        <rect width="32" height="32" rx="7" fill="var(--text)" />
        <path d="M8 22V10l8 7 8-7v12" fill="none" stroke="var(--bg)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="25" cy="7" r="2.5" fill="var(--accent)" />
      </svg>
      <span>Martial CRM</span>
    </>
  )
  if (plain) return <span className="wordmark">{mark}</span>
  return (
    <Link to={to} className="wordmark" aria-label="Martial CRM, inicio">
      {mark}
    </Link>
  )
}
