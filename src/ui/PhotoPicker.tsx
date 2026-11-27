import { useEffect, useRef, useState } from 'react'
import { squareJpeg } from '../lib/avatars'
import { Avatar } from './Avatar'
import { Icon } from './Icon'
import { Modal } from './Modal'

/** Phones and tablets: the system camera (input capture). Computers: the webcam inside a pop-up. */
const touchDevice = () => typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches

/**
 * Profile photo: shows the current one (or initials) with "Subir foto", "Tomar foto" and "Quitar".
 * `onChange` gets the processed photo (square JPEG) or null to remove it; while it runs the buttons wait.
 * `preview` shows a photo chosen but not saved yet (a new record saves it together with the form).
 */
export function PhotoPicker({ path, name, onChange, preview, hint }: {
  path: string | null | undefined
  name: string
  onChange: (photo: Blob | null) => Promise<unknown>
  preview?: Blob | null
  hint?: string
}) {
  const file = useRef<HTMLInputElement>(null)
  const cam = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [camOpen, setCamOpen] = useState(false)
  const previewUrl = useObjectUrl(preview ?? null)

  async function apply(photo: Blob | null) {
    setErr(null); setBusy(true)
    try { await onChange(photo) } catch (e) { setErr((e as Error).message) } finally { setBusy(false) }
  }
  async function picked(f: File | undefined) {
    if (!f) return
    try { await apply(await squareJpeg(f)) } catch (e) { setErr((e as Error).message) }
  }
  const has = Boolean(path || preview)

  return (
    <div className="photo-picker">
      {previewUrl ? <span className="avatar avatar--photo photo-picker__img" aria-hidden="true"><img src={previewUrl} alt="" /></span>
        : <Avatar path={path} name={name} size={88} className="photo-picker__img" />}
      <div className="photo-picker__side">
        <div className="photo-picker__actions">
          <button type="button" className="btn btn--ghost" disabled={busy} onClick={() => file.current?.click()}><Icon name="image" size={16} /> {has ? 'Cambiar foto' : 'Subir foto'}</button>
          <button type="button" className="btn btn--ghost" disabled={busy} onClick={() => (touchDevice() || !navigator.mediaDevices?.getUserMedia ? cam.current?.click() : setCamOpen(true))}>
            <Icon name="camera" size={16} /> Tomar foto
          </button>
          {has && <button type="button" className="link-btn" disabled={busy} onClick={() => apply(null)}>Quitar</button>}
        </div>
        <span className="hint" role={err ? 'alert' : undefined}>{err ?? (busy ? 'Guardando foto…' : hint ?? 'Se recorta cuadrada. Solo la ve tu escuela.')}</span>
      </div>
      <input ref={file} type="file" accept="image/*" hidden onChange={(e) => { picked(e.target.files?.[0]); e.target.value = '' }} />
      <input ref={cam} type="file" accept="image/*" capture="user" hidden onChange={(e) => { picked(e.target.files?.[0]); e.target.value = '' }} />
      <Modal open={camOpen} onClose={() => setCamOpen(false)} labelledBy="cam-h">
        {camOpen && <Camera onShot={async (b) => { setCamOpen(false); await apply(b) }} onFallback={() => { setCamOpen(false); cam.current?.click() }} onClose={() => setCamOpen(false)} />}
      </Modal>
    </div>
  )
}

function useObjectUrl(b: Blob | null) {
  const [url, setUrl] = useState<string | null>(null)
  useEffect(() => {
    if (!b) { setUrl(null); return }
    const u = URL.createObjectURL(b)
    setUrl(u)
    return () => URL.revokeObjectURL(u)
  }, [b])
  return url
}

/** Webcam in a pop-up: live square preview, "Tomar foto". The camera turns off as soon as it closes. */
function Camera({ onShot, onFallback, onClose }: { onShot: (b: Blob) => void; onFallback: () => void; onClose: () => void }) {
  const video = useRef<HTMLVideoElement>(null)
  const [ready, setReady] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  useEffect(() => {
    let stream: MediaStream | null = null
    let stop = false
    navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 1280 } }, audio: false })
      .then((s) => {
        if (stop) { s.getTracks().forEach((t) => t.stop()); return }
        stream = s
        if (video.current) { video.current.srcObject = s; video.current.play().then(() => setReady(true)).catch(() => setReady(true)) }
      })
      .catch((e: Error) => setErr(e.name === 'NotAllowedError' ? 'No diste permiso para usar la cámara. Actívalo en el navegador o sube una foto.' : 'No encontramos una cámara en este dispositivo.'))
    return () => { stop = true; stream?.getTracks().forEach((t) => t.stop()) }
  }, [])
  return (
    <div className="sub-form camera">
      <div className="modal__head">
        <h2 id="cam-h">Tomar foto</h2>
        <button type="button" className="icon-btn" onClick={onClose} aria-label="Cerrar"><Icon name="close" /></button>
      </div>
      {err ? <p className="alert" role="alert">{err}</p> : (
        <div className="camera__frame">
          <video ref={video} playsInline muted aria-label="Vista de la cámara" />
          {!ready && <span className="hint camera__wait">Encendiendo la cámara…</span>}
        </div>
      )}
      <div className="form-actions">
        {!err && <button type="button" className="btn" disabled={!ready} onClick={async () => { try { onShot(await squareJpeg(video.current!)) } catch (e) { setErr((e as Error).message) } }}><Icon name="camera" size={16} /> Tomar foto</button>}
        {err && <button type="button" className="btn" onClick={onFallback}>Elegir de otra forma</button>}
        <button type="button" className="btn btn--ghost" onClick={onClose}>Cancelar</button>
      </div>
    </div>
  )
}
