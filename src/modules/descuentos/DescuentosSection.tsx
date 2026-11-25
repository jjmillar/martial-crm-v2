import { useMemo, useState, type FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { usePersisted } from '../../lib/persist'
import { useSchool } from '../../lib/school'
import { formatCLP, parseCLP } from '../../lib/money'
import { Icon } from '../../ui/Icon'
import { Modal } from '../../ui/Modal'
import { Toggle } from '../../ui/Toggle'
import { listPlans, plansKey } from '../planes/api'
import { codeState, codesKey, deleteCode, listCodes, normalizeCode, saveCode, stateLabel, usesLabel, validityLabel, valueLabel, type CodeInput, type CodeRow } from './api'

/** "Códigos de descuento", a section of Contabilidad for the school's admins. */
export function DescuentosSection() {
  const { activeSchool, role } = useSchool()
  const schoolId = activeSchool?.id
  const isAdmin = role === 'admin' || role === 'ceo'
  const codes = useQuery({ queryKey: codesKey(schoolId), queryFn: () => listCodes(schoolId!), enabled: Boolean(schoolId) && isAdmin })
  const plans = useQuery({ queryKey: plansKey(schoolId), queryFn: () => listPlans(schoolId!), enabled: Boolean(schoolId) && isAdmin })
  const [showOff, setShowOff] = usePersisted('descuentos.inactivos', false)
  const [editing, setEditing] = useState<CodeRow | null>(null)
  const [open, setOpen] = useState(false)
  const planName = useMemo(() => new Map((plans.data ?? []).map((p) => [p.id, p.name])), [plans.data])
  if (!isAdmin || !activeSchool) return null

  const all = codes.data ?? []
  const offCount = all.filter((c) => codeState(c) !== 'activo' && codeState(c) !== 'programado').length
  const list = all.filter((c) => showOff || codeState(c) === 'activo' || codeState(c) === 'programado')
  const edit = (c: CodeRow | null) => { setEditing(c); setOpen(true) }

  return (
    <section className="pp-section" id="descuentos" aria-labelledby="desc-h">
      <div className="pp-section__head">
        <div>
          <h2 id="desc-h">Códigos de descuento</h2>
          <p className="hint">Tus alumnos los escriben al pagar. Puedes limitar los usos, las fechas y el plan.</p>
        </div>
        {all.length > 0 && <button type="button" className="btn btn--ghost" onClick={() => edit(null)}><Icon name="plus" size={16} /> Nuevo código</button>}
      </div>
      {offCount > 0 && <Toggle inline checked={showOff} onChange={setShowOff} label={`Mostrar inactivos, vencidos y agotados (${offCount})`} />}
      {codes.isLoading && <p className="hint">Cargando…</p>}
      {codes.isError && <p className="alert">No se pudieron cargar los códigos.</p>}
      {codes.isSuccess && all.length === 0 && (
        <div className="card empty">
          <h2>Aún no hay códigos</h2>
          <p className="hint">Crea un código para una promoción de un mes, un descuento familiar permanente o un cupo limitado.</p>
          <button type="button" className="btn" onClick={() => edit(null)}><Icon name="plus" size={16} /> Crear código</button>
        </div>
      )}
      {list.length > 0 && (
        <div className="plan-grid pay-grid" data-motion>
          {list.map((c) => {
            const st = codeState(c)
            return (
              <button key={c.id} type="button" className={`card plan-card pay-card code-card${st === 'activo' || st === 'programado' ? '' : ' is-off'}`} onClick={() => edit(c)}>
                <span className="plan-card__tags">
                  <span className="eyebrow">{c.scope === 'plan' ? 'Permanente en el plan' : 'Un solo pago'}</span>
                  {st !== 'activo' && <span className={`tag tag--code-${st}`}>{stateLabel[st]}</span>}
                </span>
                <span className="pay-card__row">
                  <strong className="code-card__code">{c.code}</strong>
                  <span className="pay-amount">−{valueLabel(c)}</span>
                </span>
                {c.description && <span className="hint">{c.description}</span>}
                <span className="hint">
                  {[usesLabel(c), c.plan_id ? `Solo ${planName.get(c.plan_id) ?? 'un plan'}` : null, validityLabel(c), c.saved ? `${formatCLP(c.saved)} descontados` : null].filter(Boolean).join(' · ')}
                </span>
              </button>
            )
          })}
        </div>
      )}
      <Modal open={open} onClose={() => setOpen(false)} labelledBy="code-form-h">
        <CodeForm key={editing?.id ?? 'new'} code={editing} plans={(plans.data ?? []).filter((p) => p.active || p.id === editing?.plan_id)} onDone={() => setOpen(false)} />
      </Modal>
    </section>
  )
}

type PlanOpt = { id: string; name: string }
const empty: CodeInput = { code: '', description: null, percent: 10, amount: null, scope: 'pago', plan_id: null, max_uses: null, valid_from: null, valid_until: null, active: true }

function CodeForm({ code, plans, onDone }: { code: CodeRow | null; plans: PlanOpt[]; onDone: () => void }) {
  const { activeSchool } = useSchool()
  const schoolId = activeSchool!.id
  const qc = useQueryClient()
  const [f, setF] = useState<CodeInput>(code ? { ...code } : empty)
  const set = <K extends keyof CodeInput>(k: K, v: CodeInput[K]) => setF((x) => ({ ...x, [k]: v }))
  const [kind, setKind] = useState<'percent' | 'amount'>(code?.amount ? 'amount' : 'percent')
  const [value, setValue] = useState(code ? (code.amount ? formatCLP(code.amount) : String(code.percent)) : '10')
  const [limit, setLimit] = useState<'unico' | 'stock' | 'libre'>(code?.max_uses === 1 ? 'unico' : code?.max_uses ? 'stock' : code ? 'libre' : 'unico')
  const [stock, setStock] = useState(code?.max_uses && code.max_uses > 1 ? String(code.max_uses) : '10')
  const [err, setErr] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const refresh = () => qc.invalidateQueries({ queryKey: codesKey(schoolId) })

  const save = useMutation({
    mutationFn: (input: CodeInput) => saveCode(schoolId, code?.id ?? null, input),
    onSuccess: async () => { await refresh(); onDone() },
    onError: (e: Error) => setErr(e.message),
  })
  const remove = useMutation({
    mutationFn: () => deleteCode(code!.id),
    onSuccess: async () => { await refresh(); onDone() },
    onError: (e: Error) => setErr(e.message),
  })

  function submit(e: FormEvent) {
    e.preventDefault()
    const c = normalizeCode(f.code)
    if (c.length < 3) return setErr('El código debe tener al menos 3 letras o números.')
    let percent: number | null = null, amount: number | null = null
    if (kind === 'percent') {
      percent = Math.floor(Number(value))
      if (!(percent >= 1 && percent <= 100)) return setErr('El porcentaje debe estar entre 1 y 100.')
    } else {
      amount = parseCLP(value)
      if (!amount || amount < 1) return setErr('Escribe el monto del descuento.')
    }
    let max: number | null = null
    if (limit === 'unico') max = 1
    if (limit === 'stock') {
      max = Math.floor(Number(stock))
      if (!(max >= 2)) return setErr('Escribe cuántas veces se puede usar (2 o más).')
    }
    if (f.valid_from && f.valid_until && f.valid_until < f.valid_from) return setErr('La fecha de término no puede ser anterior a la de inicio.')
    setErr(null)
    save.mutate({ ...f, code: c, description: f.description?.trim() || null, percent, amount, max_uses: max })
  }

  return (
    <form className="sub-form" onSubmit={submit} noValidate>
      <div className="modal__head">
        <h2 id="code-form-h">{code ? 'Editar código' : 'Nuevo código'}</h2>
        <button type="button" className="icon-btn" onClick={onDone} aria-label="Cerrar"><Icon name="close" /></button>
      </div>
      <div className="form-grid">
        <div className="field">
          <label htmlFor="dc-code">Código</label>
          <input id="dc-code" className="input code-input" maxLength={24} autoCapitalize="characters" value={f.code} placeholder="VERANO20" onChange={(e) => set('code', normalizeCode(e.target.value))} />
        </div>
        <div className="field">
          <span className="field__label" id="dc-kind">Descuento</span>
          <div className="code-value">
            <div className="segmented" role="group" aria-labelledby="dc-kind">
              <button type="button" aria-pressed={kind === 'percent'} onClick={() => { setKind('percent'); setValue('10') }}>%</button>
              <button type="button" aria-pressed={kind === 'amount'} onClick={() => { setKind('amount'); setValue('') }}>$</button>
            </div>
            <input id="dc-value" className="input" inputMode="numeric" aria-label={kind === 'percent' ? 'Porcentaje' : 'Monto en pesos'} value={value}
              placeholder={kind === 'percent' ? '10' : '$5.000'} onChange={(e) => setValue(e.target.value)}
              onBlur={() => { if (kind === 'amount') { const n = parseCLP(value); if (n) setValue(formatCLP(n)) } }} />
          </div>
        </div>
        <div className="field field--wide">
          <label htmlFor="dc-desc">Descripción (opcional)</label>
          <input id="dc-desc" className="input" maxLength={200} value={f.description ?? ''} placeholder="Ej: Promoción de verano" onChange={(e) => set('description', e.target.value)} />
        </div>
        <div className="field field--wide">
          <span className="field__label" id="dc-scope">Se aplica a</span>
          <div className="segmented" role="group" aria-labelledby="dc-scope">
            <button type="button" aria-pressed={f.scope === 'pago'} onClick={() => set('scope', 'pago')}>Un solo pago</button>
            <button type="button" aria-pressed={f.scope === 'plan'} onClick={() => set('scope', 'plan')}>Permanente en el plan</button>
          </div>
          <span className="hint">{f.scope === 'pago'
            ? 'Descuenta solo el pago donde se usa. Con las fechas de vigencia sirve para promociones de ciertos meses.'
            : 'Descuenta el pago donde se usa y todas las mensualidades siguientes de esa inscripción.'}</span>
        </div>
        <div className="code-pair code-pair--stack field--wide">
        <div className="field">
          <label htmlFor="dc-plan">Plan</label>
          <select id="dc-plan" className="input" value={f.plan_id ?? ''} onChange={(e) => set('plan_id', e.target.value || null)}>
            <option value="">Cualquier plan</option>
            {plans.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
        <div className="field">
          <span className="field__label" id="dc-uses">Usos</span>
          <div className="segmented" role="group" aria-labelledby="dc-uses">
            <button type="button" aria-pressed={limit === 'unico'} onClick={() => setLimit('unico')}>Único</button>
            <button type="button" aria-pressed={limit === 'stock'} onClick={() => setLimit('stock')}>Cupos</button>
            <button type="button" aria-pressed={limit === 'libre'} onClick={() => setLimit('libre')}>Sin límite</button>
          </div>
          {limit === 'stock' && <input className="input" inputMode="numeric" aria-label="Cantidad de usos" value={stock} onChange={(e) => setStock(e.target.value.replace(/\D/g, ''))} />}
        </div>
        </div>
        <div className="code-pair field--wide">
        <div className="field"><label htmlFor="dc-from">Válido desde</label><input id="dc-from" type="date" className="input" value={f.valid_from ?? ''} onChange={(e) => set('valid_from', e.target.value || null)} /></div>
        <div className="field"><label htmlFor="dc-until">Válido hasta</label><input id="dc-until" type="date" className="input" value={f.valid_until ?? ''} onChange={(e) => set('valid_until', e.target.value || null)} /></div>
        </div>
      </div>
      <p className="hint">Cada alumno puede usar un código una sola vez.{code?.uses ? ` Ya se usó ${code.uses} ${code.uses === 1 ? 'vez' : 'veces'}: los cambios valen para los usos nuevos.` : ''}</p>
      <Toggle checked={f.active} onChange={(v) => set('active', v)} label="Código activo" hint="Un código inactivo ya no se puede usar. Los descuentos ya aplicados se mantienen." />
      {err && <p className="alert" role="alert">{err}</p>}
      <div className="form-actions">
        <button type="submit" className="btn" disabled={save.isPending}>{save.isPending ? 'Guardando…' : 'Guardar'}</button>
        <button type="button" className="btn btn--ghost" onClick={onDone}>Cancelar</button>
        {code && !code.uses && (
          <span className="form-actions__danger">
            {confirmDelete ? (
              <>
                <span className="hint">¿Eliminar?</span>
                <button type="button" className="btn btn--danger" onClick={() => remove.mutate()}>Eliminar</button>
                <button type="button" className="btn btn--ghost" onClick={() => setConfirmDelete(false)}>No</button>
              </>
            ) : (
              <button type="button" className="btn btn--ghost" onClick={() => setConfirmDelete(true)}><Icon name="trash" size={16} /> Eliminar</button>
            )}
          </span>
        )}
      </div>
    </form>
  )
}
