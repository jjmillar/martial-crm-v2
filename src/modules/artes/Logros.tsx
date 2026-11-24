import { useState, type ReactNode } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { formatDate, todayIso } from '../../lib/dates'
import { Icon } from '../../ui/Icon'
import { Modal } from '../../ui/Modal'
import { ShowMore } from '../../ui/ShowMore'
import { FIRST, PAGE, useShowMore } from '../../ui/useShowMore'
import { catalogQuery } from '../ajustes/catalogApi'
import { BeltBar, BeltChip } from './Belt'
import {
  achievementsKey, addAchievement, artsKey, deleteAchievement, degreeText, draftError, emptyDraft, listAchievements, listArts, listMilestones,
  listStudentArts, medalOf, MEDALS, milestonesKey, pendingAchievementsKey, studentArtsKey, submitAchievement, withdrawAchievement,
  type Achievement, type AchievementDraft, type Milestone,
} from './api'

// --- Presentation (also used by the public profile) -----------------------------------------------------------------------

export type LogroView = {
  key: string; date: string; title: string; sub?: string | null; icon: ReactNode
  status?: 'pendiente' | 'rechazado'; reason?: string | null; action?: ReactNode
}

export function medalIcon(medal: string | null | undefined) {
  const m = medalOf(medal)
  return <span className="logro__emoji" role="img" aria-label={m ? `Medalla ${m.label}` : 'Torneo'}>{m?.icon ?? '🏆'}</span>
}

export function fromAchievement(a: Pick<Achievement, 'id' | 'kind' | 'title' | 'detail' | 'date' | 'medal' | 'category' | 'status' | 'reject_reason'> & { artName?: string | null; color?: string | null; stripe?: string | null; bar?: string | null; pattern?: string | null; badgeIcon?: string | null }, action?: ReactNode): LogroView {
  const icon = a.kind === 'graduacion'
    ? (a.color ? <BeltBar color={a.color} stripe={a.stripe} bar={a.bar} pattern={a.pattern} size="lg" title="Graduación" /> : <span className="logro__emoji" aria-hidden="true">🥋</span>)
    : a.kind === 'torneo' ? medalIcon(a.medal)
    : <span className="logro__emoji" aria-hidden="true">{a.badgeIcon || '🏵️'}</span>
  const medal = a.kind === 'torneo' ? medalOf(a.medal)?.label : null
  const kindLabel = a.kind === 'graduacion' ? 'Graduación' : a.kind === 'torneo' ? 'Torneo' : 'Insignia de la escuela'
  return {
    key: a.id, date: a.date, title: a.title, icon, action,
    sub: [kindLabel, a.artName, medal, a.category, a.detail].filter(Boolean).join(' · '),
    status: a.status === 'aprobado' ? undefined : a.status, reason: a.reject_reason,
  }
}

export function fromMilestone(m: Milestone): LogroView {
  return { key: m.key, date: m.date, title: m.title, sub: 'Hito', icon: <span className="logro__emoji" aria-hidden="true">{m.icon}</span> }
}

/** Medal counts and totals in one line. */
export function LogrosSummary({ medals, graduations, milestones }: { medals: (string | null)[]; graduations: number; milestones: number }) {
  const count = (m: string) => medals.filter((x) => x === m).length
  const parts = [
    ...MEDALS.filter((m) => m.id !== 'participacion' && count(m.id) > 0).map((m) => <span key={m.id} title={m.label}>{m.icon} {count(m.id)}</span>),
    graduations > 0 && <span key="g">🥋 {graduations} {graduations === 1 ? 'graduación' : 'graduaciones'}</span>,
    milestones > 0 && <span key="h">⭐ {milestones} {milestones === 1 ? 'hito' : 'hitos'}</span>,
  ].filter(Boolean)
  return parts.length ? <p className="logros__summary">{parts}</p> : null
}

/**
 * Newest first (pending ones on top), last 3 + "Mostrar más" (docs/ui-standards.md §3). Without persistKey (public,
 * server-rendered page) how far it was expanded is not remembered, so server and browser render the same.
 */
export function LogrosList({ items, persistKey, empty }: { items: LogroView[]; persistKey?: string; empty: string }) {
  const persisted = useShowMore(persistKey ?? 'logros.sin-guardar')
  const [localShown, setLocalShown] = useState(FIRST)
  const more = persistKey ? persisted : { shown: localShown, more: () => setLocalShown((n) => (n < PAGE ? PAGE : n + PAGE)) }
  const sorted = [...items].sort((a, b) => (a.status === 'pendiente') === (b.status === 'pendiente') ? b.date.localeCompare(a.date) : a.status === 'pendiente' ? -1 : 1)
  if (sorted.length === 0) return <p className="hint">{empty}</p>
  return (
    <>
      <ul className="logros">
        {sorted.slice(0, more.shown).map((l) => (
          <li key={l.key} className={`logro${l.status ? ` logro--${l.status}` : ''}`}>
            <span className="logro__icon">{l.icon}</span>
            <span className="logro__main">
              <strong>{l.title}</strong>
              <span className="hint">{formatDate(l.date)}{l.sub ? ` · ${l.sub}` : ''}</span>
              {l.status === 'rechazado' && l.reason && <span className="hint">Motivo: {l.reason}</span>}
            </span>
            {l.status === 'pendiente' && <span className="tag tag--wait">Por aprobar</span>}
            {l.status === 'rechazado' && <span className="tag">Rechazado</span>}
            {l.action}
          </li>
        ))}
      </ul>
      <ShowMore shown={more.shown} total={sorted.length} onMore={more.more} noun="logros" />
    </>
  )
}

// --- Data hook ---------------------------------------------------------------------------------------------------------------

function useLogros(studentId: string | undefined) {
  const items = useQuery({ queryKey: achievementsKey(studentId), queryFn: () => listAchievements(studentId!), enabled: Boolean(studentId) })
  const milestones = useQuery({ queryKey: milestonesKey(studentId), queryFn: () => listMilestones(studentId!), enabled: Boolean(studentId) })
  return { items, milestones, loading: items.isLoading || milestones.isLoading }
}

const toView = (a: Achievement, action?: ReactNode) =>
  fromAchievement({ ...a, artName: a.art?.name, color: a.belt?.color, stripe: a.belt?.stripe, bar: a.belt?.bar, pattern: a.belt?.pattern, badgeIcon: a.badge?.icon }, action)

// --- Team: student form section ---------------------------------------------------------------------------------------------

type FormKind = AchievementDraft['kind']

/** "Logros" in the student's file: everything they achieved, and the team adds tournaments, badges and past graduations. */
export function StudentLogros({ studentId, schoolId }: { studentId: string; schoolId: string }) {
  const qc = useQueryClient()
  const { items, milestones, loading } = useLogros(studentId)
  const [form, setForm] = useState<FormKind | null>(null)
  const [open, setOpen] = useState(false)
  const [confirmId, setConfirmId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const refresh = () => Promise.all([
    qc.invalidateQueries({ queryKey: achievementsKey(studentId) }),
    qc.invalidateQueries({ queryKey: pendingAchievementsKey(schoolId) }),
  ])
  const remove = useMutation({ mutationFn: deleteAchievement, onMutate: () => setError(null), onSuccess: () => { setConfirmId(null); return refresh() }, onError: (e: Error) => setError(e.message) })

  const views = [
    ...(items.data ?? []).map((a) => toView(a, confirmId === a.id ? (
      <span className="logro__confirm">
        <button type="button" className="btn btn--danger btn--sm" disabled={remove.isPending} onClick={() => remove.mutate(a.id)}>Eliminar</button>
        <button type="button" className="btn btn--ghost btn--sm" onClick={() => setConfirmId(null)}>No</button>
      </span>
    ) : (
      <button type="button" className="icon-btn" onClick={() => setConfirmId(a.id)} aria-label={`Eliminar logro ${a.title}`} title="Eliminar"><Icon name="trash" size={16} /></button>
    ))),
    ...(milestones.data ?? []).map(fromMilestone),
  ]
  const approved = (items.data ?? []).filter((a) => a.status === 'aprobado')
  const openForm = (k: FormKind) => { setForm(k); setOpen(true) }

  return (
    <section className="card form-section" aria-labelledby="logros-h">
      <div className="logros__head">
        <h2 id="logros-h">Logros</h2>
        <LogrosSummary medals={approved.filter((a) => a.kind === 'torneo').map((a) => a.medal)} graduations={approved.filter((a) => a.kind === 'graduacion').length} milestones={milestones.data?.length ?? 0} />
      </div>
      <div className="logros__actions">
        <button type="button" className="btn btn--ghost btn--sm" onClick={() => openForm('torneo')}><Icon name="plus" size={14} /> Torneo</button>
        <button type="button" className="btn btn--ghost btn--sm" onClick={() => openForm('escuela')}><Icon name="plus" size={14} /> Insignia</button>
        <button type="button" className="btn btn--ghost btn--sm" onClick={() => openForm('graduacion')}><Icon name="plus" size={14} /> Graduación anterior</button>
      </div>
      {error && <p className="alert" role="alert">{error}</p>}
      {loading ? <p className="hint">Cargando…</p> : (
        <LogrosList items={views} persistKey="alumno.logros" empty="Aún no tiene logros. Las graduaciones se registran solas al subirle el cinturón o grado, y los hitos al asistir a clases." />
      )}
      <Modal open={open} onClose={() => setOpen(false)} label="Nuevo logro" isolate>
        {form && (
          <AchievementForm
            kind={form}
            schoolId={schoolId}
            onClose={() => setOpen(false)}
            submit={(d, badgeName) => addAchievement(schoolId, studentId, d, badgeName)}
            onDone={() => { setOpen(false); return refresh() }}
          />
        )}
      </Modal>
    </section>
  )
}

// --- Student / guardian portal --------------------------------------------------------------------------------------------------

/** Portal tile: the student's achievements; they can submit a tournament for the school to approve. */
export function MisLogros({ studentId, schoolId, child }: { studentId: string; schoolId: string; child: boolean }) {
  const qc = useQueryClient()
  const { items, milestones, loading } = useLogros(studentId)
  const [open, setOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const refresh = () => qc.invalidateQueries({ queryKey: achievementsKey(studentId) })
  const withdraw = useMutation({ mutationFn: withdrawAchievement, onMutate: () => setError(null), onSuccess: refresh, onError: (e: Error) => setError(e.message) })
  const approved = (items.data ?? []).filter((a) => a.status === 'aprobado')
  const views = [
    ...(items.data ?? []).map((a) => toView(a, a.status === 'pendiente'
      ? <button type="button" className="link-btn" disabled={withdraw.isPending} onClick={() => withdraw.mutate(a.id)}>Retirar</button>
      : undefined)),
    ...(milestones.data ?? []).map(fromMilestone),
  ]
  return (
    <>
      <div className="tile__head">
        <span className="eyebrow">Logros</span>
        <button type="button" className="link-btn" onClick={() => setOpen(true)}><Icon name="plus" size={14} /> Registrar torneo</button>
      </div>
      <LogrosSummary medals={approved.filter((a) => a.kind === 'torneo').map((a) => a.medal)} graduations={approved.filter((a) => a.kind === 'graduacion').length} milestones={milestones.data?.length ?? 0} />
      {error && <p className="alert" role="alert">{error}</p>}
      {loading ? <p className="hint">Cargando…</p> : (
        <LogrosList items={views} persistKey="portal.logros" empty={child ? 'Sus logros aparecen aquí: hitos por asistir, graduaciones, torneos e insignias.' : 'Tus logros aparecen aquí: hitos por asistir, graduaciones, torneos e insignias.'} />
      )}
      <Modal open={open} onClose={() => setOpen(false)} label="Registrar torneo">
        <AchievementForm
          kind="torneo"
          schoolId={schoolId}
          note="La escuela lo revisa y, al aprobarlo, aparece en tus logros y en tu perfil público."
          onClose={() => setOpen(false)}
          submit={(d) => submitAchievement(studentId, d)}
          onDone={() => { setOpen(false); return refresh() }}
        />
      </Modal>
    </>
  )
}

// --- Form ----------------------------------------------------------------------------------------------------------------------

type FormProps = {
  kind: FormKind; schoolId: string; note?: string
  submit: (d: AchievementDraft, badgeName?: string) => Promise<void>
  onDone: () => unknown; onClose: () => void
}

const TITLES: Record<FormKind, string> = { torneo: 'Torneo', escuela: 'Insignia de la escuela', graduacion: 'Graduación anterior' }

function AchievementForm({ kind, schoolId, note, submit, onDone, onClose }: FormProps) {
  const today = todayIso()
  const [d, setD] = useState<AchievementDraft>(() => emptyDraft(kind, today))
  const [error, setError] = useState<string | null>(null)
  const arts = useQuery({ queryKey: artsKey(schoolId), queryFn: () => listArts(schoolId) })
  const badgesQ = catalogQuery('school_badges', schoolId)
  const badges = useQuery({ ...badgesQ, enabled: kind === 'escuela' })
  const set = <K extends keyof AchievementDraft>(k: K, v: AchievementDraft[K]) => setD((x) => ({ ...x, [k]: v }))
  const save = useMutation({
    mutationFn: () => {
      const err = draftError(d, today)
      if (err) throw new Error(err)
      return submit(d, badges.data?.find((b) => b.id === d.badge_id)?.text)
    },
    onMutate: () => setError(null), onSuccess: onDone, onError: (e: Error) => setError(e.message),
  })
  const activeArts = (arts.data ?? []).filter((a) => a.active)
  const activeBadges = (badges.data ?? []).filter((b) => b.active)

  return (
    <>
      <div className="modal__head">
        <span className="eyebrow">{TITLES[kind]}</span>
        <button type="button" className="icon-btn" onClick={onClose} aria-label="Cerrar"><Icon name="close" /></button>
      </div>
      <form className="belt-form" onSubmit={(e) => { e.preventDefault(); save.mutate() }} noValidate>
        {note && <p className="hint">{note}</p>}
        <div className="form-grid">
          {kind === 'escuela' ? (
            <div className="field field--wide">
              <label htmlFor="ach-badge">Insignia</label>
              {badges.isSuccess && activeBadges.length === 0
                ? <p className="hint">Aún no hay insignias. Créalas en Ajustes → Catálogos → Insignias.</p>
                : (
                  <select id="ach-badge" className="input" value={d.badge_id} onChange={(e) => set('badge_id', e.target.value)}>
                    <option value="">Elige una insignia</option>
                    {activeBadges.map((b) => <option key={b.id} value={b.id}>{b.icon ? `${b.icon} ` : ''}{b.text}</option>)}
                  </select>
                )}
            </div>
          ) : (
            <div className="field field--wide">
              <label htmlFor="ach-title">{kind === 'torneo' ? 'Torneo' : 'Cinturón o grado'}</label>
              <input id="ach-title" className="input" maxLength={100} value={d.title} onChange={(e) => set('title', e.target.value)} placeholder={kind === 'torneo' ? 'Ej: Copa Santiago 2026' : 'Ej: Cinturón azul'} />
            </div>
          )}
          {kind === 'torneo' && (
            <>
              <div className="field field--wide">
                <span className="field__label" id="ach-medal-l">Resultado</span>
                <div className="segmented segmented--wrap" role="group" aria-labelledby="ach-medal-l">
                  {MEDALS.map((m) => <button key={m.id} type="button" aria-pressed={d.medal === m.id} onClick={() => set('medal', m.id)}>{m.icon} {m.label}</button>)}
                </div>
              </div>
              <div className="field">
                <label htmlFor="ach-cat">Categoría (opcional)</label>
                <input id="ach-cat" className="input" maxLength={60} value={d.category} onChange={(e) => set('category', e.target.value)} placeholder="Ej: Adulto azul -76 kg" />
              </div>
            </>
          )}
          <div className="field">
            <label htmlFor="ach-date">Fecha</label>
            <input id="ach-date" className="input" type="date" max={today} value={d.date} onChange={(e) => set('date', e.target.value)} />
          </div>
          {kind !== 'escuela' && activeArts.length > 0 && (
            <div className="field">
              <label htmlFor="ach-art">Arte marcial (opcional)</label>
              <select id="ach-art" className="input" value={d.art_id} onChange={(e) => set('art_id', e.target.value)}>
                <option value="">—</option>
                {activeArts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </div>
          )}
          <div className="field field--wide">
            <label htmlFor="ach-detail">Detalle (opcional)</label>
            <input id="ach-detail" className="input" maxLength={300} value={d.detail} onChange={(e) => set('detail', e.target.value)} placeholder={kind === 'escuela' ? 'Ej: Por ayudar a los nuevos' : 'Ej: 3 luchas ganadas por sumisión'} />
          </div>
        </div>
        {error && <p className="alert" role="alert">{error}</p>}
        <button type="submit" className="btn" disabled={save.isPending}>{save.isPending ? 'Guardando…' : note ? 'Enviar a la escuela' : 'Guardar logro'}</button>
      </form>
    </>
  )
}

/** Portal tile: the belt of each art the student practices. */
export function MisCinturones({ studentId, child }: { studentId: string; child: boolean }) {
  const arts = useQuery({ queryKey: studentArtsKey(studentId), queryFn: () => listStudentArts(studentId) })
  if (!arts.isSuccess) return <p className="hint">Cargando…</p>
  if (arts.data.length === 0) return <p className="hint">{child ? 'La escuela aún no le asigna arte marcial ni cinturón.' : 'Tu escuela aún no te asigna arte marcial ni cinturón.'}</p>
  return (
    <ul className="my-belts">
      {arts.data.map((a) => (
        <li key={a.id}>
          {a.belt ? (
            <BeltChip size="lg" art={a.art?.name} name={a.belt.name} color={a.belt.color} stripe={a.belt.stripe} bar={a.belt.bar} pattern={a.belt.pattern} degree={a.degree}
              degreeText={degreeText(a.degree, a.belt.degree_name)} />
          ) : <span className="beltchip beltchip--lg"><span className="beltbar beltbar--lg beltbar--empty" aria-hidden="true" /><span className="beltchip__text"><span className="beltchip__art">{a.art?.name}</span><span>Sin cinturón</span></span></span>}
          {a.belt?.rank_label && <span className="hint">{a.belt.rank_label}</span>}
          {a.since && <span className="hint">Desde el {formatDate(a.since)}</span>}
        </li>
      ))}
    </ul>
  )
}
