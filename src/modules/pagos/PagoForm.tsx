import { useMemo, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from '../../lib/nav'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useSchool } from '../../lib/school'
import { formatDate, monthTitle, santiagoDate, todayIso } from '../../lib/dates'
import { formatCLP, parseCLP } from '../../lib/money'
import type { PaymentKind, PaymentMethod, PaymentStatus } from '../../lib/database.types'
import { Icon } from '../../ui/Icon'
import { listStudents, studentsKey } from '../alumnos/api'
import { listStudentEnrollments, phaseOf } from '../matriculas/api'
import {
  attachReceipt, createPayment, deletePayment, emailReceipt, getPayment, kindLabel, methodLabel, paymentsKey, receiptUrl, statusLabel, updatePayment, uploadReceipt,
  type PaymentRow,
} from './api'

const normalize = (s: string) => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()
const methods: PaymentMethod[] = ['transferencia', 'efectivo', 'tarjeta', 'otro']
const kinds: PaymentKind[] = ['plan', 'matricula', 'otro']

/** /pagos/nuevo (optionally ?alumno=<id>) and /pagos/:id */
export function PagoEditor() {
  const { id } = useParams()
  const isNew = !id || id === 'nuevo'
  const q = useQuery({ queryKey: ['payment', id], queryFn: () => getPayment(id!), enabled: !isNew })
  if (isNew) return <NuevoPago />
  if (q.isLoading) return <p className="hint">Cargando…</p>
  if (!q.data) return <p className="alert">No encontramos ese pago. <Link to="..">Volver</Link></p>
  return <PagoDetalle key={q.data.id} p={q.data} />
}

function NuevoPago() {
  const { activeSchool, role } = useSchool()
  const schoolId = activeSchool?.id
  const isAdmin = role === 'admin' || role === 'ceo'
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [params] = useSearchParams()
  const students = useQuery({ queryKey: studentsKey(schoolId), queryFn: () => listStudents(schoolId!), enabled: Boolean(schoolId) })

  const [studentId, setStudentId] = useState(params.get('alumno') ?? '')
  const [search, setSearch] = useState('')
  const enrollments = useQuery({ queryKey: ['student-enrollments', studentId], queryFn: () => listStudentEnrollments(studentId), enabled: Boolean(studentId) })
  const current = useMemo(() => (enrollments.data ?? []).filter((e) => phaseOf(e) !== 'cancelada'), [enrollments.data])
  const [enrollmentId, setEnrollmentId] = useState('')
  const [kind, setKind] = useState<PaymentKind>('plan')
  const [concept, setConcept] = useState('')
  const [amount, setAmount] = useState('')
  const [method, setMethod] = useState<PaymentMethod>('transferencia')
  const [status, setStatus] = useState<PaymentStatus>(isAdmin ? 'pagado' : 'pendiente')
  const [due, setDue] = useState('')
  const [notes, setNotes] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [error, setError] = useState<string | null>(null)

  const options = useMemo(() => {
    const needle = normalize(search.trim())
    return (students.data ?? []).filter((s) => s.active && (!needle || normalize(s.full_name ?? '').includes(needle)))
  }, [students.data, search])

  function pickEnrollment(id: string) {
    setEnrollmentId(id)
    const e = current.find((x) => x.id === id)
    if (!e) return
    setKind('plan')
    setConcept(`${e.plan?.name ?? 'Mensualidad'} · ${monthTitle(todayIso())}`)
    setAmount(formatCLP(e.price))
  }

  // "Matrícula" uses the school's configured fee (Ajustes); the other kinds keep what was typed.
  function pickKind(k: PaymentKind) {
    setKind(k)
    if (k === 'matricula') {
      setEnrollmentId('')
      setConcept(`Matrícula ${todayIso().slice(0, 4)}`)
      if (activeSchool?.enrollment_fee) setAmount(formatCLP(activeSchool.enrollment_fee))
    }
  }

  const save = useMutation({
    mutationFn: async () => {
      const n = parseCLP(amount)
      if (!studentId) throw new Error('Elige un alumno.')
      if (!concept.trim()) throw new Error('Escribe el concepto del pago.')
      if (n === null || Number.isNaN(n) || n <= 0) throw new Error('Monto inválido: usa pesos enteros mayores a 0.')
      // Upload first (under the future payment id), then create the payment already linked to the file.
      const id = crypto.randomUUID()
      const receipt_path = file ? await uploadReceipt(schoolId!, id, file) : null
      return createPayment(schoolId!, {
        id, receipt_path, student_id: studentId, enrollment_id: kind === 'plan' ? enrollmentId || null : null, kind, concept: concept.trim(), amount: n, method,
        status: isAdmin ? status : 'pendiente', due_date: due || null, notes: notes.trim() || null,
      })
    },
    onSuccess: (p) => {
      qc.invalidateQueries({ queryKey: paymentsKey(schoolId) })
      qc.invalidateQueries({ queryKey: ['student-payments', p.student_id] })
      navigate('..', { replace: true, state: { flash: 'Pago registrado.' } })
    },
    onError: (e: Error) => setError(e.message),
  })

  function onSubmit(ev: FormEvent) {
    ev.preventDefault()
    setError(null)
    save.mutate()
  }

  if (!activeSchool) return <p className="page-note">Selecciona una escuela.</p>

  return (
    <form className="alumno-form" onSubmit={onSubmit} noValidate>
      <header className="page-head">
        <Link className="link-btn back-link" to=".."><Icon name="back" size={16} /> Pagos</Link>
        <h1>Registrar pago</h1>
        {!isAdmin && <p className="hint">Quedará pendiente hasta que un administrador lo confirme.</p>}
      </header>

      <section className="card form-section">
        <h2>Alumno</h2>
        <div className="form-grid">
          <div className="field">
            <label htmlFor="pg-search">Buscar</label>
            <input id="pg-search" className="input" type="search" placeholder="Nombre" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="pg-student">Alumno *</label>
            <select id="pg-student" className="input" value={studentId} onChange={(e) => { setStudentId(e.target.value); setEnrollmentId(''); setError(null) }}>
              <option value="">Elige un alumno ({options.length})</option>
              {options.map((s) => <option key={s.id} value={s.id}>{s.full_name}</option>)}
              {studentId && !options.some((s) => s.id === studentId) && <option value={studentId}>{students.data?.find((s) => s.id === studentId)?.full_name ?? 'Alumno'}</option>}
            </select>
          </div>
          {studentId && kind !== 'matricula' && (
            <div className="field">
              <label htmlFor="pg-enr">Inscripción</label>
              <select id="pg-enr" className="input" value={enrollmentId} onChange={(e) => pickEnrollment(e.target.value)}>
                <option value="">Sin inscripción asociada</option>
                {current.map((e) => <option key={e.id} value={e.id}>{e.plan?.name} · {formatCLP(e.price)}</option>)}
              </select>
            </div>
          )}
        </div>
      </section>

      <section className="card form-section">
        <h2>Pago</h2>
        <div className="field">
          <span className="field__label" id="pg-kind">Tipo</span>
          <div className="segmented" role="group" aria-labelledby="pg-kind">
            {kinds.map((k) => <button key={k} type="button" aria-pressed={kind === k} onClick={() => pickKind(k)}>{kindLabel[k]}</button>)}
          </div>
          {kind === 'matricula' && !activeSchool.enrollment_fee && <span className="hint">La escuela no tiene matrícula configurada (Ajustes): escribe el monto.</span>}
        </div>
        <div className="form-grid">
          <div className="field">
            <label htmlFor="pg-concept">Concepto *</label>
            <input id="pg-concept" className="input" maxLength={120} value={concept} onChange={(e) => setConcept(e.target.value)} placeholder="Ej: Mensualidad noviembre" />
          </div>
          <div className="field">
            <label htmlFor="pg-amount">Monto (CLP) *</label>
            <input id="pg-amount" className="input" inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value)} onBlur={() => { const n = parseCLP(amount); if (n !== null && !Number.isNaN(n)) setAmount(formatCLP(n)) }} placeholder="$35.000" />
          </div>
          <div className="field">
            <label htmlFor="pg-due">Vence</label>
            <input id="pg-due" className="input" type="date" value={due} onChange={(e) => setDue(e.target.value)} />
          </div>
        </div>
        <div className="field">
          <span className="field__label" id="pg-method">Medio de pago</span>
          <div className="segmented segmented--wrap" role="group" aria-labelledby="pg-method">
            {methods.map((m) => <button key={m} type="button" aria-pressed={method === m} onClick={() => setMethod(m)}>{methodLabel[m]}</button>)}
          </div>
        </div>
        {isAdmin && (
          <div className="field">
            <span className="field__label" id="pg-status">Estado</span>
            <div className="segmented" role="group" aria-labelledby="pg-status">
              <button type="button" aria-pressed={status === 'pagado'} onClick={() => setStatus('pagado')}>Pagado</button>
              <button type="button" aria-pressed={status === 'pendiente'} onClick={() => setStatus('pendiente')}>Pendiente</button>
            </div>
          </div>
        )}
        <div className="field">
          <label htmlFor="pg-file">Comprobante (opcional)</label>
          <input id="pg-file" className="input input--file" type="file" accept="image/*,application/pdf" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          <span className="hint">Foto o PDF de la transferencia, máx. 5 MB.</span>
        </div>
        <div className="field">
          <label htmlFor="pg-notes">Notas</label>
          <textarea id="pg-notes" className="input" rows={2} maxLength={400} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>
      </section>

      {error && <p className="alert" role="alert">{error}</p>}
      <div className="form-actions">
        <button className="btn" type="submit" disabled={save.isPending}>{save.isPending ? 'Guardando…' : 'Registrar pago'}</button>
        <Link className="btn btn--ghost" to="..">Cancelar</Link>
      </div>
    </form>
  )
}

function PagoDetalle({ p }: { p: PaymentRow }) {
  const { activeSchool, role } = useSchool()
  const schoolId = activeSchool?.id
  const isAdmin = role === 'admin' || role === 'ceo'
  const qc = useQueryClient()
  const navigate = useNavigate()
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const refresh = async () => {
    await qc.invalidateQueries({ queryKey: paymentsKey(schoolId) })
    await qc.invalidateQueries({ queryKey: ['payment', p.id] })
    await qc.invalidateQueries({ queryKey: ['student-payments', p.student_id] })
  }
  const setStatus = useMutation({
    mutationFn: ({ status }: { status: PaymentStatus; label: string }) => updatePayment(p.id, { status }),
    onSuccess: async (_d, v) => { setMsg({ ok: true, text: v.label }); await refresh() },
    onError: (e: Error) => setMsg({ ok: false, text: e.message }),
  })
  const attach = useMutation({
    mutationFn: async (file: File) => {
      const path = await uploadReceipt(schoolId!, p.id, file)
      await attachReceipt(p.id, path)
    },
    onSuccess: async () => { setMsg({ ok: true, text: 'Comprobante adjuntado.' }); await refresh() },
    onError: (e: Error) => setMsg({ ok: false, text: e.message }),
  })
  const openReceipt = useMutation({
    mutationFn: () => receiptUrl(p.receipt_path!),
    onSuccess: (url) => window.open(url, '_blank', 'noopener'),
    onError: (e: Error) => setMsg({ ok: false, text: e.message }),
  })
  const sendMail = useMutation({
    mutationFn: () => emailReceipt(schoolId!, p.id),
    onSuccess: () => setMsg({ ok: true, text: `Comprobante enviado a ${p.student?.email}.` }),
    onError: (e: Error) => setMsg({ ok: false, text: e.message }),
  })
  const remove = useMutation({
    mutationFn: () => deletePayment(p.id, p.receipt_path),
    onSuccess: async () => { await refresh(); navigate('..', { replace: true }) },
    onError: (e: Error) => setMsg({ ok: false, text: e.message }),
  })

  return (
    <div className="alumno-form">
      <header className="page-head">
        <Link className="link-btn back-link" to=".."><Icon name="back" size={16} /> Pagos</Link>
        <h1>{formatCLP(p.amount)}</h1>
        <p className="hint"><span className={`tag tag--pay-${p.status}`}>{statusLabel[p.status]}</span> {p.concept}</p>
      </header>

      <section className="card form-section">
        <dl className="facts">
          <div><dt>Alumno</dt><dd>{p.student ? <Link to={`/app/alumnos/${p.student.id}`}>{p.student.full_name}</Link> : '—'}</dd></div>
          <div><dt>Medio</dt><dd>{methodLabel[p.method]}</dd></div>
          <div><dt>Registrado</dt><dd>{formatDate(santiagoDate(p.created_at))}</dd></div>
          <div><dt>Pagado</dt><dd>{p.paid_at ? formatDate(santiagoDate(p.paid_at)) : '—'}</dd></div>
          {p.due_date && <div><dt>Vence</dt><dd>{formatDate(p.due_date)}</dd></div>}
          {p.enrollment?.plan && <div><dt>Inscripción</dt><dd><Link to={`/app/matriculas/${p.enrollment.id}`}>{p.enrollment.plan.name}</Link></dd></div>}
          {p.notes && <div className="facts__wide"><dt>Notas</dt><dd>{p.notes}</dd></div>}
        </dl>
      </section>

      <section className="card form-section">
        <h2>Comprobante</h2>
        <div className="form-actions">
          {p.receipt_path ? (
            <button type="button" className="btn btn--ghost" onClick={() => openReceipt.mutate()} disabled={openReceipt.isPending}>Ver comprobante</button>
          ) : <span className="hint">Sin comprobante adjunto.</span>}
          <label className="btn btn--ghost file-btn">
            {attach.isPending ? 'Subiendo…' : p.receipt_path ? 'Reemplazar' : 'Adjuntar'}
            <input type="file" accept="image/*,application/pdf" onChange={(e) => { const f = e.target.files?.[0]; if (f) attach.mutate(f); e.target.value = '' }} />
          </label>
        </div>
      </section>

      {isAdmin && (
        <section className="card form-section">
          <h2>Acciones</h2>
          <div className="form-actions">
            {p.status !== 'pagado' && p.status !== 'reembolsado' && (
              <button type="button" className="btn" disabled={setStatus.isPending} onClick={() => setStatus.mutate({ status: 'pagado', label: 'Pago confirmado.' })}>Confirmar pago</button>
            )}
            {p.status === 'pendiente' && (
              <button type="button" className="btn btn--ghost" disabled={setStatus.isPending} onClick={() => setStatus.mutate({ status: 'fallido', label: 'Marcado como fallido.' })}>Marcar fallido</button>
            )}
            {p.status === 'pagado' && (
              <>
                <button type="button" className="btn btn--ghost" disabled={sendMail.isPending || !p.student?.email} onClick={() => sendMail.mutate()} title={p.student?.email ? undefined : 'El alumno no tiene correo'}>
                  <Icon name="mail" size={16} /> {sendMail.isPending ? 'Enviando…' : 'Enviar comprobante'}
                </button>
                <button type="button" className="btn btn--ghost" disabled={setStatus.isPending} onClick={() => setStatus.mutate({ status: 'reembolsado', label: 'Marcado como reembolsado.' })}>Reembolsar</button>
              </>
            )}
            {p.status !== 'pendiente' && (
              <button type="button" className="btn btn--ghost" disabled={setStatus.isPending} onClick={() => setStatus.mutate({ status: 'pendiente', label: 'Vuelto a pendiente.' })}>Volver a pendiente</button>
            )}
            <span className="form-actions__danger">
              {confirmDelete ? (
                <>
                  <span className="hint">¿Eliminar el pago?</span>
                  <button type="button" className="btn btn--danger" onClick={() => remove.mutate()}>Eliminar</button>
                  <button type="button" className="btn btn--ghost" onClick={() => setConfirmDelete(false)}>No</button>
                </>
              ) : (
                <button type="button" className="btn btn--ghost" onClick={() => setConfirmDelete(true)}><Icon name="trash" size={16} /> Eliminar</button>
              )}
            </span>
          </div>
          {p.status === 'pagado' && !p.student?.email && <p className="hint">Para enviar el comprobante, agrega el correo del alumno en su ficha.</p>}
        </section>
      )}
      {!isAdmin && p.status === 'pendiente' && <p className="hint">Un administrador debe confirmar este pago.</p>}

      {msg && <p className={`alert${msg.ok ? ' alert--ok' : ''}`} role={msg.ok ? 'status' : 'alert'}>{msg.text}</p>}
    </div>
  )
}
