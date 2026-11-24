import { useState, type ReactNode } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useParams } from '../../lib/nav'
import { supabase } from '../../lib/supabase'
import { useSchool } from '../../lib/school'
import { formatCLP } from '../../lib/money'
import { formatDate, santiagoDate } from '../../lib/dates'
import { Icon } from '../../ui/Icon'
import { Modal } from '../../ui/Modal'
import { MoreLink } from '../../ui/MoreLink'
import { latestSubmissions, submissionsKey, submitPayment, transferOf, type PayMethod, type Submission, type Transfer } from './api'
import { CodeField } from '../descuentos/CodeField'
import { redeemOnPayment } from '../descuentos/api'

type Method = PayMethod | 'tarjeta'
const methods: { id: Method; label: string; hint: string; enabled: boolean }[] = [
  { id: 'transferencia', label: 'Transferencia bancaria', hint: 'Transfiere y avisa: la escuela confirma tu pago.', enabled: true },
  { id: 'efectivo', label: 'Efectivo', hint: 'Pagaste en la escuela: avisa y la escuela lo confirma.', enabled: true },
  { id: 'tarjeta', label: 'Tarjeta de débito o crédito', hint: 'Próximamente', enabled: false },
]

type Pay = { id: string; concept: string; amount: number; due_date: string | null; status: string; school_id: string; discount_amount: number; discount_code: string | null }

function usePay(id: string | undefined) {
  const { student: myStudent } = useSchool()
  const pay = useQuery({
    queryKey: ['pay', id],
    queryFn: async () => {
      const { data, error } = await supabase.from('payments').select('id, concept, amount, due_date, status, school_id, discount_amount, discount_code').eq('id', id!).maybeSingle()
      if (error) throw error
      return data as Pay | null
    },
    enabled: Boolean(id),
  })
  const subs = useQuery({ queryKey: submissionsKey(myStudent?.id), queryFn: () => latestSubmissions({ studentId: myStudent!.id }), enabled: Boolean(myStudent) })
  return { loading: pay.isLoading || subs.isLoading, p: pay.data ?? null, last: pay.data ? subs.data?.get(pay.data.id) ?? null : null }
}

// The payment page (/app/pagar/<id>), kept for links (e.g. from e-mails). In the app, "Pagar" opens <PayDialog> instead.
export function Checkout() {
  const { id } = useParams()
  const { schools } = useSchool()
  const { loading, p, last } = usePay(id)
  if (loading) return <p className="hint">Cargando…</p>
  if (!p) return <p className="alert">No encontramos ese pago. <Link to="/app/pagos">Ver mis pagos</Link></p>
  return (
    <div className="checkout" data-motion>
      <header className="page-head">
        <Link className="link-btn back-link" to="/app/pagos"><Icon name="back" size={16} /> Mis pagos</Link>
        <span className="eyebrow">{schools.find((s) => s.id === p.school_id)?.name ?? 'Tu escuela'} · Pago</span>
        <h1>Pagar</h1>
      </header>
      <PayPanel key={p.id} p={p} last={last} />
    </div>
  )
}

/**
 * "Pagar" as a pop-up wherever the payment is shown (Inicio, Pagos y planes): how to pay and "Ya pagué", without leaving
 * the menu (docs/ui-standards.md §6). The data loads before it opens.
 */
export function PayDialog({ paymentId, open, onClose, more = true }: { paymentId: string | null; open: boolean; onClose: () => void; more?: boolean }) {
  const { loading, p, last } = usePay(paymentId ?? undefined)
  return (
    <Modal open={open && !loading && Boolean(p)} onClose={onClose} label="Pagar">
      {p && (
        <>
          <div className="modal__head">
            <span className="eyebrow">Pagar</span>
            <button type="button" className="icon-btn" onClick={onClose} aria-label="Cerrar"><Icon name="close" /></button>
          </div>
          <div className="checkout checkout--dialog">
            <PayPanel key={p.id} p={p} last={last} onClose={onClose} />
          </div>
          {more && <MoreLink text="ver todos tus pagos" menu="Pagos y planes" to="/app/pagos" />}
        </>
      )}
    </Modal>
  )
}

// Choose transfer or cash, see the school's transfer data, then "Ya pagué" sends it to the school's admins, who approve
// it once they check it (paid ✓✓).
function PayPanel({ p, last, onClose }: { p: Pay; last: Submission | null; onClose?: () => void }) {
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
    mutationFn: () => submitPayment(p.id, method as PayMethod, reference),
    onMutate: () => setError(null),
    onSuccess: () => Promise.all([
      qc.invalidateQueries({ queryKey: submissionsKey(myStudent?.id) }),
      qc.invalidateQueries({ queryKey: ['my-payments'] }),
      qc.invalidateQueries({ queryKey: ['payment-submissions'] }),
    ]),
    onError: (e: Error) => setError(e.message),
  })

  const inReview = last?.status === 'pendiente' || send.isSuccess
  const paid = p.status === 'pagado'
  const ready = method === 'efectivo' || (method === 'transferencia' && Boolean(transfer))

  return (
    <>
      <section className="card checkout__summary" aria-label="Resumen">
        <div>
          <span className="hint">Concepto</span>
          <strong>{p.concept}</strong>
          {p.due_date && <span className="hint">Vence el {formatDate(p.due_date)}</span>}
        </div>
        <div className="checkout__total">
          {p.discount_amount > 0 && <s className="hint">{formatCLP(p.amount + p.discount_amount)}</s>}
          <p className="checkout__amount">{formatCLP(p.amount)}</p>
        </div>
      </section>
      {p.discount_amount > 0 && (
        <p className="checkout__discount" role="status"><Icon name="tag" size={16} /> <span>Código <b>{p.discount_code}</b>: −{formatCLP(p.discount_amount)}</span></p>
      )}
      {!paid && !inReview && p.discount_amount === 0 && (
        <CodeField apply={(c) => redeemOnPayment(p.id, c)} onApplied={() => Promise.all([
          qc.invalidateQueries({ queryKey: ['pay', p.id] }),
          qc.invalidateQueries({ queryKey: ['my-payments'] }),
        ])} />
      )}

      {paid ? (
        <section className="card checkout__state checkout__state--ok" role="status">
          <Icon name="check" size={22} />
          <div><strong>Este pago ya está pagado.</strong><p className="hint">¡Gracias! No tienes que hacer nada más.</p></div>
        </section>
      ) : inReview ? (
        <section className="card checkout__state" role="status">
          <Icon name="clock" size={22} />
          <div>
            <strong>Tu pago está por confirmar</strong>
            <p className="hint">Avisamos a {school?.name ?? 'tu escuela'}. Cuando lo confirme, aparecerá como pagado ✓✓{last?.created_at && !send.isSuccess ? ` (avisaste el ${formatDate(santiagoDate(last.created_at))})` : ''}.</p>
            {onClose ? <button type="button" className="btn btn--ghost" onClick={onClose}>Listo</button> : <Link className="btn btn--ghost" to="/app/pagos">Volver a mis pagos</Link>}
          </div>
        </section>
      ) : (
        <>
          {last?.status === 'rechazada' && (
            <p className="alert" role="alert">Tu escuela no pudo confirmar el pago anterior{last.reject_reason ? `: ${last.reject_reason}` : '.'} Revísalo y vuelve a avisar.</p>
          )}

          <section className="card form-section" aria-labelledby="ck-method">
            <h2 id="ck-method">¿Cómo pagaste?</h2>
            <div className="checkout__methods" role="radiogroup" aria-labelledby="ck-method">
              {methods.map((m) => (
                <label key={m.id} className={`checkout__method${method === m.id ? ' is-on' : ''}${m.enabled ? '' : ' is-off'}`}>
                  <input type="radio" name="method" value={m.id} checked={method === m.id} disabled={!m.enabled} onChange={() => { setMethod(m.id); setReference('') }} />
                  <Icon name={m.id === 'transferencia' ? 'bank' : m.id === 'efectivo' ? 'wallet' : 'lock'} size={20} />
                  <span><strong>{m.label}</strong><span className="hint">{m.hint}</span></span>
                </label>
              ))}
            </div>
          </section>

          {method === 'transferencia' && (
            transfer ? (
              <section className="card form-section" aria-labelledby="ck-transfer">
                <TransferData t={transfer} amount={p.amount} concept={p.concept}>
                  <p className="hint">Transfiere <b>{formatCLP(p.amount)}</b> a esta cuenta y después presiona <b>Ya pagué</b>.</p>
                </TransferData>
              </section>
            ) : (
              <p className="alert" role="alert">Tu escuela aún no configura sus datos de transferencia. Escríbeles o paga en efectivo.</p>
            )
          )}

          {method === 'efectivo' && (
            <section className="card form-section" aria-labelledby="ck-cash">
              <h2 id="ck-cash">Pago en efectivo</h2>
              <p className="hint">Paga <b>{formatCLP(p.amount)}</b> en la escuela y presiona <b>Ya pagué</b>: un administrador lo confirma.</p>
              <div className="field">
                <label htmlFor="ck-cash-ref">¿A quién le pagaste? (opcional)</label>
                <input id="ck-cash-ref" className="input" maxLength={120} value={reference} onChange={(e) => setReference(e.target.value)} placeholder="Ej: al profe Juan, el martes" />
              </div>
            </section>
          )}

          {error && <p className="alert" role="alert">{error}</p>}
          <div className="checkout__pay">
            <button type="button" className="btn" disabled={!ready || send.isPending} onClick={() => send.mutate()}>
              <Icon name="check" size={16} /> {send.isPending ? 'Enviando…' : `Ya pagué ${formatCLP(p.amount)}`}
            </button>
            <p className="hint">{ready ? 'Presiónalo cuando hayas pagado: tu escuela lo confirmará.' : 'Elige cómo pagaste para continuar.'}</p>
          </div>
        </>
      )}
    </>
  )
}

function TransferData({ t, amount, concept, children }: { t: Transfer; amount: number; concept: string; children?: ReactNode }) {
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
      <div className="transfer__head">
        <h2 id="ck-transfer">Datos de transferencia</h2>
        <button type="button" className="btn btn--ghost transfer__all" onClick={() => copy('Todo', all)} aria-live="polite">
          <Icon name={copied === 'Todo' ? 'check' : 'copy'} size={16} /> {copied === 'Todo' ? 'Copiados' : 'Copiar todos los datos'}
        </button>
      </div>
      {children}
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
    </>
  )
}
