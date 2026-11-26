import { useEffect, useRef, useState } from 'react'
import type { Circle, Map as LMap, Marker } from 'leaflet'
import { supabase } from '../../lib/supabase'
import { geoKey } from '../../lib/geocode'
import type { School } from '../../lib/database.types'
import { Icon } from '../../ui/Icon'
import { Modal } from '../../ui/Modal'
import { QR_RADIUS_M } from '../asistencia/qr'

const SANTIAGO = { lat: -33.4489, lng: -70.6693 }
type Pt = { lat: number; lng: number }

// Pop-up to fix the school's point by hand when the address landed in the wrong place: tap the map or drag the
// pin to the room (the circle is the 150 m of the QR check-in). Saved for the current address, so the automatic
// lookup doesn't overwrite it; changing the address later clears it as usual.
export function SchoolMapPicker({ school, open, onClose, onSaved }: { school: School; open: boolean; onClose: () => void; onSaved: () => void }) {
  const box = useRef<HTMLDivElement>(null)
  const map = useRef<LMap | null>(null)
  const pin = useRef<Marker | null>(null)
  const ring = useRef<Circle | null>(null)
  const placeRef = useRef<(p: Pt) => void>(() => {})
  const start: Pt | null = school.geo_lat != null && school.geo_lng != null ? { lat: school.geo_lat, lng: school.geo_lng } : null
  const [pt, setPt] = useState<Pt | null>(start)
  const [busy, setBusy] = useState<'save' | 'locate' | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    let gone = false
    setPt(start)
    setError(null)
    // Leaflet only in the browser and only when the pop-up opens (keeps it out of the main bundle).
    const t = setTimeout(async () => {
      const L = await import('leaflet')
      if (gone || !box.current) return
      const at = start ?? SANTIAGO
      const m = L.map(box.current, { center: [at.lat, at.lng], zoom: start ? 17 : 12 })
      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19, attribution: '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a>',
      }).addTo(m)
      const icon = L.divIcon({ className: 'map-pin', html: '<span></span>', iconSize: [28, 28], iconAnchor: [14, 28] })
      const place = (p: Pt) => {
        setPt(p)
        if (!pin.current) {
          pin.current = L.marker([p.lat, p.lng], { icon, draggable: true, keyboard: true, title: 'La sala' }).addTo(m)
          pin.current.on('drag', () => { const ll = pin.current!.getLatLng(); ring.current?.setLatLng(ll) })
          pin.current.on('dragend', () => { const ll = pin.current!.getLatLng(); setPt({ lat: ll.lat, lng: ll.lng }) })
          ring.current = L.circle([p.lat, p.lng], { radius: QR_RADIUS_M, color: '#e0492c', weight: 2, fillOpacity: 0.08 }).addTo(m)
        } else {
          pin.current.setLatLng([p.lat, p.lng])
          ring.current?.setLatLng([p.lat, p.lng])
        }
      }
      if (start) place(start)
      m.on('click', (e) => place({ lat: e.latlng.lat, lng: e.latlng.lng }))
      map.current = m
      placeRef.current = place
    }, 60)
    return () => {
      gone = true
      clearTimeout(t)
      map.current?.remove()
      map.current = null
      pin.current = null
      ring.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  function locate() {
    if (!('geolocation' in navigator)) return setError('Este navegador no entrega la ubicación.')
    setBusy('locate')
    setError(null)
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setBusy(null)
        const here = { lat: p.coords.latitude, lng: p.coords.longitude }
        placeRef.current(here)
        map.current?.setView([here.lat, here.lng], 17)
      },
      () => { setBusy(null); setError('No pudimos obtener tu ubicación. Revisa el permiso de ubicación del navegador.') },
      { enableHighAccuracy: true, timeout: 12000 },
    )
  }

  async function save() {
    if (!pt) return
    setBusy('save')
    setError(null)
    const { data, error: err } = await supabase.from('schools')
      .update({ geo_lat: pt.lat, geo_lng: pt.lng, geo_address: geoKey(school) }).eq('id', school.id).select('id')
    setBusy(null)
    if (err || !data?.length) return setError('No se pudo guardar. Solo el CEO o un administrador pueden cambiar la ubicación.')
    onSaved()
    onClose()
  }

  return (
    <Modal open={open} onClose={onClose} wide label="Ubicación de la escuela">
      <div className="modal__head">
        <h2 className="modal__title">Ubicación de la escuela</h2>
        <button type="button" className="icon-btn" onClick={onClose} aria-label="Cerrar"><Icon name="close" /></button>
      </div>
      <div className="map-picker">
        <p className="hint">Toca el mapa o arrastra el punto hasta la sala. El círculo son los {QR_RADIUS_M} m en que el QR confirma la asistencia al instante.</p>
        <div ref={box} className="map-picker__map" role="application" aria-label="Mapa: toca para marcar la sala" />
        {error && <p className="alert" role="alert">{error}</p>}
        <div className="form-actions">
          <button type="button" className="btn" disabled={!pt || busy !== null} onClick={save}>
            <Icon name="check" size={16} /> {busy === 'save' ? 'Guardando…' : 'Guardar ubicación'}
          </button>
          <button type="button" className="btn btn--ghost" disabled={busy !== null} onClick={locate}>
            <Icon name="pin" size={16} /> {busy === 'locate' ? 'Buscando…' : 'Estoy en la sala: usar mi ubicación'}
          </button>
          <button type="button" className="btn btn--ghost" onClick={onClose}>Cancelar</button>
        </div>
      </div>
    </Modal>
  )
}
