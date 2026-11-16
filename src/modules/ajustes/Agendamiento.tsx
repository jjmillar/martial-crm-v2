import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { useSchool } from '../../lib/school'
import { formatDate, todayIso } from '../../lib/dates'
import { hhmm, weekdayLong } from '../../lib/weekdays'
import { Link } from '../../lib/nav'
import type { School } from '../../lib/database.types'
import { Icon } from '../../ui/Icon'
import { Toggle } from '../../ui/Toggle'

// Every weekly block of an active class is offered as a free trial class (unlimited places).
type Block = { id: string; weekday: number; start_time: string; end_time: string; className: string; description: string | null }
type Booking = { id: string; date: string; start_time: string; name: string; phone: string; email: string | null; notes: string | null; class_name: string | null }

// Ajustes → Agendamiento: free trial class booking from the landing page (on/off, notice, upcoming bookings).
// The bookable times are the school's own classes; they are edited in Clases, not here.
export function Agendamiento({ school }: { school: School }) {
  const { reload } = useSchool()
  const qc = useQueryClient()
  const blocksKey = ['trial-blocks', school.id]
  const bookingsKey = ['trial-bookings', school.id]
  const [enabled, setEnabled] = useState(school.trial_enabled)
  const [note, setNote] = useState(school.trial_note ?? '')
  const [minHours, setMinHours] = useState(String(school.trial_min_hours))
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const today = todayIso()

  const blocks = useQuery({
    queryKey: blocksKey,
    queryFn: async () => {
      const { data, error } = await supabase.from('classes').select('name, description, schedules:class_schedules(id, weekday, start_time, end_time)')
        .eq('school_id', school.id).eq('active', true)
      if (error) throw error
      return data
        .flatMap((c) => c.schedules.map((b): Block => ({ id: b.id, weekday: b.weekday, start_time: b.start_time, end_time: b.end_time, className: c.name, description: c.description })))
        .sort((x, y) => x.weekday - y.weekday || x.start_time.localeCompare(y.start_time) || x.className.localeCompare(y.className))
    },
  })
  const bookings = useQuery({
    queryKey: bookingsKey,
    queryFn: async () => {
      const { data, error } = await supabase.from('trial_bookings').select('id, date, start_time, name, phone, email, notes, class_name')
        .eq('school_id', school.id).eq('status', 'agendada').gte('date', today).order('date').order('start_time').limit(30)
      if (error) throw error
      return data as Booking[]
    },
  })
  const refresh = () => Promise.all([qc.invalidateQueries({ queryKey: blocksKey }), qc.invalidateQueries({ queryKey: ['landing', school.slug] })])

  const saveSettings = useMutation({
    mutationFn: async () => {
      if (enabled && !(blocks.data ?? []).length) throw new Error('Crea al menos una clase activa con horario (en Clases) antes de activar el agendamiento.')
      const hours = Number(minHours)
      if (minHours.trim() === '' || !Number.isInteger(hours) || hours < 0 || hours > 168) throw new Error('La anticipación debe ser un número de horas entre 0 y 168 (7 días).')
      const { error } = await supabase.from('schools').update({ trial_enabled: enabled, trial_note: note.trim() || null, trial_min_hours: hours }).eq('id', school.id)
      if (error) throw new Error('No se pudo guardar. Solo los administradores pueden cambiarlo.')
      await reload()
      await refresh()
    },
    onMutate: () => setMsg(null),
    onSuccess: () => setMsg({ ok: true, text: enabled ? 'Agendamiento activo: aparece en tu landing page.' : 'Agendamiento desactivado.' }),
    onError: (e: Error) => setMsg({ ok: false, text: e.message }),
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
          <p className="hint">Las personas agendan una clase de prueba gratis desde tu landing page, eligiendo entre tus clases y sus horarios, sin límite de cupos. Cada reserva llega a Tareas.</p>
        </div>
        {school.landing_enabled && <a className="btn btn--ghost" href={`/e/${school.slug}#prueba`} target="_blank" rel="noopener noreferrer"><Icon name="globe" size={16} /> Ver en la página</a>}
      </div>

      <Toggle
        checked={enabled}
        onChange={(v) => { setEnabled(v); setMsg(null) }}
        label="Recibir clases de prueba gratis"
        hint={school.landing_enabled ? 'Muestra el formulario de agendamiento en la landing page.' : 'Tu landing page está oculta: actívala para que se vea el agendamiento.'}
      />
      <div className="field">
        <label htmlFor="ag-hours">Anticipación mínima para agendar (horas)</label>
        <input id="ag-hours" className="input agenda__hours" type="number" inputMode="numeric" min={0} max={168} step={1} value={minHours} onChange={(e) => { setMinHours(e.target.value); setMsg(null) }} aria-describedby="ag-hours-hint" />
        <p className="hint" id="ag-hours-hint">
          {Number(minHours) > 0
            ? `En la landing solo aparecen los horarios que empiezan en ${minHours} ${Number(minHours) === 1 ? 'hora' : 'horas'} o más. Ej: con 24, una clase del jueves a las 19:00 se puede agendar hasta el miércoles a las 19:00.`
            : 'Con 0 se puede agendar hasta que empiece la clase, incluso el mismo día.'}
        </p>
      </div>
      <div className="field">
        <label htmlFor="ag-note">Indicaciones para quien agenda (opcional)</label>
        <textarea id="ag-note" className="input" rows={2} maxLength={300} value={note} onChange={(e) => { setNote(e.target.value); setMsg(null) }} placeholder="Ej: Llega 10 minutos antes, con ropa cómoda y agua." />
      </div>
      {msg && <p className={`alert${msg.ok ? ' alert--ok' : ''}`} role={msg.ok ? 'status' : 'alert'}>{msg.text}</p>}
      <div className="form-actions"><button type="button" className="btn" disabled={saveSettings.isPending} onClick={() => saveSettings.mutate()}>{saveSettings.isPending ? 'Guardando…' : 'Guardar'}</button></div>

      <div className="ajustes__sub-row">
        <h3 className="ajustes__sub">Clases que se pueden agendar</h3>
        <Link className="link-btn" to="/app/clases">Editar clases</Link>
      </div>
      <p className="hint">Salen de tus clases activas: nombre, descripción y horario. Para cambiarlas, edita la clase.</p>
      {blocks.isSuccess && blocks.data.length === 0 && <p className="hint">Todavía no hay clases activas con horario.</p>}
      {Boolean(blocks.data?.length) && (
        <ul className="email-log">
          {blocks.data!.map((b) => (
            <li key={b.id} className="email-log__row">
              <span className="email-log__main">
                <strong>{weekdayLong(b.weekday)} · {hhmm(b.start_time)}–{hhmm(b.end_time)} · {b.className}</strong>
                <span className="hint">{b.description || 'Sin descripción (agrégala en la clase para que se vea en la landing).'}</span>
              </span>
            </li>
          ))}
        </ul>
      )}

      <h3 className="ajustes__sub">Próximas clases de prueba</h3>
      {bookings.isSuccess && bookings.data.length === 0 && <p className="hint">No hay reservas próximas.</p>}
      {Boolean(bookings.data?.length) && (
        <ul className="email-log">
          {bookings.data!.map((b) => (
            <li key={b.id} className="email-log__row">
              <span className="email-log__main">
                <strong>{b.name}{b.class_name ? ` · ${b.class_name}` : ''}</strong>
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
