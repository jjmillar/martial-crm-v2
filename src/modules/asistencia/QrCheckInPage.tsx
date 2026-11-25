import { useEffect, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Link } from '../../lib/nav'
import { Icon } from '../../ui/Icon'
import { currentSpot, distanceText, qrCheckIn, qrErrorText, QR_RADIUS_M, type QrResult, type Spot } from './qr'

// Landing of the printed QR (/app/qr/<code>). The app layout already sent the visitor through login if needed;
// here the check-in runs once on arrival: first the phone's location (the database checks it is within 150 m of
// the school; farther or unknown → a request the team approves), then the result, readable at arm's length.
export function QrCheckInPage({ token }: { token: string }) {
  const qc = useQueryClient()
  const [res, setRes] = useState<QrResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState<'locating' | 'marking' | null>('locating')
  const started = useRef(false)
  const spot = useRef<Spot>(null)
  const who = useRef<string | undefined>(undefined) // the person a guardian chose, kept for "try again"

  const run = async (studentId?: string, locate = false) => {
    setError(null)
    if (studentId) who.current = studentId
    if (locate) {
      setBusy('locating')
      spot.current = await currentSpot()
    }
    setBusy('marking')
    try {
      const r = await qrCheckIn(token, who.current, spot.current)
      setRes(r)
      if ('ok' in r) qc.invalidateQueries()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(null)
    }
  }

  useEffect(() => {
    if (started.current) return // StrictMode / re-renders: a scan checks in once
    started.current = true
    void run(undefined, true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="qr-checkin">
      {busy && (
        <section className="card qr-checkin__card" aria-live="polite">
          <span className="qr-checkin__icon is-wait" aria-hidden="true"><Icon name={busy === 'locating' ? 'pin' : 'clock'} size={34} /></span>
          <h1>{busy === 'locating' ? 'Comprobando que estás en la escuela…' : 'Marcando tu asistencia…'}</h1>
          {busy === 'locating' && <p className="hint">Si el teléfono pregunta, permite usar tu ubicación. Solo se guarda a qué distancia estabas, nunca dónde.</p>}
        </section>
      )}

      {!busy && error && (
        <section className="card qr-checkin__card" role="alert">
          <span className="qr-checkin__icon is-bad" aria-hidden="true"><Icon name="close" size={34} /></span>
          <h1>No se pudo marcar</h1>
          <p className="hint">{error}</p>
          <button type="button" className="btn" onClick={() => run(undefined, true)}>Intentar de nuevo</button>
        </section>
      )}

      {!busy && res && 'pending' in res && res.pending && (
        <section className="card qr-checkin__card" role="status">
          <span className="qr-checkin__icon is-wait-static" aria-hidden="true"><Icon name="clock" size={34} /></span>
          <h1>Quedó por aprobar</h1>
          <p className="qr-checkin__class">{res.class}</p>
          <p className="hint">{res.start}–{res.end} · {res.student}</p>
          <p className="hint">
            {res.reason === 'far'
              ? <>Estás a <b>{distanceText(res.distance!)}</b> de la escuela. El QR confirma al instante solo a menos de {QR_RADIUS_M} m; la escuela revisará tu asistencia.</>
              : <>No pudimos saber tu ubicación, así que la escuela revisará tu asistencia. Activa la ubicación del teléfono y vuelve a intentarlo para que quede confirmada al instante.</>}
          </p>
          <button type="button" className="btn" onClick={() => run(who.current, true)}><Icon name="pin" size={16} /> Volver a intentar con mi ubicación</button>
          <Link className="btn btn--ghost" to="/app/asistencia">Ver mi asistencia</Link>
        </section>
      )}

      {!busy && res && 'ok' in res && res.ok && (
        <section className="card qr-checkin__card" role="status">
          <span className="qr-checkin__icon is-ok" aria-hidden="true"><Icon name="check" size={38} /></span>
          <h1>{res.already ? 'Ya estabas marcado' : '¡Asistencia marcada!'}</h1>
          <p className="qr-checkin__class">{res.class}</p>
          <p className="hint">{res.start}–{res.end} · {res.student}</p>
          <p className="hint">{res.already ? 'Tu asistencia a esta clase ya estaba registrada.' : 'Quedó confirmada y suma XP. ¡Buen entrenamiento!'}</p>
          <Link className="btn btn--ghost" to="/app/asistencia">Ver mi asistencia</Link>
        </section>
      )}

      {!busy && res && 'choose' in res && (
        <section className="card qr-checkin__card">
          <span className="qr-checkin__icon" aria-hidden="true"><Icon name="users" size={34} /></span>
          <h1>¿Quién viene a clase?</h1>
          <p className="hint">Tu cuenta tiene a más de una persona en esta escuela. Toca a quien vas a marcar.</p>
          <div className="qr-checkin__people">
            {res.choose.map((p) => (
              <button key={p.id} type="button" className="btn" onClick={() => run(p.id)}>{p.name}</button>
            ))}
          </div>
        </section>
      )}

      {!busy && res && 'error' in res && (
        <section className="card qr-checkin__card" role="alert">
          <span className="qr-checkin__icon is-bad" aria-hidden="true"><Icon name={res.error === 'no_class' ? 'clock' : 'close'} size={34} /></span>
          {res.error === 'no_class' ? (
            <>
              <h1>No hay clase ahora</h1>
              <p className="hint">
                El QR marca desde 1 hora antes de que empiece la clase hasta que termina.
                {res.next ? <> La próxima de hoy es <b>{res.next.name}</b> a las <b>{res.next.start}</b>.</> : ' Hoy no quedan más clases.'}
              </p>
            </>
          ) : (
            <>
              <h1>No se pudo marcar</h1>
              <p className="hint">{qrErrorText[res.error]}</p>
            </>
          )}
          <Link className="btn btn--ghost" to="/app">Ir al inicio</Link>
        </section>
      )}
    </div>
  )
}
