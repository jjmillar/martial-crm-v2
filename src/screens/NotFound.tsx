import { Link } from '../lib/nav'

export function NotFound() {
  return (
    <main className="center-screen">
      <div style={{ display: 'grid', gap: 16, justifyItems: 'center', textAlign: 'center' }}>
        <h1 style={{ color: 'var(--text)', fontSize: 32 }}>No encontrado</h1>
        <p className="hint">Error 404: esta página no existe o se movió.</p>
        <Link className="btn" to="/">Volver al inicio</Link>
      </div>
    </main>
  )
}
