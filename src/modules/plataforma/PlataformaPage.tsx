import { useMemo, useState, type FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { usePersisted } from '../../lib/persist'
import { formatCLP } from '../../lib/money'
import { formatDate, santiagoDate, todayIso, addDays } from '../../lib/dates'
import { Icon } from '../../ui/Icon'
import { Modal } from '../../ui/Modal'
import { Toggle } from '../../ui/Toggle'
import { ShowMore } from '../../ui/ShowMore'
import { useShowMore } from '../../ui/useShowMore'
import {
  STATUSES, customersKey, dueInfo, eventsKey, fetchCustomers, fetchEvents, fetchPlans, monthly, plansKey, savePlan,
  statusLabel, updateSubscription, type Customer, type PlanInput, type PlatformEvent, type PlatformPlan, type SubStatus,
} from './api'
import { PlatformCodes, PlatformPayments, PlatformTransfer } from './Billing'

// The platform console, one page (no tabs): numbers on top, customers with their subscription, the CRM's plans,
// and the change history at the end. It never shows school data: only who the customer is, their schools and how
// many students they have.
type Filter = 'todos' | SubStatus
const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

export function PlataformaPage() {
  const customers = useQuery({ queryKey: customersKey, queryFn: fetchCustomers })
  const plans = useQuery({ queryKey: plansKey, queryFn: fetchPlans })
  const [filter, setFilter] = usePersisted<Filter>('plataforma.filtro', 'todos')
  const [q, setQ] = usePersisted('plataforma.q', '', 'session')
  const [editing, setEditing] = useState<Customer | null>(null)
  const [editOpen, setEditOpen] = useState(false)

  const all = useMemo(() => customers.data ?? [], [customers.data])
  const today = todayIso()
  const stats = useMemo(() => ({
    mrr: all.reduce((s, c) => s + monthly(c), 0),
    active: all.filter((c) => c.status === 'activa').length,
    trial: all.filter((c) => c.status === 'prueba').length,
    trialSoon: all.filter((c) => c.status === 'prueba' && c.trial_ends && c.trial_ends <= addDays(today, 7)).length,
    blocked: all.filter((c) => c.status === 'suspendida' || c.status === 'cancelada').length,
    schools: all.reduce((s, c) => s + c.schools.length, 0),
    students: all.reduce((s, c) => s + c.students, 0),
  }), [all, today])
  const counts = useMemo(() => {
    const r: Record<Filter, number> = { todos: all.length, prueba: 0, activa: 0, suspendida: 0, cancelada: 0 }
    for (const c of all) if (c.status) r[c.status]++
    return r
  }, [all])
  const rows = useMemo(() => {
    const needle = norm(q.trim())
    return all.filter((c) => (filter === 'todos' || c.status === filter)
      && (!needle || norm([c.full_name, c.email, ...c.schools.map((s) => s.name)].join(' ')).includes(needle)))
  }, [all, filter, q])

  function open(c: Customer) { setEditing(c); setEditOpen(true) }

  return (
    <div className="plataforma">
      <header className="page-head">
        <h1>Suscripciones</h1>
        <p className="hint">Los clientes de Martial CRM y el estado de su suscripción. Aquí no se ven datos de alumnos.</p>
      </header>

      {customers.isError && <p className="alert" role="alert">No se pudieron cargar los clientes. Vuelve a ingresar con tu código de verificación.</p>}

      <div className="kpis">
        <div className="card kpi">
          <span className="conta-kpi__label">Ingreso mensual</span>
          <strong>{formatCLP(stats.mrr)}</strong>
          <span className="hint">{stats.active} {stats.active === 1 ? 'suscripción activa' : 'suscripciones activas'}</span>
        </div>
        <button type="button" className="card kpi kpi--link" onClick={() => setFilter('prueba')}>
          <span className="conta-kpi__label">En prueba</span>
          <strong>{stats.trial}</strong>
          <span className="hint">{stats.trialSoon ? `${stats.trialSoon} terminan en 7 días o menos` : 'Ninguna por terminar'}</span>
        </button>
        <div className="card kpi">
          <span className="conta-kpi__label">Clientes</span>
          <strong>{all.length}</strong>
          <span className="hint">{stats.schools} {stats.schools === 1 ? 'escuela' : 'escuelas'} · {stats.students} alumnos activos</span>
        </div>
        <button type="button" className="card kpi kpi--link" onClick={() => setFilter('suspendida')}>
          <span className="conta-kpi__label">Sin acceso</span>
          <strong>{stats.blocked}</strong>
          <span className="hint">Suspendidas o canceladas</span>
        </button>
      </div>

      <section className="pp-section" aria-labelledby="clientes-h">
        <div className="pp-section__head"><div><h2 id="clientes-h">Clientes</h2></div></div>
        <div className="toolbar">
          <label className="search">
            <Icon name="search" size={16} />
            <span className="sr-only">Buscar cliente</span>
            <input className="input" type="search" placeholder="Buscar por nombre, correo o escuela" value={q} onChange={(e) => setQ(e.target.value)} />
          </label>
        </div>
        <div className="segmented segmented--wrap segmented--scroll" role="group" aria-label="Filtrar por estado">
          {(['todos', ...STATUSES] as Filter[]).map((f) => (
            <button key={f} type="button" aria-pressed={filter === f} onClick={() => setFilter(f)}>{f === 'todos' ? 'Todos' : statusLabel[f]} <span>{counts[f]}</span></button>
          ))}
        </div>
        {customers.isLoading && <p className="hint">Cargando…</p>}
        {customers.isSuccess && rows.length === 0 && <p className="hint">{all.length ? 'No hay clientes en este filtro.' : 'Aún no hay clientes. Aparecerán aquí cuando alguien cree su cuenta en el sitio.'}</p>}
        <ul className="student-list" data-motion>
          {rows.map((c) => {
            const due = dueInfo(c, today)
            return (
              <li key={c.owner_id}>
                <button type="button" className="card student-row cust-row" onClick={() => open(c)}>
                  <span className="student-row__main">
                    <strong>{c.full_name || c.email}</strong>
                    <span className="hint">
                      {[c.schools.length ? c.schools.map((s) => s.name).join(', ') : 'Sin escuelas', `${c.students} ${c.students === 1 ? 'alumno' : 'alumnos'}`, c.plan_name ?? 'Sin plan'].join(' · ')}
                    </span>
                    {due && <span className={`hint cust-row__due${due.late ? ' is-late' : ''}`}>{due.text}</span>}
                  </span>
                  <span className="cust-row__side">
                    {c.price_clp ? <span className="pay-amount">{formatCLP(c.price_clp)}<small>/{c.period === 'anual' ? 'año' : 'mes'}</small></span> : null}
                    {c.status && <span className={`tag tag--sub-${c.status}`}>{statusLabel[c.status]}</span>}
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      </section>

      <PlatformPayments />
      <PlansSection plans={plans.data ?? []} loading={plans.isLoading} />
      <PlatformCodes plans={plans.data ?? []} />
      <PlatformTransfer />
      <History />

      <Modal open={editOpen} onClose={() => setEditOpen(false)} labelledBy="sub-h">
        {editing && <SubscriptionForm key={editing.owner_id} c={editing} plans={plans.data ?? []} onDone={() => setEditOpen(false)} />}
      </Modal>
    </div>
  )
}

function SubscriptionForm({ c, plans, onDone }: { c: Customer; plans: PlatformPlan[]; onDone: () => void }) {
  const qc = useQueryClient()
  const [plan, setPlan] = useState(c.plan_id ?? '')
  const [status, setStatus] = useState<SubStatus>(c.status ?? 'prueba')
  const [trialEnds, setTrialEnds] = useState(c.trial_ends ?? '')
  const [periodEnd, setPeriodEnd] = useState(c.period_end ?? '')
  const [notes, setNotes] = useState(c.notes ?? '')
  const save = useMutation({
    mutationFn: () => updateSubscription(c.owner_id, { plan_id: plan || null, status, trial_ends: trialEnds || null, period_end: periodEnd || null, notes }),
    onSuccess: async () => {
      await Promise.all([qc.invalidateQueries({ queryKey: customersKey }), qc.invalidateQueries({ queryKey: eventsKey })])
      onDone()
    },
  })
  const closing = (status === 'suspendida' || status === 'cancelada') && c.status !== status
  const choosable = plans.filter((p) => p.active || p.id === c.plan_id)

  function submit(e: FormEvent) { e.preventDefault(); save.mutate() }

  return (
    <form className="sub-form" onSubmit={submit} noValidate>
      <div className="modal__head">
        <div>
          <span className="hint">Suscripción</span>
          <h2 id="sub-h">{c.full_name || c.email}</h2>
        </div>
        <button type="button" className="icon-btn" onClick={onDone} aria-label="Cerrar"><Icon name="close" /></button>
      </div>
      <dl className="sub-facts">
        <div><dt>Correo</dt><dd>{c.email}</dd></div>
        <div><dt>Cliente desde</dt><dd>{formatDate(santiagoDate(c.created_at))}</dd></div>
        <div><dt>Último ingreso</dt><dd>{c.last_sign_in_at ? formatDate(santiagoDate(c.last_sign_in_at)) : 'Nunca'}</dd></div>
        <div><dt>Escuelas</dt><dd>{c.schools.length ? c.schools.map((s) => `${s.name} (${s.students})`).join(', ') : 'Ninguna todavía'}</dd></div>
      </dl>

      <div className="field">
        <span className="field__label" id="sub-status">Estado</span>
        <div className="segmented segmented--wrap" role="group" aria-labelledby="sub-status">
          {STATUSES.map((s) => <button key={s} type="button" aria-pressed={status === s} onClick={() => setStatus(s)}>{statusLabel[s]}</button>)}
        </div>
      </div>
      <div className="form-grid">
        <div className="field">
          <label htmlFor="sub-plan">Plan</label>
          <select id="sub-plan" className="input" value={plan} onChange={(e) => setPlan(e.target.value)}>
            <option value="">Sin plan</option>
            {choosable.map((p) => <option key={p.id} value={p.id}>{p.name} · {formatCLP(p.price_clp)}/{p.period === 'anual' ? 'año' : 'mes'}</option>)}
          </select>
        </div>
        {status === 'prueba' ? (
          <div className="field">
            <label htmlFor="sub-trial">Prueba hasta</label>
            <input id="sub-trial" className="input" type="date" value={trialEnds} onChange={(e) => setTrialEnds(e.target.value)} />
          </div>
        ) : (
          <div className="field">
            <label htmlFor="sub-end">Pagado hasta</label>
            <input id="sub-end" className="input" type="date" value={periodEnd} onChange={(e) => setPeriodEnd(e.target.value)} />
          </div>
        )}
        <div className="field field--wide">
          <label htmlFor="sub-notes">Notas internas</label>
          <textarea id="sub-notes" className="input" rows={2} maxLength={1000} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Ej: pagó por transferencia el 05-12, factura 123." />
        </div>
      </div>
      {closing && (
        <p className="alert" role="alert">
          Al guardar, {c.schools.length === 1 ? `${c.schools[0].name} queda cerrada` : `sus ${c.schools.length} escuelas quedan cerradas`} para el dueño, su equipo y sus alumnos. Los datos no se borran: al reactivar vuelve todo.
        </p>
      )}
      {save.isError && <p className="alert" role="alert">{(save.error as Error).message}</p>}
      <div className="form-actions">
        <button type="submit" className="btn" disabled={save.isPending}>{save.isPending ? 'Guardando…' : 'Guardar'}</button>
        <button type="button" className="btn btn--ghost" onClick={onDone}>Cancelar</button>
      </div>
    </form>
  )
}

function PlansSection({ plans, loading }: { plans: PlatformPlan[]; loading: boolean }) {
  const [showInactive, setShowInactive] = usePersisted('plataforma.planesInactivos', false)
  const [editing, setEditing] = useState<PlatformPlan | null>(null)
  const [open, setOpen] = useState(false)
  const list = plans.filter((p) => showInactive || p.active)
  const edit = (p: PlatformPlan | null) => { setEditing(p); setOpen(true) }

  return (
    <section className="pp-section" aria-labelledby="planes-crm-h">
      <div className="pp-section__head">
        <div>
          <h2 id="planes-crm-h">Planes de Martial CRM</h2>
          <p className="hint">Lo que pagan las escuelas por usar el CRM.</p>
        </div>
        <button type="button" className="btn btn--ghost" onClick={() => edit(null)}><Icon name="plus" size={16} /> Nuevo plan</button>
      </div>
      {plans.some((p) => !p.active) && <Toggle inline checked={showInactive} onChange={setShowInactive} label="Mostrar planes inactivos" />}
      {loading && <p className="hint">Cargando…</p>}
      <div className="plan-grid pay-grid" data-motion>
        {list.map((p) => (
          <button key={p.id} type="button" className={`card plan-card pay-card crm-plan${p.active ? '' : ' is-off'}`} onClick={() => edit(p)}>
            <span className="pay-card__row">
              <strong>{p.name}</strong>
              <span className="pay-amount">{formatCLP(p.price_clp)}<small>/{p.period === 'anual' ? 'año' : 'mes'}</small></span>
            </span>
            <span className="hint">
              {[p.max_schools ? `${p.max_schools} ${p.max_schools === 1 ? 'escuela' : 'escuelas'}` : 'Escuelas ilimitadas',
                p.max_students ? `hasta ${p.max_students} alumnos` : 'alumnos ilimitados', p.active ? null : 'Inactivo'].filter(Boolean).join(' · ')}
            </span>
          </button>
        ))}
      </div>
      <Modal open={open} onClose={() => setOpen(false)} labelledBy="plan-crm-h">
        <PlanForm key={editing?.id ?? 'new'} plan={editing} onDone={() => setOpen(false)} />
      </Modal>
    </section>
  )
}

function PlanForm({ plan, onDone }: { plan: PlatformPlan | null; onDone: () => void }) {
  const qc = useQueryClient()
  const [f, setF] = useState<PlanInput>(plan ?? { name: '', price_clp: 0, period: 'mensual', max_schools: 1, max_students: null, active: true })
  const set = <K extends keyof PlanInput>(k: K, v: PlanInput[K]) => setF((x) => ({ ...x, [k]: v }))
  const [err, setErr] = useState<string | null>(null)
  const save = useMutation({
    mutationFn: () => savePlan(plan?.id ?? null, { ...f, name: f.name.trim() }),
    onSuccess: async () => { await Promise.all([qc.invalidateQueries({ queryKey: plansKey }), qc.invalidateQueries({ queryKey: customersKey })]); onDone() },
    onError: (e: Error) => setErr(e.message),
  })
  const num = (v: string) => (v === '' ? null : Math.max(0, Math.floor(Number(v))))

  function submit(e: FormEvent) {
    e.preventDefault()
    if (f.name.trim().length < 2) return setErr('Ponle un nombre al plan.')
    setErr(null)
    save.mutate()
  }

  return (
    <form onSubmit={submit} noValidate>
      <div className="modal__head">
        <h2 id="plan-crm-h">{plan ? 'Editar plan' : 'Nuevo plan'}</h2>
        <button type="button" className="icon-btn" onClick={onDone} aria-label="Cerrar"><Icon name="close" /></button>
      </div>
      <div className="form-grid">
        <div className="field field--wide"><label htmlFor="pc-name">Nombre</label><input id="pc-name" className="input" maxLength={60} value={f.name} onChange={(e) => set('name', e.target.value)} /></div>
        <div className="field"><label htmlFor="pc-price">Precio (CLP)</label><input id="pc-price" className="input" inputMode="numeric" value={f.price_clp} onChange={(e) => set('price_clp', num(e.target.value) ?? 0)} /></div>
        <div className="field">
          <span className="field__label" id="pc-period">Cobro</span>
          <div className="segmented" role="group" aria-labelledby="pc-period">
            <button type="button" aria-pressed={f.period === 'mensual'} onClick={() => set('period', 'mensual')}>Mensual</button>
            <button type="button" aria-pressed={f.period === 'anual'} onClick={() => set('period', 'anual')}>Anual</button>
          </div>
        </div>
        <div className="field"><label htmlFor="pc-sch">Máx. escuelas</label><input id="pc-sch" className="input" inputMode="numeric" placeholder="Ilimitadas" value={f.max_schools ?? ''} onChange={(e) => set('max_schools', num(e.target.value) || null)} /></div>
        <div className="field"><label htmlFor="pc-stu">Máx. alumnos</label><input id="pc-stu" className="input" inputMode="numeric" placeholder="Ilimitados" value={f.max_students ?? ''} onChange={(e) => set('max_students', num(e.target.value) || null)} /></div>
      </div>
      <Toggle checked={f.active} onChange={(v) => set('active', v)} label="Plan activo" hint="Los planes inactivos no se ofrecen a clientes nuevos; quienes ya lo tienen lo mantienen." />
      {err && <p className="alert" role="alert">{err}</p>}
      <div className="form-actions">
        <button type="submit" className="btn" disabled={save.isPending}>{save.isPending ? 'Guardando…' : 'Guardar'}</button>
        <button type="button" className="btn btn--ghost" onClick={onDone}>Cancelar</button>
      </div>
    </form>
  )
}

const fieldName: Record<string, string> = { plan: 'Plan', status: 'Estado', trial_ends: 'Prueba hasta', period_end: 'Pagado hasta' }
function describe(d: PlatformEvent['details']): string {
  const parts: string[] = []
  const pay = d.payment as { amount: number; plan: string; until: string; code: string | null } | undefined
  if (pay) parts.push(`Pagó ${formatCLP(pay.amount)} (${pay.plan}) hasta el ${formatDate(pay.until)}${pay.code ? ` con código ${pay.code}` : ''}`)
  const code = d.code as { code: string; discount: number } | undefined
  if (code && typeof code === 'object') parts.push(`Usó el código ${code.code} (−${formatCLP(code.discount)})`)
  for (const k of ['status', 'plan', 'period_end', 'trial_ends']) {
    const v = d[k] as [string | null, string | null] | undefined
    if (!v) continue
    const show = (x: string | null) => (x == null ? '—' : k === 'status' ? statusLabel[x as SubStatus] ?? x : k.endsWith('_end') || k.endsWith('_ends') ? formatDate(x) : x)
    parts.push(`${fieldName[k]}: ${show(v[0])} → ${show(v[1])}`)
  }
  if (d.notes) parts.push('Notas actualizadas')
  return parts.join(' · ')
}

function History() {
  const events = useQuery({ queryKey: eventsKey, queryFn: fetchEvents })
  const { shown, more } = useShowMore('plataforma.historial')
  const list = events.data ?? []
  return (
    <section className="pp-section" aria-labelledby="hist-crm-h">
      <div className="pp-section__head">
        <div>
          <h2 id="hist-crm-h">Historial</h2>
          <p className="hint">{list.length ? 'Últimos cambios en las suscripciones.' : 'Cada cambio que hagas en una suscripción quedará registrado aquí.'}</p>
        </div>
      </div>
      {list.length > 0 && (
        <div className="card pay-history">
          <ul className="pay-history__list" data-motion>
            {list.slice(0, shown).map((e) => (
              <li key={e.id}>
                <div className="pay-history__row">
                  <span className="pay-history__main"><strong>{e.customer ?? 'Cliente'}</strong><span className="hint">{describe(e.details)}</span></span>
                  <span className="pay-history__side hint">{formatDate(santiagoDate(e.at))}</span>
                </div>
              </li>
            ))}
          </ul>
          <ShowMore shown={Math.min(shown, list.length)} total={list.length} onMore={more} noun="cambios" />
        </div>
      )}
    </section>
  )
}
