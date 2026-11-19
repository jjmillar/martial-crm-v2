import { useEffect, useState, type FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '../../lib/nav'
import { useSchool } from '../../lib/school'
import { formatDate, santiagoDate, todayIso, yearsSince } from '../../lib/dates'
import { formatRut, normalizeRut } from '../../lib/rut'
import { Icon } from '../../ui/Icon'
import { Modal } from '../../ui/Modal'
import {
  cancelChildRequest, childRequestsKey, createClaim, myChildRequests, myWards, requestChild, wardsKey,
  type Claim, type ChildInput, type Ward,
} from './guardian'

// Ajustes → "Mis hijos": the guardian's children with their data, the requests waiting for the school, a form
// to add another child and the hand-over of the account when the child is old enough for their own login.
export function MisHijos() {
  const { activeSchool, wards, reload } = useSchool()
  const schoolId = activeSchool?.id
  const ids = wards.map((w) => w.id)
  const kids = useQuery({ queryKey: [...wardsKey(schoolId), ids.join()], queryFn: () => myWards(ids), enabled: Boolean(schoolId) })
  const reqs = useQuery({ queryKey: childRequestsKey(schoolId), queryFn: () => myChildRequests(schoolId!), enabled: Boolean(schoolId), refetchInterval: 60_000 })
  const qc = useQueryClient()
  const [adding, setAdding] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  // A request approved since the last load means a new child: refresh the switcher once.
  const missing = (reqs.data ?? []).some((r) => r.status === 'aprobada' && r.student_id && !ids.includes(r.student_id))
  useEffect(() => { if (missing) void reload() }, [missing, reload])

  const open = (reqs.data ?? []).filter((r) => r.status === 'pendiente' || (r.status === 'rechazada' && r.decided_at && r.decided_at.slice(0, 10) >= addDaysIso(-30)))
  const cancel = useMutation({ mutationFn: cancelChildRequest, onSuccess: () => qc.invalidateQueries({ queryKey: childRequestsKey(schoolId) }) })

  return (
    <div className="form-section kids" data-motion>
      <p className="hint">Si tus hijos también entrenan en {activeSchool?.name ?? 'la escuela'}, agrégalos aquí. La escuela aprueba cada uno; después ves su nivel, su plan y sus pagos y marcas su asistencia desde tu cuenta (arriba eliges a quién estás viendo). Su perfil público parte privado.</p>
      {msg && <p className="alert alert--ok" role="status">{msg}</p>}

      {(kids.data ?? []).length > 0 && (
        <div className="kids__grid">
          {kids.data!.map((k) => <KidCard key={k.id} k={k} onHandedOver={async () => { await reload(); await qc.invalidateQueries({ queryKey: wardsKey(schoolId) }) }} />)}
        </div>
      )}

      {open.length > 0 && (
        <ul className="kids__reqs">
          {open.map((r) => (
            <li key={r.id} className="card kids__req">
              <span className="kids__req-main">
                <strong>{[r.first_name, r.middle_name, r.first_last_name, r.second_last_name].filter(Boolean).join(' ')}</strong>
                <span className="hint">{r.status === 'pendiente' ? `Enviada el ${formatDate(santiagoDate(r.created_at))}` : `No aprobada${r.reject_reason ? `: ${r.reject_reason}` : ''}`}</span>
              </span>
              {r.status === 'pendiente'
                ? <span className="kids__req-side"><span className="tag tag--wait">Esperando aprobación</span><button type="button" className="link-btn" disabled={cancel.isPending} onClick={() => cancel.mutate(r.id)}>Cancelar</button></span>
                : <span className="tag tag--pay-fallido">Rechazada</span>}
            </li>
          ))}
        </ul>
      )}

      <div className="form-actions">
        <button type="button" className="btn btn--ghost" onClick={() => { setMsg(null); setAdding(true) }}><Icon name="plus" size={16} /> Agregar hijo</button>
      </div>

      <Modal open={adding} onClose={() => setAdding(false)} labelledBy="kid-new-h">
        <ChildForm schoolId={schoolId!} onCancel={() => setAdding(false)} onSent={async (name) => {
          setAdding(false)
          setMsg(`Solicitud enviada. Cuando la escuela apruebe a ${name}, aparecerá aquí y arriba para elegirlo.`)
          await qc.invalidateQueries({ queryKey: childRequestsKey(schoolId) })
        }} />
      </Modal>
    </div>
  )
}

function addDaysIso(n: number) {
  const d = new Date(`${todayIso()}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

function KidCard({ k, onHandedOver }: { k: Ward; onHandedOver: () => Promise<void> }) {
  const { setViewing } = useSchool()
  const navigate = useNavigate()
  const [step, setStep] = useState<'idle' | 'confirm' | 'code'>('idle')
  const [claim, setClaim] = useState<Claim | null>(null)
  const [copied, setCopied] = useState(false)
  const age = yearsSince(k.birth_date)
  const gen = useMutation({ mutationFn: () => createClaim(k.id), onSuccess: (c) => { setClaim(c); setStep('code') } })
  const link = claim ? `${window.location.origin}/e/${claim.slug}/registro?codigo=${claim.code}` : ''

  async function copy() {
    try { await navigator.clipboard.writeText(link); setCopied(true); setTimeout(() => setCopied(false), 2000) } catch { /* clipboard blocked: the link stays visible */ }
  }

  return (
    <article className="card kid">
      <div className="kid__head">
        <span className="avatar" aria-hidden="true">{(k.first_name[0] ?? '?').toUpperCase()}</span>
        <span className="kid__name"><strong>{k.full_name}</strong><span className="hint">{[age !== null ? `${age} años` : null, k.belt ? `Cinturón ${k.belt}` : null].filter(Boolean).join(' · ') || 'Alumno'}</span></span>
      </div>
      <dl className="kid__facts">
        <div><dt>RUT</dt><dd>{k.rut ? formatRut(k.rut) : '—'}</dd></div>
        <div><dt>Nacimiento</dt><dd>{k.birth_date ? formatDate(k.birth_date) : '—'}</dd></div>
        <div><dt>Correo</dt><dd>{k.email ?? '—'}</dd></div>
        <div><dt>Dirección</dt><dd>{k.address ?? '—'}</dd></div>
      </dl>
      <div className="kid__actions">
        <button type="button" className="btn" onClick={() => { setViewing(k.id); navigate('/app/inicio') }}>Ver su perfil</button>
        {step === 'idle' && <button type="button" className="btn btn--ghost" onClick={() => setStep('confirm')}>Darle su propia cuenta</button>}
      </div>
      {step === 'confirm' && (
        <div className="kid__handover">
          <p className="hint">Te daremos un código para que {k.first_name} cree su cuenta con su propio correo. Conserva todo: asistencias, nivel, experiencia y pagos. Cuando lo use, dejarás de verlo desde tu cuenta.</p>
          {gen.isError && <p className="alert" role="alert">{(gen.error as Error).message}</p>}
          <div className="form-actions">
            <button type="button" className="btn" disabled={gen.isPending} onClick={() => gen.mutate()}>{gen.isPending ? 'Generando…' : 'Generar código'}</button>
            <button type="button" className="btn btn--ghost" onClick={() => setStep('idle')}>Cancelar</button>
          </div>
        </div>
      )}
      {step === 'code' && claim && (
        <div className="kid__handover">
          <p className="hint">Comparte este enlace con {k.first_name}. Vale una vez, hasta el {formatDate(santiagoDate(claim.expires_at))}. Si ya tiene cuenta, puede escribir el código al entrar.</p>
          <p className="kid__code" aria-label="Código"><code>{claim.code}</code></p>
          <div className="kid__link"><input className="input" readOnly value={link} aria-label="Enlace para activar su cuenta" onFocus={(e) => e.currentTarget.select()} /><button type="button" className="btn btn--ghost" onClick={copy}><Icon name="copy" size={16} /> {copied ? 'Copiado' : 'Copiar'}</button></div>
          <div className="form-actions">
            <button type="button" className="link-btn" onClick={() => { void onHandedOver(); setStep('idle') }}>Listo</button>
          </div>
        </div>
      )}
    </article>
  )
}

const emptyChild: ChildInput = { first_name: '', middle_name: '', first_last_name: '', second_last_name: '', rut: '', email: '', birth_date: '', address: '' }

function ChildForm({ schoolId, onCancel, onSent }: { schoolId: string; onCancel: () => void; onSent: (name: string) => void }) {
  const [f, setF] = useState<ChildInput>(emptyChild)
  const [err, setErr] = useState<string | null>(null)
  const set = (k: keyof ChildInput, v: string) => { setF((x) => ({ ...x, [k]: v })); setErr(null) }
  const age = yearsSince(f.birth_date || null)
  const send = useMutation({ mutationFn: (v: ChildInput) => requestChild(schoolId, v), onSuccess: () => onSent(f.first_name.trim()), onError: (e: Error) => setErr(e.message) })

  function submit(e: FormEvent) {
    e.preventDefault()
    if (!f.first_name.trim() || !f.first_last_name.trim()) return setErr('Escribe su nombre y su apellido paterno.')
    if (!f.second_last_name.trim()) return setErr('Escribe su apellido materno.')
    const rut = normalizeRut(f.rut)
    if (!rut) return setErr('Escribe un RUT válido. Ej: 12.345.678-5')
    if (!/^\S+@\S+\.\S+$/.test(f.email.trim())) return setErr('Correo inválido.')
    if (!f.birth_date || f.birth_date > todayIso() || f.birth_date < '1900-01-01') return setErr('Indica su fecha de nacimiento.')
    if (!f.address.trim()) return setErr('Escribe su dirección.')
    send.mutate({ ...f, rut })
  }

  return (
    <form className="sub-form" onSubmit={submit} noValidate>
      <div className="modal__head">
        <div><span className="eyebrow">Apoderado</span><h2 id="kid-new-h">Agregar hijo</h2></div>
        <button type="button" className="icon-btn" onClick={onCancel} aria-label="Cerrar"><Icon name="close" /></button>
      </div>
      <p className="hint">Los mismos datos que cualquier alumno. La escuela revisa y aprueba la solicitud.</p>
      <div className="form-grid">
        <div className="field"><label htmlFor="k-first">Primer nombre *</label><input id="k-first" className="input" autoComplete="off" value={f.first_name} onChange={(e) => set('first_name', e.target.value)} /></div>
        <div className="field"><label htmlFor="k-middle">Segundo nombre</label><input id="k-middle" className="input" autoComplete="off" value={f.middle_name} onChange={(e) => set('middle_name', e.target.value)} /></div>
        <div className="field"><label htmlFor="k-last">Apellido paterno *</label><input id="k-last" className="input" autoComplete="off" value={f.first_last_name} onChange={(e) => set('first_last_name', e.target.value)} /></div>
        <div className="field"><label htmlFor="k-last2">Apellido materno *</label><input id="k-last2" className="input" autoComplete="off" value={f.second_last_name} onChange={(e) => set('second_last_name', e.target.value)} /></div>
        <div className="field"><label htmlFor="k-rut">RUT *</label><input id="k-rut" className="input" placeholder="12.345.678-5" value={f.rut} onChange={(e) => set('rut', e.target.value)} onBlur={() => { if (normalizeRut(f.rut)) set('rut', formatRut(f.rut)) }} /></div>
        <div className="field">
          <label htmlFor="k-birth">Fecha de nacimiento *{age !== null && age >= 0 ? ` · ${age} ${age === 1 ? 'año' : 'años'}` : ''}</label>
          <input id="k-birth" className="input" type="date" min="1900-01-01" max={todayIso()} value={f.birth_date} onChange={(e) => set('birth_date', e.target.value)} />
        </div>
        <div className="field"><label htmlFor="k-email">Correo *</label><input id="k-email" className="input" type="email" autoComplete="off" placeholder="Puede ser el tuyo" value={f.email} onChange={(e) => set('email', e.target.value)} /></div>
        <div className="field"><label htmlFor="k-address">Dirección *</label><input id="k-address" className="input" autoComplete="street-address" placeholder="Calle, número, comuna" value={f.address} onChange={(e) => set('address', e.target.value)} /></div>
      </div>
      {err && <p className="alert" role="alert">{err}</p>}
      <div className="form-actions">
        <button type="submit" className="btn" disabled={send.isPending}>{send.isPending ? 'Enviando…' : 'Enviar solicitud'}</button>
        <button type="button" className="btn btn--ghost" onClick={onCancel}>Cancelar</button>
      </div>
    </form>
  )
}
