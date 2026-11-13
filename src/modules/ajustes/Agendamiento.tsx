import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { useSchool } from '../../lib/school'
import { formatDate, todayIso } from '../../lib/dates'
import { hhmm, weekdayLong, weekdayShort, weekdays } from '../../lib/weekdays'
import type { School } from '../../lib/database.types'
import { Icon } from '../../ui/Icon'

type Slot = { id: string; weekday: number; start_time: string; end_time: string; capacity: number; active: boolean }
type Booking = { id: string; date: string; start_time: string; name: string; phone: string; email: string | null; notes: string | null }

// Ajustes → Agendamiento: free trial class booking from the landing page (on/off, weekly slots, upcoming bookings).
export function Agendamiento({ school }: { school: School }) {
  const { reload } = useSchool()
  const qc = useQueryClient()
  const slotsKey = ['trial-slots', school.id]
  const bookingsKey = ['trial-bookings', school.id]
  const [enabled, setEnabled] = useState(school.trial_enabled)
  const [note, setNote] = useState(school.trial_note ?? '')
  const [n, setN] = useState({ weekday: 1, start: '19:00', end: '20:00', capacity: 2 })
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const today = todayIso()

  const slots = useQuery({
    queryKey: slotsKey,
    queryFn: async () => {
      const { data, error } = await supabase.from('trial_slots').select('id, weekday, start_time, end_time, capacity, active').eq('school_id', school.id).order('weekday').order('start_time')
      if (error) throw error
      return data as Slot[]
    },
  })
  const bookings = useQuery({
    queryKey: bookingsKey,
    queryFn: async () => {
      const { data, error } = await supabase.from('trial_bookings').select('id, date, start_time, name, phone, email, notes')
        .eq('school_id', school.id).eq('status', 'agendada').gte('date', today).order('date').order('start_time').limit(30)
      if (error) throw error
      return data as Booking[]
    },
  })
  const refresh = () => Promise.all([qc.invalidateQueries({ queryKey: slotsKey }), qc.invalidateQueries({ queryKey: ['landing', school.slug] })])

  const saveSettings = useMutation({
    mutationFn: async () => {
      if (enabled && !(slots.data ?? []).some((s) => s.active)) throw new Error('Agrega al menos un horario antes de activar el agendamiento.')
      const { error } = await supabase.from('schools').update({ trial_enabled: enabled, trial_note: note.trim() || null }).eq('id', school.id)
      if (error) throw new Error('No se pudo guardar. Solo los administradores pueden cambiarlo.')
      await reload()
      await refresh()
    },
    onMutate: () => setMsg(null),
    onSuccess: () => setMsg({ ok: true, text: enabled ? 'Agendamiento activo: aparece en tu landing page.' : 'Agendamiento desactivado.' }),
    onError: (e: Error) => setMsg({ ok: false, text: e.message }),
  })

  const addSlot = useMutation({
    mutationFn: async () => {
      if (n.end <= n.start) throw new Error('La hora de término debe ser después del inicio.')
      const { error } = await supabase.from('trial_slots').insert({ school_id: school.id, weekday: n.weekday, start_time: n.start, end_time: n.end, capacity: n.capacity })
      if (error) throw new Error('No se pudo agregar el horario.')
    },
    onMutate: () => setMsg(null),
    onSuccess: refresh,
    onError: (e: Error) => setMsg({ ok: false, text: e.message }),
  })
  const toggleSlot = useMutation({
    mutationFn: async (s: Slot) => { await supabase.from('trial_slots').update({ active: !s.active }).eq('id', s.id) },
    onSettled: refresh,
  })
  const removeSlot = useMutation({
    mutationFn: async (s: Slot) => {
      const { error } = await supabase.from('trial_slots').delete().eq('id', s.id)
      if (error) throw new Error('No se pudo eliminar el horario.')
    },
    onError: (e: Error) => setMsg({ ok: false, text: e.message }),
    onSettled: refresh,
  })
  const cancel = useMutation({
    mutationFn: async (b: Booking) => {
      const { error } = await supabase.from('trial_bookings').update({ status: 'cancelada' }).eq('id', b.id)
      if (error) throw new Error('No se pudo cancelar la reserva.')
    },
    onError: (e: Error) => setMsg({ ok: false, text: e.message }),
    onSettled: () => Promise.all([qc.invalidateQueries({ queryKey: bookingsKey }), refresh()]),
  })

  return (
    <section className="card ajustes__section agenda" aria-labelledby="agenda-h">
      <div className="ajustes__section-head">
        <div>
          <h2 id="agenda-h">Agendamiento</h2>
          <p className="hint">Las personas agendan una clase de prueba gratis desde tu landing page, en los horarios que definas aquí. Cada reserva llega a Tareas.</p>
        </div>
        {school.landing_enabled && <a className="btn btn--ghost" href={`/e/${school.slug}#prueba`} target="_blank" rel="noopener noreferrer"><Icon name="globe" size={16} /> Ver en la página</a>}
      </div>

      <label className="switch">
        <input type="checkbox" checked={enabled} onChange={(e) => { setEnabled(e.target.checked); setMsg(null) }} />
        <span><strong>Recibir clases de prueba gratis</strong><span className="hint">{school.landing_enabled ? 'Muestra el formulario de agendamiento en la landing page.' : 'Tu landing page está oculta: actívala para que se vea el agendamiento.'}</span></span>
      </label>
      <div className="field">
        <label htmlFor="ag-note">Indicaciones para quien agenda (opcional)</label>
        <textarea id="ag-note" className="input" rows={2} maxLength={300} value={note} onChange={(e) => { setNote(e.target.value); setMsg(null) }} placeholder="Ej: Llega 10 minutos antes, con ropa cómoda y agua." />
      </div>
      {msg && <p className={`alert${msg.ok ? ' alert--ok' : ''}`} role={msg.ok ? 'status' : 'alert'}>{msg.text}</p>}
      <div className="form-actions"><button type="button" className="btn" disabled={saveSettings.isPending} onClick={() => saveSettings.mutate()}>{saveSettings.isPending ? 'Guardando…' : 'Guardar'}</button></div>

      <h3 className="ajustes__sub">Horarios disponibles</h3>
      {slots.isSuccess && slots.data.length === 0 && <p className="hint">Todavía no hay horarios. Agrega los días y horas en que recibes clases de prueba.</p>}
      {Boolean(slots.data?.length) && (
        <ul className="email-log">
          {slots.data!.map((s) => (
            <li key={s.id} className={`email-log__row agenda__slot${s.active ? '' : ' is-off'}`}>
              <span className="email-log__main">
                <strong>{weekdayLong(s.weekday)} · {hhmm(s.start_time)}–{hhmm(s.end_time)}</strong>
                <span className="hint">{s.capacity} {s.capacity === 1 ? 'cupo' : 'cupos'} por clase{s.active ? '' : ' · pausado'}</span>
              </span>
              <button type="button" className="btn btn--ghost btn--sm" onClick={() => toggleSlot.mutate(s)} disabled={toggleSlot.isPending}>{s.active ? 'Pausar' : 'Activar'}</button>
              <button type="button" className="icon-btn" aria-label={`Eliminar ${weekdayShort(s.weekday)} ${hhmm(s.start_time)}`} onClick={() => removeSlot.mutate(s)} disabled={removeSlot.isPending}><Icon name="trash" size={16} /></button>
            </li>
          ))}
        </ul>
      )}
      <div className="agenda__add">
        <div className="field">
          <label htmlFor="ag-day">Día</label>
          <select id="ag-day" className="input" value={n.weekday} onChange={(e) => setN({ ...n, weekday: Number(e.target.value) })}>
            {weekdays.map((d) => <option key={d.n} value={d.n}>{d.long}</option>)}
          </select>
        </div>
        <div className="field"><label htmlFor="ag-start">Desde</label><input id="ag-start" className="input" type="time" value={n.start} onChange={(e) => setN({ ...n, start: e.target.value })} /></div>
        <div className="field"><label htmlFor="ag-end">Hasta</label><input id="ag-end" className="input" type="time" value={n.end} onChange={(e) => setN({ ...n, end: e.target.value })} /></div>
        <div className="field"><label htmlFor="ag-cap">Cupos</label><input id="ag-cap" className="input" type="number" min={1} max={50} value={n.capacity} onChange={(e) => setN({ ...n, capacity: Math.min(50, Math.max(1, Number(e.target.value) || 1)) })} /></div>
        <button type="button" className="btn btn--ghost" onClick={() => addSlot.mutate()} disabled={addSlot.isPending}><Icon name="plus" size={16} /> Agregar horario</button>
      </div>

      <h3 className="ajustes__sub">Próximas clases de prueba</h3>
      {bookings.isSuccess && bookings.data.length === 0 && <p className="hint">No hay reservas próximas.</p>}
      {Boolean(bookings.data?.length) && (
        <ul className="email-log">
          {bookings.data!.map((b) => (
            <li key={b.id} className="email-log__row">
              <span className="email-log__main">
                <strong>{b.name}</strong>
                <span className="hint">{formatDate(b.date)} · {hhmm(b.start_time)} · <a href={`tel:${b.phone.replace(/\s/g, '')}`}>{b.phone}</a>{b.email ? ` · ${b.email}` : ''}</span>
                {b.notes && <span className="hint">“{b.notes}”</span>}
              </span>
              <button type="button" className="btn btn--ghost btn--sm" disabled={cancel.isPending} onClick={() => { if (confirm(`¿Cancelar la clase de prueba de ${b.name}?`)) cancel.mutate(b) }}>Cancelar</button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
