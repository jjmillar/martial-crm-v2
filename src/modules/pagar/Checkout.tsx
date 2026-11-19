import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useParams } from '../../lib/nav'
import { supabase } from '../../lib/supabase'
import { useSchool } from '../../lib/school'
import { formatCLP } from '../../lib/money'
import { formatDate, santiagoDate } from '../../lib/dates'
import { Icon } from '../../ui/Icon'
import { latestSubmissions, submissionsKey, submitPayment, transferOf, type Submission, type Transfer } from './api'

type Method = 'transferencia' | 'tarjeta'
const methods: { id: Method; label: string; hint: string; enabled: boolean }[] = [
  { id: 'transferencia', label: 'Transferencia bancaria', hint: 'Transfiere y la escuela confirma tu pago.', enabled: true },
  { id: 'tarjeta', label: 'Tarjeta de débito o crédito', hint: 'Próximamente', enabled: false },
]

type Pay = { id: string; concept: string; amount: number; due_date: string | null; status: string; school_id: string }

// The payment gateway: every "Pagar" in the app lands here. Choose a method (only transfer for now), see the
// school's transfer data, then "Pagar" sends it to the school's CEO, who approves it once the money arrives.
export function Checkout() {
  const { id } = useParams()
  const { student: myStudent } = useSchool()
  const pay = useQuery({
    queryKey: ['pay', id],
    queryFn: async () => {
      const { data, error } = await supabase.from('payments').select('id, concept, amount, due_date, status, school_id').eq('id', id!).maybeSingle()
      if (error) throw error
      return data as Pay | null
    },
    enabled: Boolean(id),
  })
  const subs = useQuery({ queryKey: submissionsKey(myStudent?.id), queryFn: () => latestSubmissions({ studentId: myStudent!.id }), enabled: Boolean(myStudent) })

  if (pay.isLoading || subs.isLoading) return <p className="hint">Cargando…</p>
  if (!pay.data) return <p className="alert">No encontramos ese pago. <Link to="/app/pagos">Ver mis pagos</Link></p>
  return <Gateway key={pay.data.id} p={pay.data} last={subs.data?.get(pay.data.id) ?? null} />
}

function Gateway({ p, last }: { p: Pay; last: Submission | null }) {
  const { schools, student: myStudent } = useSchool()
  const qc = useQueryClient()
  const school = schools.find((s) => s.id === p.school_id)
  // Read fresh: the school may have just set (or changed) its transfer data.
  const fresh = useQuery({
    queryKey: ['school-transfer', p.school_id],
    queryFn: async () => {
      const { data, error } = await supabase.from('schools').select('*').eq('id', p.school_id).single()
      if (error) throw error
      return data
    },
  })
  const transfer = transferOf(fresh.data ?? school)
  const [method, setMethod] = useState<Method | null>(null)
  const [reference, setReference] = useState('')
  const [error, setError] = useState<string | null>(null)

  const send = useMutation({
    mutationFn: () => submitPayment(p.id, reference),
    onMutate: () => setError(null),
    onSuccess: () => Promise.all([
      qc.invalidateQueries({ queryKey: submissionsKey(myStudent?.id) }),
      qc.invalidateQueries({ queryKey: ['my-payments'] }),
    ]),
    onError: (e: Error) => setError(e.message),
  })

  const inReview = last?.status === 'pendiente' || send.isSuccess
  const paid = p.status === 'pagado'

  return (
    <div className="checkout" data-motion>
      <header className="page-head">
        <Link className="link-btn back-link" to="/app/pagos"><Icon name="back" size={16} /> Mis pagos</Link>
        <span className="eyebrow">{school?.name ?? 'Tu escuela'} · Pago seguro</span>
        <h1>Pagar</h1>
      </header>

      <section className="card checkout__summary" aria-label="Resumen">
        <div>
          <span className="hint">Concepto</span>
          <strong>{p.concept}</strong>
          {p.due_date && <span className="hint">Vence el {formatDate(p.due_date)}</span>}
        </div>
        <p className="checkout__amount">{formatCLP(p.amount)}</p>
      </section>

      {paid ? (
        <section className="card checkout__state checkout__state--ok" role="status">
          <Icon name="check" size={22} />
          <div><strong>Este pago ya está pagado.</strong><p className="hint">¡Gracias! No tienes que hacer nada más.</p></div>
        </section>
      ) : inReview ? (
        <section className="card checkout__state" role="status">
          <Icon name="clock" size={22} />
          <div>
            <strong>Tu pago está en revisión</strong>
            <p className="hint">Avisamos a tu escuela. Cuando confirme la transferencia, aparecerá como pagado{last?.created_at && !send.isSuccess ? ` (enviado el ${formatDate(santiagoDate(last.created_at))})` : ''}.</p>
            <Link className="btn btn--ghost" to="/app/pagos">Volver a mis pagos</Link>
          </div>
        </section>
      ) : (
        <>
          {last?.status === 'rechazada' && (
            <p className="alert" role="alert">Tu escuela no pudo confirmar el pago anterior{last.reject_reason ? `: ${last.reject_reason}` : '.'} Revisa la transferencia e inténtalo de nuevo.</p>
          )}

          <section className="card form-section" aria-labelledby="ck-method">
            <h2 id="ck-method">Medio de pago</h2>
            <div className="checkout__methods" role="radiogroup" aria-labelledby="ck-method">
              {methods.map((m) => (
                <label key={m.id} className={`checkout__method${method === m.id ? ' is-on' : ''}${m.enabled ? '' : ' is-off'}`}>
                  <input type="radio" name="method" value={m.id} checked={method === m.id} disabled={!m.enabled} onChange={() => setMethod(m.id)} />
                  <Icon name={m.id === 'transferencia' ? 'bank' : 'wallet'} size={20} />
                  <span><strong>{m.label}</strong><span className="hint">{m.hint}</span></span>
                </label>
              ))}
            </div>
          </section>

          {method === 'transferencia' && (
            transfer ? (
              <section className="card form-section" aria-labelledby="ck-transfer">
                <h2 id="ck-transfer">Datos de transferencia</h2>
                <p className="hint">Transfiere <b>{formatCLP(p.amount)}</b> a esta cuenta y después presiona <b>Pagar</b>.</p>
                <TransferData t={transfer} amount={p.amount} concept={p.concept} />
                <div className="field">
                  <label htmlFor="ck-ref">N° de operación o comentario (opcional)</label>
                  <input id="ck-ref" className="input" maxLength={120} value={reference} onChange={(e) => setReference(e.target.value)} placeholder="Ej: 123456789" />
                </div>
              </section>
            ) : (
              <p className="alert" role="alert">Tu escuela aún no configura sus datos de transferencia. Escríbeles para pagar.</p>
            )
          )}

          {error && <p className="alert" role="alert">{error}</p>}
          <div className="checkout__pay">
            <button type="button" className="btn" disabled={method !== 'transferencia' || !transfer || send.isPending} onClick={() => send.mutate()}>
              {send.isPending ? 'Enviando…' : `Pagar ${formatCLP(p.amount)}`}
            </button>
            <p className="hint">{method === 'transferencia' && transfer ? 'Presiona Pagar cuando hayas hecho la transferencia: tu escuela la revisará.' : 'Elige un medio de pago para continuar.'}</p>
          </div>
        </>
      )}
    </div>
  )
}

function TransferData({ t, amount, concept }: { t: Transfer; amount: number; concept: string }) {
  const rows: [string, string | null][] = [
    ['Banco', t.bank], ['Tipo de cuenta', t.type], ['N° de cuenta', t.number], ['Titular', t.holder], ['RUT', t.rut], ['Correo', t.email],
    ['Monto', formatCLP(amount)], ['Comentario', concept],
  ]
  const [copied, setCopied] = useState<string | null>(null)
  const copy = async (label: string, value: string) => {
    try { await navigator.clipboard.writeText(label === 'Monto' ? String(amount) : value); setCopied(label); setTimeout(() => setCopied(null), 1600) } catch { /* ignore */ }
  }
  const all = rows.filter(([, v]) => v).map(([k, v]) => `${k}: ${v}`).join('\n')
  return (
    <>
      <dl className="transfer">
        {rows.filter(([, v]) => v).map(([k, v]) => (
          <div key={k} className="transfer__row">
            <dt>{k}</dt>
            <dd>{v}</dd>
            <button type="button" className="icon-btn" onClick={() => copy(k, v!)} aria-label={`Copiar ${k.toLowerCase()}`} title="Copiar">
              <Icon name={copied === k ? 'check' : 'copy'} size={16} />
            </button>
          </div>
        ))}
      </dl>
      <button type="button" className="btn btn--ghost" onClick={() => copy('Todo', all)}><Icon name={copied === 'Todo' ? 'check' : 'copy'} size={16} /> {copied === 'Todo' ? 'Datos copiados' : 'Copiar todos los datos'}</button>
    </>
  )
}
