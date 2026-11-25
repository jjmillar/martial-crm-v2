import { useEffect, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import QRCode from 'qrcode'
import type { School } from '../../lib/database.types'
import { Icon } from '../../ui/Icon'
import { checkInUrl, getCheckInCode, qrCodeKey, rotateCheckInCode } from '../asistencia/qr'

const dateFmt = new Intl.DateTimeFormat('es-CL', { dateStyle: 'long' })

// Ajustes → "Check-in con QR" (CEO/admin): the poster to print and stick in the room. Scanning it marks the class
// that is about to start or under way (from 1 h before until the end) for the signed-in student, confirmed.
export function QrCheckIn({ school }: { school: School }) {
  const qc = useQueryClient()
  const key = qrCodeKey(school.id)
  const code = useQuery({ queryKey: key, queryFn: () => getCheckInCode(school.id) })
  const [confirming, setConfirming] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const canvas = useRef<HTMLCanvasElement>(null)
  const [ready, setReady] = useState(false)

  const rotate = useMutation({
    mutationFn: () => rotateCheckInCode(school.id),
    onMutate: () => setError(null),
    onSuccess: () => { setConfirming(false); qc.invalidateQueries({ queryKey: key }) },
    onError: (e: Error) => setError(e.message),
  })

  const token = code.data?.token
  useEffect(() => {
    if (!token || !canvas.current) return
    let alive = true
    setReady(false)
    drawPoster(canvas.current, checkInUrl(token), school).then(() => { if (alive) setReady(true) })
    return () => { alive = false }
  }, [token, school])

  function download() {
    canvas.current?.toBlob((b) => {
      if (!b) return
      const a = document.createElement('a')
      a.href = URL.createObjectURL(b)
      a.download = `qr-asistencia-${school.slug}.png`
      a.click()
      setTimeout(() => URL.revokeObjectURL(a.href), 1000)
    }, 'image/png')
  }

  function print() {
    const src = canvas.current?.toDataURL('image/png')
    const w = src && window.open('', '_blank')
    if (!w) return setError('El navegador bloqueó la ventana de impresión. Usa "Descargar" e imprime la imagen.')
    w.document.title = `QR de asistencia · ${school.name}`
    const style = w.document.createElement('style')
    style.textContent = '@page{size:A4;margin:0}html,body{margin:0;height:100%}body{display:grid;place-items:center}img{width:100%;max-height:100vh;object-fit:contain}'
    const img = w.document.createElement('img')
    img.alt = 'QR de asistencia'
    img.onload = () => { w.focus(); w.print() }
    img.src = src
    w.document.head.appendChild(style)
    w.document.body.appendChild(img)
  }

  return (
    <div className="qr-settings">
      <p className="hint">
        Imprime este QR y pégalo en la sala. El alumno lo escanea con la cámara del teléfono y, con su sesión iniciada
        (o después de iniciarla), su asistencia queda <b>confirmada al instante</b> para la clase que empieza dentro de
        la próxima hora o que está en curso.
      </p>
      {code.isLoading && <p className="hint">Cargando…</p>}
      {code.isError && <p className="alert">No se pudo cargar el QR.</p>}
      {error && <p className="alert" role="alert">{error}</p>}

      {code.isSuccess && !token && (
        <button type="button" className="btn qr-settings__first" disabled={rotate.isPending} onClick={() => rotate.mutate()}>
          <Icon name="qr" size={16} /> {rotate.isPending ? 'Generando…' : 'Generar QR de asistencia'}
        </button>
      )}

      {token && (
        <div className="qr-settings__grid">
          <canvas ref={canvas} className="qr-settings__poster" aria-label={`Afiche con el QR de asistencia de ${school.name}`} role="img" />
          <div className="qr-settings__side">
            <div className="qr-settings__actions">
              <button type="button" className="btn" onClick={print} disabled={!ready}><Icon name="share" size={16} /> Imprimir</button>
              <button type="button" className="btn btn--ghost" onClick={download} disabled={!ready}>Descargar imagen</button>
            </div>
            <p className="hint">Generado el {dateFmt.format(new Date(code.data!.created_at))}.</p>
            <div className="qr-settings__rotate">
              <strong>¿Alguien compartió una foto del QR?</strong>
              <p className="hint">Genera uno nuevo: el anterior deja de funcionar al instante y tendrás que imprimir y pegar el nuevo.</p>
              {confirming ? (
                <div className="qr-settings__actions">
                  <button type="button" className="btn btn--danger" disabled={rotate.isPending} onClick={() => rotate.mutate()}>
                    {rotate.isPending ? 'Generando…' : 'Sí, generar uno nuevo'}
                  </button>
                  <button type="button" className="btn btn--ghost" onClick={() => setConfirming(false)}>Cancelar</button>
                </div>
              ) : (
                <button type="button" className="btn btn--ghost" onClick={() => setConfirming(true)}>Generar QR nuevo</button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

/** A4 poster (150 dpi): school name, the QR with the school's logo in the middle, and how to use it. */
async function drawPoster(c: HTMLCanvasElement, url: string, school: School) {
  const W = 1240, H = 1754, Q = 940
  c.width = W
  c.height = H
  const g = c.getContext('2d')!
  g.fillStyle = '#ffffff'
  g.fillRect(0, 0, W, H)
  g.fillStyle = '#111114'
  g.textAlign = 'center'
  g.font = '700 76px Inter, system-ui, sans-serif'
  fitText(g, school.name, W / 2, 230, W - 160)
  g.font = '500 46px Inter, system-ui, sans-serif'
  g.fillStyle = '#3a3a42'
  g.fillText('Escanea para marcar tu asistencia', W / 2, 320)

  const qr = document.createElement('canvas')
  await QRCode.toCanvas(qr, url, { errorCorrectionLevel: 'H', margin: 0, width: Q, color: { dark: '#111114', light: '#ffffff' } })
  const qx = (W - Q) / 2, qy = 400
  g.drawImage(qr, qx, qy, Q, Q)

  // Logo in the middle (H correction keeps the code readable with ~20% covered).
  const L = Math.round(Q * 0.22), lx = W / 2 - L / 2, ly = qy + Q / 2 - L / 2
  g.fillStyle = '#ffffff'
  roundRect(g, lx - 14, ly - 14, L + 28, L + 28, 28)
  g.fill()
  const logo = school.logo_url ? await loadImage(school.logo_url) : null
  if (logo) {
    const r = Math.min(L / logo.width, L / logo.height)
    const w = logo.width * r, h = logo.height * r
    g.drawImage(logo, W / 2 - w / 2, qy + Q / 2 - h / 2, w, h)
  } else {
    g.fillStyle = '#111114'
    roundRect(g, lx, ly, L, L, 22)
    g.fill()
    g.fillStyle = '#ffffff'
    g.font = `700 ${Math.round(L * 0.42)}px Inter, system-ui, sans-serif`
    g.textBaseline = 'middle'
    g.fillText(school.name.slice(0, 2).toUpperCase(), W / 2, qy + Q / 2 + 4)
    g.textBaseline = 'alphabetic'
  }

  g.fillStyle = '#111114'
  g.font = '600 40px Inter, system-ui, sans-serif'
  g.fillText('1. Abre la cámara y apunta al código', W / 2, 1480)
  g.fillText('2. Inicia sesión si te lo pide', W / 2, 1540)
  g.font = '400 32px Inter, system-ui, sans-serif'
  g.fillStyle = '#5a5a64'
  g.fillText('Funciona desde 1 hora antes de la clase hasta que termina', W / 2, 1610)
  g.font = '600 28px Inter, system-ui, sans-serif'
  g.fillStyle = '#9a9aa4'
  g.fillText('Martial CRM', W / 2, 1690)
}

function fitText(g: CanvasRenderingContext2D, text: string, x: number, y: number, max: number) {
  let size = 76
  while (g.measureText(text).width > max && size > 36) {
    size -= 4
    g.font = `700 ${size}px Inter, system-ui, sans-serif`
  }
  g.fillText(text, x, y, max)
}

function roundRect(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  g.beginPath()
  g.moveTo(x + r, y)
  g.arcTo(x + w, y, x + w, y + h, r)
  g.arcTo(x + w, y + h, x, y + h, r)
  g.arcTo(x, y + h, x, y, r)
  g.arcTo(x, y, x + w, y, r)
  g.closePath()
}

/** The logo with CORS so the poster can still be exported; null if it can't be loaded that way. */
function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = () => resolve(null)
    img.src = src
  })
}
