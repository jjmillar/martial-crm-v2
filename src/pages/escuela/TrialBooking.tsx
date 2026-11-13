import { useMemo, useState, type FormEvent } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { dayMonth } from '../../lib/dates'
import { hhmm, isoWeekday, weekdayLong, weekdayShort } from '../../lib/weekdays'
import { Icon } from '../../ui/Icon'
import type { Landing } from './api'

type Slot = NonNullable<Landing['trial']>['slots'][number]

const errorText = (m: string) =>
  m.includes('slot full') ? 'Ese horario se acaba de llenar. Elige otro, por favor.'
    : m.includes('too many') ? 'Ya tienes clases de prueba agendadas con este teléfono. Si necesitas cambiarla, escríbenos.'
      : m.includes('not available') ? 'Ese horario ya no está disponible. Recarga la página y elige otro.'
        : m.includes('check') ? 'Revisa tus datos: nombre, un teléfono válido y, si lo pones, un correo válido.'
          : 'No pudimos agendar. Intenta de nuevo en un momento.'

// Landing → "Clase de prueba gratis": pick a day and time from the school's slots and leave contact details.
export function TrialBooking({ s }: { s: Landing }) {
  const qc = useQueryClient()
  const slots = s.trial!.slots
  const dates = useMemo(() => [...new Set(slots.map((x) => x.date))], [slots])
  const [date, setDate] = useState(() => slots.find((x) => x.free > 0)?.date ?? dates[0] ?? '')
  const [pick, setPick] = useState<Slot | null>(null)
  const [f, setF] = useState({ name: '', phone: '', email: '', notes: '' })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState<Slot | null>(null)
  const times = slots.filter((x) => x.date === date)
  const isPicked = (x: Slot) => pick?.slot_id === x.slot_id && pick.date === x.date

  async function submit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    if (!pick) return setError('Elige un horario.')
    if (f.name.trim().length < 2) return setError('Escribe tu nombre.')
    if (f.phone.replace(/\D/g, '').length < 8) return setError('Escribe un teléfono válido para confirmarte la clase.')
    if (f.email.trim() && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(f.email.trim())) return setError('El correo no parece válido.')
    setBusy(true)
    const { error: err } = await supabase.rpc('book_trial', {
      p_slug: s.slug, p_slot_id: pick.slot_id, p_date: pick.date, p_name: f.name.trim(), p_phone: f.phone.trim(),
      p_email: f.email.trim() || undefined, p_notes: f.notes.trim() || undefined,
    })
    setBusy(false)
    if (err) { setError(errorText(err.message)); setPick(null); await qc.invalidateQueries({ queryKey: ['landing', s.slug] }); return }
    setDone(pick)
    await qc.invalidateQueries({ queryKey: ['landing', s.slug] })
  }

  return (
    <section className="sp-section sp-trial" id="prueba" aria-labelledby="sp-trial-h">
      <h2 id="sp-trial-h">Clase de prueba gratis</h2>
      {done ? (
        <div className="sp-trial__done" role="status">
          <Icon name="check" size={28} />
          <p><b>¡Listo, {f.name.trim().split(' ')[0]}!</b> Te esperamos el {weekdayLong(isoWeekday(done.date)).toLowerCase()} {dayMonth(done.date)} a las {hhmm(done.start)}.</p>
          {s.trial!.note && <p className="sp-muted">{s.trial!.note}</p>}
          {s.address && <p className="sp-muted">{[s.address, s.city].filter(Boolean).join(', ')}</p>}
        </div>
      ) : slots.length === 0 ? (
        <p className="sp-muted">Por ahora no hay horarios disponibles. Escríbenos para coordinar tu clase.</p>
      ) : (
        <form className="sp-trial__form" onSubmit={submit} noValidate>
          <p className="sp-muted">Elige un día y una hora, déjanos tus datos y te esperamos. Sin costo ni compromiso.</p>
          {s.trial!.note && <p className="sp-trial__note">{s.trial!.note}</p>}
          <div className="sp-trial__days" role="radiogroup" aria-label="Día">
            {dates.map((d) => {
              const full = slots.filter((x) => x.date === d).every((x) => x.free <= 0)
              return (
                <button key={d} type="button" role="radio" aria-checked={d === date} disabled={full}
                  className={`sp-trial__day${d === date ? ' is-on' : ''}`} onClick={() => { setDate(d); setPick(null) }}>
                  <span>{weekdayShort(isoWeekday(d))}</span><b>{dayMonth(d)}</b>{full && <small>Lleno</small>}
                </button>
              )
            })}
          </div>
          <div className="sp-trial__times" role="radiogroup" aria-label="Hora">
            {times.map((x) => (
              <button key={x.slot_id} type="button" role="radio" aria-checked={isPicked(x)} disabled={x.free <= 0}
                className={`sp-trial__time${isPicked(x) ? ' is-on' : ''}`} onClick={() => setPick(x)}>
                {hhmm(x.start)}–{hhmm(x.end)} <small>{x.free <= 0 ? 'Lleno' : x.free === 1 ? '1 cupo' : `${x.free} cupos`}</small>
              </button>
            ))}
          </div>
          <div className="sp-trial__fields">
            <label>Nombre<input className="input" autoComplete="name" maxLength={80} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></label>
            <label>Teléfono<input className="input" type="tel" autoComplete="tel" maxLength={30} placeholder="+56 9 1234 5678" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} /></label>
            <label>Correo (opcional)<input className="input" type="email" autoComplete="email" maxLength={120} value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></label>
            <label>Comentario (opcional)<input className="input" maxLength={300} placeholder="Ej: nunca he entrenado, vengo con un amigo" value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} /></label>
          </div>
          {error && <p className="alert" role="alert">{error}</p>}
          <button className="sp-btn sp-btn--lg" type="submit" disabled={busy}>
            {busy ? 'Agendando…' : pick ? `Agendar ${weekdayShort(isoWeekday(pick.date))} ${dayMonth(pick.date)} · ${hhmm(pick.start)}` : 'Agendar clase gratis'}
          </button>
        </form>
      )}
    </section>
  )
}
