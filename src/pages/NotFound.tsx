import { Link } from 'react-router-dom'

export function NotFound() {
  return (
    <main className="center-screen">
      <div style={{ display: 'grid', gap: 16, justifyItems: 'center', textAlign: 'center' }}>
        <span className="eyebrow">Error 404</span>
        <h1 style={{ color: 'var(--text)', fontSize: 32 }}>No encontrado</h1>
        <Link className="btn" to="/">Volver al inicio</Link>
      </div>
    </main>
  )
}
