import { useEffect, useState, type FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { formatDate, santiagoDate } from '../../lib/dates'
import { formatCLP } from '../../lib/money'
import { usePersisted } from '../../lib/persist'
import { Icon } from '../../ui/Icon'
import { ShowMore } from '../../ui/ShowMore'
import { useShowMore } from '../../ui/useShowMore'
import { CodesBoard } from '../descuentos/CodesBoard'
import {
  decideInvoice, deleteOpCode, fetchOpCodes, fetchOpInvoices, fetchSettings, invoiceStatusLabel, opCodesKey, opInvoicesKey,
  opSettingsKey, saveOpCode, saveSettings, type InvoiceStatus, type OpInvoice, type TransferSettings,
} from '../suscripcion/api'
import { customersKey, eventsKey, type PlatformPlan } from './api'

// Platform console: what the customers pay. Transfers to confirm first (approve → the subscription is paid until the
// charge's period end), then the platform's transfer data and its discount codes (same as a school's).

type Filter = 'por_confirmar' | 'pendiente' | 'pagada' | 'todos'
const FILTERS: { id: Filter; label: string }[] = [
  { id: 'por_confirmar', label: 'Por confirmar' }, { id: 'pendiente', label: 'Por pagar' }, { id: 'pagada', label: 'Pagadas' }, { id: 'todos', label: 'Todos' },
]

export function PlatformPayments() {
  const qc = useQueryClient()
  const q = useQuery({ queryKey: opInvoicesKey, queryFn: fetchOpInvoices })
  const [filter, setFilter] = usePersisted<Filter>('plataforma.cobros', 'por_confirmar')
  const { shown, more } = useShowMore('plataforma.cobros.mostrar', 10)
  const all = q.data ?? []
  const rows = all.filter((i) => filter === 'todos' || i.status === filter)
  const count = (f: Filter) => all.filter((i) => f === 'todos' || i.status === f).length
  const refresh = () => Promise.all([qc.invalidateQueries({ queryKey: opInvoicesKey }), qc.invalidateQueries({ queryKey: customersKey }), qc.invalidateQueries({ queryKey: eventsKey })])

  return (
    <section className="pp-section" aria-labelledby="cobros-h">
      <div className="pp-section__head">
        <div>
          <h2 id="cobros-h">Pagos de suscripciones</h2>
          <p className="hint">Los clientes pagan por transferencia y presionan «Ya transferí». Revisa tu cuenta y confírmalo: su suscripción queda pagada hasta el fin del período.</p>
        </div>
      </div>
      <div className="segmented segmented--wrap segmented--scroll" role="group" aria-label="Filtrar pagos">
        {FILTERS.map((f) => <button key={f.id} type="button" aria-pressed={filter === f.id} onClick={() => setFilter(f.id)}>{f.label} <span>{count(f.id)}</span></button>)}
      </div>
      {q.isLoading && <p className="hint">Cargando…</p>}
      {q.isError && <p className="alert">No se pudieron cargar los pagos.</p>}
      {q.isSuccess && rows.length === 0 && <p className="hint">{filter === 'por_confirmar' ? 'No hay transferencias por confirmar.' : 'No hay pagos en este filtro.'}</p>}
      <ul className="student-list">
        {rows.slice(0, shown).map((i) => <InvoiceRow key={i.id} i={i} onDone={refresh} />)}
      </ul>
      <ShowMore shown={shown} total={rows.length} onMore={more} label="Mostrar más" />
    </section>
  )
}

function InvoiceRow({ i, onDone }: { i: OpInvoice; onDone: () => Promise<unknown> }) {
  const [rejecting, setRejecting] = useState(false)
  const [reason, setReason] = useState('')
  const [error, setError] = useState<string | null>(null)
  const decide = useMutation({
    mutationFn: (approve: boolean) => decideInvoice(i.id, approve, reason),
    onMutate: () => setError(null),
    onSuccess: async () => { setRejecting(false); setReason(''); await onDone() },
    onError: (e: Error) => setError(e.message),
  })
  const tone: Record<InvoiceStatus, string> = { por_confirmar: 'tag--review', pendiente: 'tag--pay-pendiente', pagada: 'tag--pay-pagado', anulada: '' }
  return (
    <li className="card inv-row">
      <div className="inv-row__top">
        <span className="student-row__main">
          <strong>{i.customer ?? i.email ?? 'Cliente'}</strong>
          <span className="hint">
            {[`Plan ${i.plan_name}`, `${formatDate(i.period_start)} al ${formatDate(i.period_end)}`, i.discount_code ? `código ${i.discount_code} (−${formatCLP(i.discount_amount)})` : null,
              i.reported_at ? `avisó el ${formatDate(santiagoDate(i.reported_at))}` : null, i.reference ? `«${i.reference}»` : null].filter(Boolean).join(' · ')}
          </span>
          {i.reject_reason && i.status === 'pendiente' && <span className="hint">Rechazado: {i.reject_reason}</span>}
        </span>
        <span className="pay-amount">{formatCLP(i.amount)}</span>
        <span className={`tag ${tone[i.status]}`}>{invoiceStatusLabel[i.status]}</span>
      </div>
      {(i.status === 'por_confirmar' || i.status === 'pendiente') && (
        <div className="inv-row__actions">
          {rejecting ? (
            <>
              <input className="input" aria-label="Motivo del rechazo" maxLength={200} placeholder="Ej: no llegó la transferencia" value={reason} onChange={(e) => setReason(e.target.value)} />
              <button type="button" className="btn btn--danger btn--sm" disabled={decide.isPending} onClick={() => decide.mutate(false)}>Rechazar</button>
              <button type="button" className="btn btn--ghost btn--sm" onClick={() => setRejecting(false)}>Cancelar</button>
            </>
          ) : (
            <>
              <button type="button" className="btn btn--sm" disabled={decide.isPending} onClick={() => decide.mutate(true)}>
                <Icon name="check" size={16} /> {i.status === 'por_confirmar' ? 'Confirmar pago' : 'Marcar pagado'}
              </button>
              {i.status === 'por_confirmar' && <button type="button" className="btn btn--ghost btn--sm" onClick={() => setRejecting(true)}>No llegó</button>}
            </>
          )}
        </div>
      )}
      {error && <p className="alert" role="alert">{error}</p>}
    </li>
  )
}

const FIELDS: [keyof TransferSettings, string, string][] = [
  ['transfer_bank', 'Banco', 'Banco Estado'], ['transfer_account_type', 'Tipo de cuenta', 'Cuenta corriente'],
  ['transfer_account_number', 'N° de cuenta', '12345678'], ['transfer_holder', 'Titular', 'Martial CRM SpA'],
  ['transfer_rut', 'RUT', '76.123.456-7'], ['transfer_email', 'Correo para el comprobante', 'pagos@martialcrm.cl'],
]

export function PlatformTransfer() {
  const qc = useQueryClient()
  const q = useQuery({ queryKey: opSettingsKey, queryFn: fetchSettings })
  const [f, setF] = useState<TransferSettings | null>(null)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  useEffect(() => { if (q.data && !f) setF(q.data) }, [q.data, f])
  const save = useMutation({
    mutationFn: () => {
      const v = Object.fromEntries(FIELDS.map(([k]) => [k, f?.[k]?.trim() || null])) as TransferSettings
      if (!v.transfer_account_number) throw new Error('Falta el número de cuenta: sin él los clientes no pueden pagar por transferencia.')
      if (v.transfer_email && !/^\S+@\S+\.\S+$/.test(v.transfer_email)) throw new Error('Correo inválido.')
      return saveSettings(v)
    },
    onMutate: () => setMsg(null),
    onSuccess: async () => { await qc.invalidateQueries({ queryKey: opSettingsKey }); setMsg({ ok: true, text: 'Datos de transferencia guardados.' }) },
    onError: (e: Error) => setMsg({ ok: false, text: e.message }),
  })
  const submit = (e: FormEvent) => { e.preventDefault(); save.mutate() }
  return (
    <section className="pp-section" aria-labelledby="transfer-crm-h">
      <div className="pp-section__head"><div>
        <h2 id="transfer-crm-h">Datos de transferencia</h2>
        <p className="hint">La cuenta donde los clientes pagan su suscripción. La ven al pagar en Ajustes → Mi suscripción.</p>
      </div></div>
      {q.isLoading && <p className="hint">Cargando…</p>}
      {q.isError && <p className="alert">No se pudieron cargar los datos.</p>}
      {f && (
        <form className="card form-section" onSubmit={submit} noValidate>
          <div className="form-grid">
            {FIELDS.map(([k, label, ph]) => (
              <div key={k} className="field">
                <label htmlFor={`pt-${k}`}>{label}{k === 'transfer_account_number' ? ' *' : ''}</label>
                <input id={`pt-${k}`} className="input" maxLength={k === 'transfer_email' ? 120 : 80} placeholder={ph} value={f[k] ?? ''}
                  onChange={(e) => { setF({ ...f, [k]: e.target.value }); setMsg(null) }} />
              </div>
            ))}
          </div>
          {msg && <p className={`alert${msg.ok ? ' alert--ok' : ''}`} role={msg.ok ? 'status' : 'alert'}>{msg.text}</p>}
          <div className="form-actions"><button type="submit" className="btn" disabled={save.isPending}>{save.isPending ? 'Guardando…' : 'Guardar datos'}</button></div>
        </form>
      )}
    </section>
  )
}

export function PlatformCodes({ plans }: { plans: PlatformPlan[] }) {
  const qc = useQueryClient()
  const q = useQuery({ queryKey: opCodesKey, queryFn: fetchOpCodes })
  const refresh = () => qc.invalidateQueries({ queryKey: opCodesKey })
  return (
    <CodesBoard audience="clientes" codes={q.data} loading={q.isLoading} failed={q.isError}
      plans={plans.filter((p) => p.price_clp > 0)} persistKey="plataforma.codigos.inactivos" headingId="codes-crm-h" sectionId="codigos"
      onSave={async (id, input) => { await saveOpCode(id, input); await refresh() }}
      onDelete={async (id) => { await deleteOpCode(id); await refresh() }} />
  )
}
