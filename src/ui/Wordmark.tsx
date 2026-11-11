import { Link } from 'react-router-dom'

export function Wordmark({ to = '/' }: { to?: string }) {
  return (
    <Link to={to} className="wordmark" aria-label="Martial CRM, inicio">
      <svg viewBox="0 0 32 32" width="26" height="26" aria-hidden="true">
        <rect width="32" height="32" rx="7" fill="var(--text)" />
        <path d="M8 22V10l8 7 8-7v12" fill="none" stroke="var(--bg)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="25" cy="7" r="2.5" fill="var(--accent)" />
      </svg>
      <span>Martial CRM</span>
    </Link>
  )
}
