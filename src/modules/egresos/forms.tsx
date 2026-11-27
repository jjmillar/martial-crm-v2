import { useState, type FormEvent } from 'react'
import { useMutation } from '@tanstack/react-query'
import { formatCLP, parseCLP } from '../../lib/money'
import { monthTitle, todayIso } from '../../lib/dates'
import { Icon } from '../../ui/Icon'
import { Toggle } from '../../ui/Toggle'
import { methodLabel } from '../pagos/api'
import type { Expense, ExpenseCategory, ExpenseRule, ExpenseStatus, PaymentMethod } from '../../lib/database.types'
import { categoryLabel, dayStamp, isFullMonth, monthRange, overlapping, periodLabel, rangeLabel, ruleSummary, type ExpenseInput, type RuleInput } from './api'

type TeacherOpt = { id: string; full_name: string | null; active: boolean }
const methods = Object.keys(methodLabel) as PaymentMethod[]
const categories = Object.keys(categoryLabel) as ExpenseCategory[]

type PeriodKind = 'ninguno' | 'mes' | 'rango'
/** The months to choose from: two ahead and two years back, newest first ('aaaa-mm-01'). */
function monthOptions(today: string, keep: string | null): string[] {
  const out: string[] = []
  const [y, m] = today.slice(0, 7).split('-').map(Number)
  for (let i = 2; i >= -24; i--) out.push(new Date(Date.UTC(y, m - 1 + i, 1)).toISOString().slice(0, 10))
  if (keep && !out.includes(keep)) out.push(keep)
  return out
}
/** Paying a teacher early in the month is usually for the month before. */
const defaultMonth = (today: string) => {
  const [y, m, d] = today.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1 - (d <= 15 ? 1 : 0), 1)).toISOString().slice(0, 10)
}

function Danger({ label, onConfirm, busy }: { label: string; onConfirm: () => void; busy: boolean }) {
  const [ask, setAsk] = useState(false)
  return (
    <span className="form-actions__danger">
      {ask ? (
        <>
          <span className="hint">¿{label}?</span>
          <button type="button" className="btn btn--danger" disabled={busy} onClick={onConfirm}>{label}</button>
          <button type="button" className="btn btn--ghost" onClick={() => setAsk(false)}>No</button>
        </>
      ) : (
        <button type="button" className="btn btn--ghost" onClick={() => setAsk(true)}><Icon name="trash" size={16} /> {label}</button>
      )}
    </span>
  )
}

/** Register or edit an expense. A generated one (from a rule) shows where it came from and is cancelled, not deleted. */
export function ExpenseForm({ expense, preset, teachers, others = [], ruleName, onSave, onDelete, onDone }: {
  expense: Expense | null
  preset?: Partial<ExpenseInput>
  /** The school's other expenses (to warn about paying a teacher twice for the same period). */
  others?: Expense[]
  teachers: TeacherOpt[]
  ruleName?: string | null
  onSave: (id: string | null, input: ExpenseInput) => Promise<unknown>
  onDelete: (id: string) => Promise<unknown>
  onDone: () => void
}) {
  const today = todayIso()
  const [f, setF] = useState<ExpenseInput>(() => expense
    ? { concept: expense.concept, amount: expense.amount, category: expense.category, date: expense.date, status: expense.status, method: expense.method, paid_at: expense.paid_at, teacher_id: expense.teacher_id, notes: expense.notes, period_from: expense.period_from, period_to: expense.period_to }
    : { amount: 0, category: 'otro', date: today, status: 'pagado', method: 'transferencia', paid_at: null, teacher_id: null, notes: null, period_from: null, period_to: null, ...preset,
        concept: preset?.concept ?? (preset?.teacher_id ? `Comisión ${teachers.find((t) => t.id === preset.teacher_id)?.full_name ?? ''} · ${monthTitle(defaultMonth(today))}` : '') })
  const set = <K extends keyof ExpenseInput>(k: K, v: ExpenseInput[K]) => setF((x) => ({ ...x, [k]: v }))
  const [amount, setAmount] = useState(expense || preset?.amount ? formatCLP(expense?.amount ?? preset?.amount) : '')
  const [paidDay, setPaidDay] = useState(expense?.paid_at ? todayIso(new Date(expense.paid_at)) : today)
  const [err, setErr] = useState<string | null>(null)
  const generated = Boolean(expense?.period)
  // Period it pays for: none, a month or a date range. A teacher's payment starts on a month.
  const [kind, setKind] = useState<PeriodKind>(() => f.period_from && f.period_to ? (isFullMonth(f.period_from, f.period_to) ? 'mes' : 'rango') : !expense && preset?.teacher_id ? 'mes' : 'ninguno')
  const [month, setMonth] = useState(() => f.period_from && f.period_to && isFullMonth(f.period_from, f.period_to) ? f.period_from : defaultMonth(today))
  const [from, setFrom] = useState(f.period_from ?? '')
  const [to, setTo] = useState(f.period_to ?? '')
  // A teacher's payment: the concept follows the period until it is edited by hand.
  const teacherName = (id: string | null) => teachers.find((t) => t.id === id)?.full_name ?? ''
  const [autoConcept, setAutoConcept] = useState(!expense && Boolean(preset?.teacher_id))
  const range: [string, string] | null = kind === 'mes' ? monthRange(month) : kind === 'rango' && from && to && to >= from ? [from, to] : null
  const conceptFor = (r: [string, string] | null, teacherId: string | null) => [`Comisión ${teacherName(teacherId)}`.trim(), r ? rangeLabel(r[0], r[1]) : null].filter(Boolean).join(' · ')
  const followPeriod = (r: [string, string] | null) => { if (autoConcept) set('concept', conceptFor(r, f.teacher_id)) }
  const twice = generated ? [] : overlapping(others, f.teacher_id, range?.[0] ?? null, range?.[1] ?? null, expense?.id)
  const wasPaid = expense?.status === 'pagado'

  const save = useMutation({ mutationFn: (input: ExpenseInput) => onSave(expense?.id ?? null, input), onSuccess: onDone, onError: (e: Error) => setErr(e.message) })
  const remove = useMutation({ mutationFn: () => onDelete(expense!.id), onSuccess: onDone, onError: (e: Error) => setErr(e.message) })
  const cancel = useMutation({ mutationFn: () => onSave(expense!.id, { ...f, status: 'anulado', paid_at: null }), onSuccess: onDone, onError: (e: Error) => setErr(e.message) })

  function submit(e: FormEvent) {
    e.preventDefault()
    const n = parseCLP(amount)
    if (!f.concept.trim()) return setErr('Escribe el concepto del egreso.')
    if (!n || !(n > 0)) return setErr('Escribe el monto.')
    if (!f.date) return setErr('Elige la fecha.')
    if (kind === 'rango' && (!from || !to)) return setErr('Elige las dos fechas del periodo.')
    if (kind === 'rango' && to < from) return setErr('El periodo no puede terminar antes de empezar.')
    setErr(null)
    // A new expense registered as paid is paid on its own date; an existing one on the "Pagado el" day.
    const paid_at = f.status !== 'pagado' ? null : !expense ? dayStamp(f.date) : dayStamp(paidDay)
    const period = generated ? { period_from: f.period_from, period_to: f.period_to } : { period_from: range?.[0] ?? null, period_to: range?.[1] ?? null }
    save.mutate({ ...f, ...period, concept: f.concept.trim(), amount: n, notes: f.notes?.trim() || null, paid_at })
  }

  const teacherOpts = teachers.filter((t) => t.active || t.id === f.teacher_id)
  const statuses: ExpenseStatus[] = expense?.status === 'anulado' ? ['pendiente', 'pagado', 'anulado'] : ['pendiente', 'pagado']

  return (
    <form className="sub-form" onSubmit={submit} noValidate>
      <div className="modal__head">
        <h2 id="exp-form-h">{expense ? 'Egreso' : 'Registrar egreso'}</h2>
        <button type="button" className="icon-btn" onClick={onDone} aria-label="Cerrar"><Icon name="close" /></button>
      </div>
      {generated && (
        <p className="hint egr-origin">
          <Icon name="clock" size={14} /><span>Creado por {ruleName ? <>la regla <b>{ruleName}</b></> : 'una regla'} · {periodLabel(expense!)}.
          {expense!.auto && expense!.status === 'pendiente' ? ' Mientras esté pendiente se actualiza solo; si cambias el monto, queda como lo dejes.' : ''}</span>
        </p>
      )}
      <div className="form-grid">
        <div className="field field--wide">
          <label htmlFor="ex-concept">Concepto</label>
          <input id="ex-concept" className="input" maxLength={120} value={f.concept} placeholder="Ej: Cuenta de luz" onChange={(e) => { setAutoConcept(false); set('concept', e.target.value) }} />
        </div>
        <div className="field">
          <label htmlFor="ex-amount">Monto</label>
          <input id="ex-amount" className="input" inputMode="numeric" value={amount} placeholder="$0" onChange={(e) => setAmount(e.target.value)}
            onBlur={() => { const n = parseCLP(amount); if (n) setAmount(formatCLP(n)) }} />
        </div>
        <div className="field">
          <label htmlFor="ex-cat">Categoría</label>
          <select id="ex-cat" className="input" value={f.category} onChange={(e) => set('category', e.target.value as ExpenseCategory)}>
            {categories.map((c) => <option key={c} value={c}>{categoryLabel[c]}</option>)}
          </select>
        </div>
        <div className="field">
          <label htmlFor="ex-teacher">Profesor (opcional)</label>
          <select id="ex-teacher" className="input" value={f.teacher_id ?? ''} onChange={(e) => { const id = e.target.value || null; set('teacher_id', id); if (autoConcept) set('concept', conceptFor(range, id)) }}>
            <option value="">Ninguno</option>
            {teacherOpts.map((t) => <option key={t.id} value={t.id}>{t.full_name}</option>)}
          </select>
        </div>
        {!generated && (
          <div className="field field--wide egr-period">
            <span className="field__label" id="ex-period">Periodo que paga</span>
            <div className="segmented" role="group" aria-labelledby="ex-period">
              <button type="button" aria-pressed={kind === 'ninguno'} onClick={() => { setKind('ninguno'); followPeriod(null) }}>Sin periodo</button>
              <button type="button" aria-pressed={kind === 'mes'} onClick={() => { setKind('mes'); followPeriod(monthRange(month)) }}>Un mes</button>
              <button type="button" aria-pressed={kind === 'rango'} onClick={() => { const r: [string, string] = from && to ? [from, to] : monthRange(month); setKind('rango'); setFrom(r[0]); setTo(r[1]); followPeriod(r) }}>Rango de fechas</button>
            </div>
            {kind === 'mes' && (
              <select id="ex-month" className="input" aria-label="Mes que paga" value={month} onChange={(e) => { setMonth(e.target.value); followPeriod(monthRange(e.target.value)) }}>
                {monthOptions(today, month).map((m) => <option key={m} value={m}>{monthTitle(m)}</option>)}
              </select>
            )}
            {kind === 'rango' && (
              <div className="code-pair">
                <div className="field"><label htmlFor="ex-from">Desde</label><input id="ex-from" type="date" className="input" value={from} max={to || undefined}
                  onChange={(e) => { setFrom(e.target.value); if (e.target.value && to && to >= e.target.value) followPeriod([e.target.value, to]) }} /></div>
                <div className="field"><label htmlFor="ex-to">Hasta</label><input id="ex-to" type="date" className="input" value={to} min={from || undefined}
                  onChange={(e) => { setTo(e.target.value); if (from && e.target.value && e.target.value >= from) followPeriod([from, e.target.value]) }} /></div>
              </div>
            )}
            {twice.length > 0 && (
              <p className="hint egr-twice" role="status">
                Ya hay {twice.length === 1 ? 'un pago' : `${twice.length} pagos`} a {teacherName(f.teacher_id)} en ese periodo: {twice.map((o) => `${periodLabel(o)} (${formatCLP(o.amount)}${o.status === 'pendiente' ? ', por pagar' : ''})`).join(', ')}.
              </p>
            )}
          </div>
        )}
        <div className="field">
          <label htmlFor="ex-date">{f.status === 'pagado' && !expense ? 'Fecha de pago' : generated || f.status === 'pendiente' ? 'Vence el' : 'Fecha'}</label>
          <input id="ex-date" type="date" className="input" value={f.date} onChange={(e) => set('date', e.target.value)} />
        </div>
        <div className="field field--wide">
          <span className="field__label" id="ex-status">Estado</span>
          <div className="segmented" role="group" aria-labelledby="ex-status">
            {statuses.map((s) => (
              <button key={s} type="button" aria-pressed={f.status === s} onClick={() => set('status', s)}>{s === 'pendiente' ? 'Por pagar' : s === 'pagado' ? 'Pagado' : 'Anulado'}</button>
            ))}
          </div>
        </div>
        {f.status === 'pagado' && (
          <>
            <div className="field">
              <label htmlFor="ex-method">Medio de pago</label>
              <select id="ex-method" className="input" value={f.method ?? 'transferencia'} onChange={(e) => set('method', e.target.value as PaymentMethod)}>
                {methods.map((m) => <option key={m} value={m}>{methodLabel[m]}</option>)}
              </select>
            </div>
            {expense && (
              <div className="field">
                <label htmlFor="ex-paid">Pagado el</label>
                <input id="ex-paid" type="date" className="input" value={paidDay} max={today} onChange={(e) => setPaidDay(e.target.value || today)} />
              </div>
            )}
          </>
        )}
        <div className="field field--wide">
          <label htmlFor="ex-notes">Notas (opcional)</label>
          <input id="ex-notes" className="input" maxLength={400} value={f.notes ?? ''} placeholder="Ej: N° de boleta o transferencia" onChange={(e) => set('notes', e.target.value)} />
        </div>
      </div>
      {wasPaid && f.status !== 'pagado' && <p className="hint">Dejará de contar como pagado.</p>}
      {err && <p className="alert" role="alert">{err}</p>}
      <div className="form-actions">
        <button type="submit" className="btn" disabled={save.isPending}>{save.isPending ? 'Guardando…' : 'Guardar'}</button>
        <button type="button" className="btn btn--ghost" onClick={onDone}>Cancelar</button>
        {expense && !generated && <Danger label="Eliminar" busy={remove.isPending} onConfirm={() => remove.mutate()} />}
        {expense && generated && expense.status !== 'anulado' && <Danger label="Anular" busy={cancel.isPending} onConfirm={() => cancel.mutate()} />}
      </div>
    </form>
  )
}

const days = Array.from({ length: 28 }, (_, i) => i + 1)

/** A recurring payment (no teacher) or a teacher's commission rule (fixed monthly or per class taught). */
export function RuleForm({ rule, teacher, onSave, onDelete, onDone }: {
  rule: ExpenseRule | null
  teacher: { id: string; full_name: string | null } | null
  onSave: (id: string | null, input: RuleInput) => Promise<unknown>
  onDelete: (id: string) => Promise<unknown>
  onDone: () => void
}) {
  const [f, setF] = useState<RuleInput>(() => rule
    ? { kind: rule.kind, concept: rule.concept, category: rule.category, teacher_id: rule.teacher_id, amount: rule.amount, day_of_month: rule.day_of_month, starts_on: rule.starts_on, ends_on: rule.ends_on, active: rule.active }
    : { kind: teacher ? 'por_clase' : 'fijo', concept: teacher ? `Comisión ${teacher.full_name ?? ''}`.trim() : '', category: teacher ? 'comision_profesor' : 'arriendo', teacher_id: teacher?.id ?? null, amount: 0, day_of_month: 5, starts_on: todayIso().slice(0, 8) + '01', ends_on: null, active: true })
  const set = <K extends keyof RuleInput>(k: K, v: RuleInput[K]) => setF((x) => ({ ...x, [k]: v }))
  const [amount, setAmount] = useState(rule ? formatCLP(rule.amount) : '')
  const [err, setErr] = useState<string | null>(null)
  const save = useMutation({ mutationFn: (input: RuleInput) => onSave(rule?.id ?? null, input), onSuccess: onDone, onError: (e: Error) => setErr(e.message) })
  const remove = useMutation({ mutationFn: () => onDelete(rule!.id), onSuccess: onDone, onError: (e: Error) => setErr(e.message) })
  const perClass = f.kind === 'por_clase'

  function submit(e: FormEvent) {
    e.preventDefault()
    const n = parseCLP(amount)
    if (!f.concept.trim()) return setErr('Escribe el concepto.')
    if (!n || !(n > 0)) return setErr(perClass ? 'Escribe el monto por clase.' : 'Escribe el monto mensual.')
    if (!f.starts_on) return setErr('Elige desde cuándo corre.')
    if (f.ends_on && f.ends_on < f.starts_on) return setErr('La fecha de término no puede ser anterior a la de inicio.')
    setErr(null)
    save.mutate({ ...f, concept: f.concept.trim(), amount: n })
  }

  return (
    <form className="sub-form" onSubmit={submit} noValidate>
      <div className="modal__head">
        <h2 id="rule-form-h">{rule ? 'Editar regla' : teacher ? `Nueva regla · ${teacher.full_name ?? 'profesor'}` : 'Nuevo pago recurrente'}</h2>
        <button type="button" className="icon-btn" onClick={onDone} aria-label="Cerrar"><Icon name="close" /></button>
      </div>
      <div className="form-grid">
        {teacher && (
          <div className="field field--wide">
            <span className="field__label" id="rl-kind">Cómo se calcula</span>
            <div className="segmented" role="group" aria-labelledby="rl-kind">
              <button type="button" aria-pressed={perClass} onClick={() => set('kind', 'por_clase')}>Por clase dictada</button>
              <button type="button" aria-pressed={!perClass} onClick={() => set('kind', 'fijo')}>Monto fijo al mes</button>
            </div>
          </div>
        )}
        <div className="field field--wide">
          <label htmlFor="rl-concept">Concepto</label>
          <input id="rl-concept" className="input" maxLength={120} value={f.concept} placeholder="Ej: Arriendo del local" onChange={(e) => set('concept', e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="rl-amount">{perClass ? 'Monto por clase' : 'Monto mensual'}</label>
          <input id="rl-amount" className="input" inputMode="numeric" value={amount} placeholder="$0" onChange={(e) => setAmount(e.target.value)}
            onBlur={() => { const n = parseCLP(amount); if (n) setAmount(formatCLP(n)) }} />
        </div>
        <div className="field">
          <label htmlFor="rl-day">{perClass ? 'Se paga el día (mes siguiente)' : 'Se paga el día'}</label>
          <select id="rl-day" className="input" value={f.day_of_month} onChange={(e) => set('day_of_month', Number(e.target.value))}>
            {days.map((d) => <option key={d} value={d}>{d}</option>)}
          </select>
        </div>
        {!teacher && (
          <div className="field">
            <label htmlFor="rl-cat">Categoría</label>
            <select id="rl-cat" className="input" value={f.category} onChange={(e) => set('category', e.target.value as ExpenseCategory)}>
              {categories.filter((c) => c !== 'comision_profesor').map((c) => <option key={c} value={c}>{categoryLabel[c]}</option>)}
            </select>
          </div>
        )}
        <div className="field">
          <label htmlFor="rl-from">Desde</label>
          <input id="rl-from" type="date" className="input" value={f.starts_on} onChange={(e) => set('starts_on', e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="rl-until">Hasta (opcional)</label>
          <input id="rl-until" type="date" className="input" value={f.ends_on ?? ''} onChange={(e) => set('ends_on', e.target.value || null)} />
        </div>
      </div>
      <p className="hint">
        {perClass
          ? 'Al cerrar cada mes se cuentan las clases que dictó (las marcadas «no se realizó» no cuentan) y se crea un egreso por pagar con el total.'
          : 'Cada mes se crea un egreso por pagar para ese día. Lo marcas como pagado cuando lo pagues.'}
        {' '}{parseCLP(amount) ? ruleSummary({ kind: f.kind, amount: parseCLP(amount)!, day_of_month: f.day_of_month }) + '.' : ''}
      </p>
      <Toggle checked={f.active} onChange={(v) => set('active', v)} label="Regla activa" hint="Una regla pausada no crea egresos nuevos. Los ya creados se mantienen." />
      {err && <p className="alert" role="alert">{err}</p>}
      <div className="form-actions">
        <button type="submit" className="btn" disabled={save.isPending}>{save.isPending ? 'Guardando…' : 'Guardar'}</button>
        <button type="button" className="btn btn--ghost" onClick={onDone}>Cancelar</button>
        {rule && <Danger label="Eliminar" busy={remove.isPending} onConfirm={() => remove.mutate()} />}
      </div>
      {rule && <p className="hint">Al eliminarla se borran sus egresos aún por pagar; los pagados quedan en el historial.</p>}
    </form>
  )
}
