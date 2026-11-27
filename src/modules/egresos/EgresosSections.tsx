import { useMemo, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { usePersisted } from '../../lib/persist'
import { formatCLP } from '../../lib/money'
import { dayMonth, todayIso } from '../../lib/dates'
import { Icon } from '../../ui/Icon'
import { Modal } from '../../ui/Modal'
import { ShowMore } from '../../ui/ShowMore'
import { useShowMore } from '../../ui/useShowMore'
import type { Expense, ExpenseRule, ExpenseStatus, TeacherPayMode } from '../../lib/database.types'
import {
  categoryLabel, deleteExpense, deleteRule, expenseStatusLabel, expensesKey, periodLabel, ruleSummary, rulesKey,
  saveExpense, saveRule, setPayMode, whenLabel, type ExpenseInput, type RuleInput,
} from './api'
import { ExpenseForm, RuleForm } from './forms'
import { useEgresos } from './data'

const normalize = (s: string) => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()

/** One pop-up for an expense: new, from a preset (a teacher's monthly payment) or an existing one. */
function useExpenseDialog() {
  const { schoolId, expenses, rules, teachers } = useEgresos()
  const qc = useQueryClient()
  const [state, setState] = useState<{ expense: Expense | null; preset?: Partial<ExpenseInput>; key: string } | null>(null)
  const [open, setOpen] = useState(false)
  const refresh = () => Promise.all([qc.invalidateQueries({ queryKey: expensesKey(schoolId) }), qc.invalidateQueries({ queryKey: rulesKey(schoolId) })])
  const ruleName = state?.expense?.rule_id ? rules.data?.rules.find((r) => r.id === state.expense!.rule_id)?.concept : null
  const show = (expense: Expense | null, preset?: Partial<ExpenseInput>) => { setState({ expense, preset, key: expense?.id ?? `new-${Date.now()}` }); setOpen(true) }
  const dialog = (
    <Modal open={open} onClose={() => setOpen(false)} labelledBy="exp-form-h">
      {state && (
        <ExpenseForm key={state.key} expense={state.expense} preset={state.preset} teachers={teachers.data ?? []} others={expenses.data ?? []} ruleName={ruleName}
          onSave={async (id, input) => { await saveExpense(schoolId!, id, input); await refresh() }}
          onDelete={async (id) => { await deleteExpense(id); await refresh() }}
          onDone={() => setOpen(false)} />
      )}
    </Modal>
  )
  return { show, dialog }
}

/** A rule pop-up (recurring payment or a teacher's rule). */
function useRuleDialog() {
  const { schoolId } = useEgresos()
  const qc = useQueryClient()
  const [state, setState] = useState<{ rule: ExpenseRule | null; teacher: { id: string; full_name: string | null } | null; key: string } | null>(null)
  const [open, setOpen] = useState(false)
  const refresh = () => Promise.all([qc.invalidateQueries({ queryKey: rulesKey(schoolId) }), qc.invalidateQueries({ queryKey: expensesKey(schoolId) })])
  const show = (rule: ExpenseRule | null, teacher: { id: string; full_name: string | null } | null) => { setState({ rule, teacher, key: rule?.id ?? `new-${Date.now()}` }); setOpen(true) }
  const dialog = (
    <Modal open={open} onClose={() => setOpen(false)} labelledBy="rule-form-h">
      {state && (
        <RuleForm key={state.key} rule={state.rule} teacher={state.teacher}
          onSave={async (id, input: RuleInput) => { await saveRule(schoolId!, id, input); await refresh() }}
          onDelete={async (id) => { await deleteRule(id); await refresh() }}
          onDone={() => setOpen(false)} />
      )}
    </Modal>
  )
  return { show, dialog }
}

type Filter = ExpenseStatus | 'todos'
const filters: { id: Filter; label: string }[] = [
  { id: 'pendiente', label: 'Por pagar' },
  { id: 'pagado', label: 'Pagados' },
  { id: 'anulado', label: 'Anulados' },
  { id: 'todos', label: 'Todos' },
]

/** Contabilidad → Egresos: every expense of the school, search and filter, "Registrar egreso". */
export function EgresosSection() {
  const { expenses: q, teachers } = useEgresos()
  const [filter, setFilter] = usePersisted<Filter>('egresos.filtro', 'pendiente')
  const [search, setSearch] = usePersisted('egresos.q', '', 'session')
  const { shown, more } = useShowMore('egresos.mostrar', 10)
  const { show, dialog } = useExpenseDialog()
  const teacherName = useMemo(() => new Map((teachers.data ?? []).map((t) => [t.id, t.full_name])), [teachers.data])
  const counts = useMemo(() => Object.fromEntries(filters.map((f) => [f.id, (q.data ?? []).filter((e) => f.id === 'todos' || e.status === f.id).length])) as Record<Filter, number>, [q.data])
  const rows = useMemo(() => {
    const needle = normalize(search.trim())
    const list = (q.data ?? []).filter((e) => (filter === 'todos' || e.status === filter)
      && (!needle || normalize(`${e.concept} ${categoryLabel[e.category]} ${e.teacher_id ? teacherName.get(e.teacher_id) ?? '' : ''}`).includes(needle)))
    // To pay: the next due first. Otherwise the latest first.
    return filter === 'pendiente' ? [...list].sort((a, b) => a.date.localeCompare(b.date)) : list
  }, [q.data, filter, search, teacherName])

  return (
    <div className="conta-list">
      {q.isLoading && <p className="hint">Cargando…</p>}
      {q.isError && <p className="alert">No se pudieron cargar los egresos.</p>}
      {q.data?.length === 0 && (
        <div className="card empty">
          <h2>Aún no hay egresos</h2>
          <p className="hint">Registra lo que paga la escuela: arriendo, cuentas, comisiones de profesores, equipamiento. Los pagos recurrentes y las comisiones automáticas se crean solos cada mes.</p>
          <button type="button" className="btn" onClick={() => show(null)}><Icon name="plus" size={16} /> Registrar egreso</button>
        </div>
      )}
      {Boolean(q.data?.length) && (
        <>
          <div className="toolbar">
            <label className="search">
              <Icon name="search" size={16} />
              <span className="sr-only">Buscar egreso</span>
              <input className="input" type="search" placeholder="Buscar por concepto, categoría o profesor" value={search} onChange={(e) => setSearch(e.target.value)} />
            </label>
            <button type="button" className="btn" onClick={() => show(null)}><Icon name="plus" size={16} /> Registrar egreso</button>
          </div>
          <div className="segmented segmented--wrap segmented--scroll" role="group" aria-label="Filtrar egresos por estado">
            {filters.map((f) => (
              <button key={f.id} type="button" aria-pressed={filter === f.id} onClick={() => setFilter(f.id)}>{f.label} <span>{counts[f.id]}</span></button>
            ))}
          </div>
        </>
      )}
      {Boolean(q.data?.length) && rows.length === 0 && <p className="hint">No hay egresos en este filtro.</p>}
      <ul className="student-list">
        {rows.slice(0, shown).map((e) => {
          const late = e.status === 'pendiente' && e.date < todayIso()
          return (
            <li key={e.id}>
              <button type="button" className={`card student-row cust-row egr-row${e.status === 'anulado' ? ' is-off' : ''}`} onClick={() => show(e)}>
                <span className="student-row__main">
                  <strong>{e.concept}</strong>
                  <span className="hint">
                    {[categoryLabel[e.category], e.teacher_id ? teacherName.get(e.teacher_id) : null, periodLabel(e)].filter(Boolean).join(' · ')}
                  </span>
                </span>
                <span className="cust-row__side">
                  <span className={`hint egr-row__when${late ? ' is-late' : ''}`}>{whenLabel(e)}</span>
                  <span className="pay-amount">{formatCLP(e.amount)}</span>
                  <span className={`tag tag--pay-${e.status === 'anulado' ? 'reembolsado' : e.status}`}>{expenseStatusLabel[e.status]}</span>
                </span>
              </button>
            </li>
          )
        })}
      </ul>
      <ShowMore shown={shown} total={rows.length} onMore={more} label="Mostrar más" />
      {dialog}
    </div>
  )
}

/**
 * Contabilidad → Comisiones de profesores: each active teacher is paid "Manual" (once a month you register the payment)
 * or "Automática" (their rules create the expense: a fixed amount a month and/or an amount per class taught).
 */
export function ComisionesSection() {
  const { schoolId, expenses, rules, teachers } = useEgresos()
  const qc = useQueryClient()
  const exp = useExpenseDialog()
  const rule = useRuleDialog()
  const [err, setErr] = useState<string | null>(null)
  const mode = useMutation({
    mutationFn: ({ id, m }: { id: string; m: TeacherPayMode }) => setPayMode(schoolId!, id, m),
    onSuccess: () => Promise.all([qc.invalidateQueries({ queryKey: rulesKey(schoolId) }), qc.invalidateQueries({ queryKey: expensesKey(schoolId) })]),
    onError: (e: Error) => setErr(e.message),
  })
  const active = (teachers.data ?? []).filter((t) => t.active)

  if (teachers.isLoading || rules.isLoading) return <p className="hint">Cargando…</p>
  if (teachers.isError || rules.isError) return <p className="alert">No se pudieron cargar las comisiones.</p>
  if (active.length === 0) return <p className="hint">Agrega profesores en Miembros → Profesores para gestionar sus comisiones.</p>

  return (
    <div className="conta-list">
      <p className="hint">Manual: una vez al mes registras su pago. Automática: sus reglas crean el egreso solas cada mes.</p>
      {err && <p className="alert" role="alert">{err}</p>}
      <ul className="egr-teachers">
        {active.map((t) => {
          const m: TeacherPayMode = (mode.isPending && mode.variables?.id === t.id ? mode.variables.m : rules.data?.modes.get(t.id)) ?? 'manual'
          const own = (rules.data?.rules ?? []).filter((r) => r.teacher_id === t.id)
          const last = (expenses.data ?? []).find((e) => e.teacher_id === t.id && e.status === 'pagado')
          return (
            <li key={t.id} className="card egr-teacher">
              <div className="egr-teacher__head">
                <span className="egr-teacher__name">
                  <strong>{t.full_name}</strong>
                  <span className="hint">{last ? `Último pago: ${formatCLP(last.amount)} · ${dayMonth(last.paid_at ? todayIso(new Date(last.paid_at)) : last.date)}${periodLabel(last) ? ` · ${periodLabel(last)}` : ''}` : 'Sin pagos registrados'}</span>
                </span>
                <div className="segmented" role="group" aria-label={`Comisión de ${t.full_name}`}>
                  <button type="button" aria-pressed={m === 'manual'} onClick={() => m !== 'manual' && mode.mutate({ id: t.id, m: 'manual' })}>Manual</button>
                  <button type="button" aria-pressed={m === 'automatica'} onClick={() => m !== 'automatica' && mode.mutate({ id: t.id, m: 'automatica' })}>Automática</button>
                </div>
                {m === 'manual' && (
                  <button type="button" className="btn btn--ghost egr-teacher__pay" onClick={() => exp.show(null, { category: 'comision_profesor', teacher_id: t.id, status: 'pagado' })}>
                    <Icon name="plus" size={16} /> Registrar pago
                  </button>
                )}
              </div>
              {m === 'manual' ? (
                own.some((r) => r.active) && <p className="hint egr-teacher__note">Sus reglas están pausadas mientras esté en manual.</p>
              ) : (
                <div className="egr-teacher__body">
                  {own.length === 0 && <p className="hint">Agrega una regla: un monto por clase dictada o un monto fijo al mes.</p>}
                  {own.length > 0 && (
                    <ul className="egr-rules">
                      {own.map((r) => <RuleRow key={r.id} rule={r} now={rules.data?.month.get(r.id)} onClick={() => rule.show(r, t)} />)}
                    </ul>
                  )}
                  <button type="button" className="btn btn--ghost" onClick={() => rule.show(null, t)}><Icon name="plus" size={16} /> Agregar regla</button>
                </div>
              )}
            </li>
          )
        })}
      </ul>
      {exp.dialog}
      {rule.dialog}
    </div>
  )
}

function RuleRow({ rule, now, onClick }: { rule: ExpenseRule; now?: { classes: number; amount: number }; onClick: () => void }) {
  const extra = rule.kind === 'por_clase' && now ? `Este mes: ${now.classes} ${now.classes === 1 ? 'clase' : 'clases'} · ${formatCLP(now.amount)} a la fecha` : null
  return (
    <li>
      <button type="button" className={`egr-rule${rule.active ? '' : ' is-off'}`} onClick={onClick}>
        <span className="student-row__main">
          <strong>{rule.concept}</strong>
          <span className="hint">{[ruleSummary(rule), extra].filter(Boolean).join(' · ')}</span>
        </span>
        {!rule.active && <span className="tag">Pausada</span>}
        <Icon name="edit" size={16} />
      </button>
    </li>
  )
}

/** Contabilidad → Pagos recurrentes: rent, services, salaries… a fixed amount every month on a given day. */
export function RecurrentesSection() {
  const { rules } = useEgresos()
  const rule = useRuleDialog()
  const list = (rules.data?.rules ?? []).filter((r) => !r.teacher_id)
  if (rules.isLoading) return <p className="hint">Cargando…</p>
  if (rules.isError) return <p className="alert">No se pudieron cargar los pagos recurrentes.</p>
  return (
    <div className="conta-list">
      {list.length === 0 ? (
        <div className="card empty">
          <h2>Sin pagos recurrentes</h2>
          <p className="hint">Arriendo, internet, sueldos… Define el monto y el día, y cada mes se crea el egreso por pagar.</p>
          <button type="button" className="btn" onClick={() => rule.show(null, null)}><Icon name="plus" size={16} /> Nuevo pago recurrente</button>
        </div>
      ) : (
        <>
          <div className="toolbar toolbar--end">
            <button type="button" className="btn" onClick={() => rule.show(null, null)}><Icon name="plus" size={16} /> Nuevo pago recurrente</button>
          </div>
          <ul className="egr-rules egr-rules--cards">
            {list.map((r) => (
              <li key={r.id}>
                <button type="button" className={`card student-row cust-row${r.active ? '' : ' is-off'}`} onClick={() => rule.show(r, null)}>
                  <span className="student-row__main">
                    <strong>{r.concept}</strong>
                    <span className="hint">{categoryLabel[r.category]} · el día {r.day_of_month} de cada mes{r.ends_on ? ` · hasta el ${dayMonth(r.ends_on)}` : ''}</span>
                  </span>
                  <span className="cust-row__side">
                    {!r.active && <span className="tag">Pausada</span>}
                    <span className="pay-amount">{formatCLP(r.amount)}<small>/mes</small></span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
      {rule.dialog}
    </div>
  )
}
