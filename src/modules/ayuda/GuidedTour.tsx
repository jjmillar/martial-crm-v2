import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useLocation, useNavigate } from '../../lib/nav'
import { useAuth } from '../../lib/auth'
import { useSchool } from '../../lib/school'
import { flash } from '../../ui/flashEvent'
import { Icon } from '../../ui/Icon'
import { classesKey, listClasses } from '../clases/api'
import { listTeachers, teachersKey } from '../profesores/api'
import { listPlans, plansKey } from '../planes/api'
import { TOUR_TASKS, nextStep, readTour, shouldAutoStart, stepDone, writeTour, type TourCounts, type TourSaved, type TourStep } from './tour'

// The first-run guided tour (odd/tasks/tutorial.md S1–S3), drawn on the real pages. A spotlight dims everything
// around the control to use and glides from one control to the next; a coach card sits beside it. The page is never
// blocked: the dimming lets clicks through, and the person fills the real forms (the card docks there).

type Def = {
  route: string
  /** The form this step opens: there the card docks and gives the short version. */
  form?: string
  target?: string
  title: string
  text: string
  formText?: string
  doneTitle?: string
  doneText?: string
}

const DEFS: Record<TourStep, Def> = {
  intro: {
    route: '',
    title: 'Armemos tu escuela',
    text: 'Cuatro pasos cortos: tu escuela, una clase, un profesor y un plan. Son unos 5 minutos y lo demás lo completas cuando quieras.',
  },
  escuela: {
    route: '/app/escuelas',
    target: '[data-tour="escuela"]',
    title: 'Crea tu escuela',
    text: 'Escribe el nombre y elige el arte marcial que enseñas. Logo, dirección y contacto pueden esperar.',
    doneTitle: 'Escuela creada',
    doneText: 'Ahora, la primera clase.',
  },
  clase: {
    route: '/app/escuelas#clases',
    form: '/app/clases/',
    target: '[data-tour="nueva-clase"]',
    title: 'Agrega una clase',
    text: 'Con su nombre y al menos un horario semanal aparece en el calendario, en asistencia y en tu página.',
    formText: 'Ponle nombre y agrega un horario en «Horarios semanales». Después guarda.',
    doneTitle: 'Clase creada',
    doneText: 'Sigue quien la enseña.',
  },
  profesor: {
    route: '/app/miembros#profesores',
    form: '/app/profesores/',
    target: '[data-tour="nuevo-profesor"]',
    title: 'Suma un profesor',
    text: 'Basta con nombre y primer apellido. Después lo asignas a la clase desde su ficha.',
    formText: 'Nombre y primer apellido bastan. Guarda y seguimos.',
    doneTitle: 'Profesor agregado',
    doneText: 'Falta ver cómo se cobra.',
  },
  plan: {
    route: '/app/contabilidad#planes',
    form: '/app/planes/',
    target: '[data-tour="nuevo-plan"]',
    title: 'Así se crea un plan',
    text: 'Un plan es lo que tus alumnos contratan: nombre, precio y cada cuánto se cobra. Ellos lo eligen y pagan desde su cuenta.',
    formText: 'Nombre, precio y ciclo de cobro. Guarda y queda a la vista de tus alumnos.',
    doneTitle: 'Plan creado',
    doneText: 'Tus alumnos ya pueden contratarlo.',
  },
  fin: {
    route: '',
    title: 'Tu escuela está lista',
    text: 'Ya puedes recibir alumnos. Este recorrido y los tutoriales de cada sección están en Ajustes → Ayuda.',
  },
}

const PAD = 8
type Box = { top: number; left: number; width: number; height: number }

const samePath = (route: string, pathname: string) => route.split('#')[0] === pathname

/** The first matching control that is actually on screen (lists render only one of their create buttons).
 *  A control inside a closed section (accordion) opens that section first. */
function findTarget(sel: string, opened: Set<Element>): HTMLElement | null {
  for (const el of document.querySelectorAll<HTMLElement>(sel)) {
    const acc = el.closest('details')
    // once per step: if the person closes it again, it stays closed
    if (acc && !acc.open && !opened.has(acc)) { opened.add(acc); acc.open = true }
    const visible = typeof el.checkVisibility === 'function' ? el.checkVisibility() : el.getClientRects().length > 0
    if (visible) return el
  }
  return null
}

export function GuidedTour() {
  const { user } = useAuth()
  const userId = user?.id
  const { role, loading, schools, activeSchool } = useSchool()
  const location = useLocation()
  const navigate = useNavigate()
  // undefined = not read yet (so it never auto-starts before we know what was saved)
  const [saved, setSaved] = useState<TourSaved | null | undefined>(undefined)

  useEffect(() => {
    if (!userId) return
    const sync = () => setSaved(readTour(userId))
    sync()
    window.addEventListener('mcrm:tour', sync)
    window.addEventListener('storage', sync)
    return () => { window.removeEventListener('mcrm:tour', sync); window.removeEventListener('storage', sync) }
  }, [userId])

  useEffect(() => {
    if (userId && saved !== undefined && shouldAutoStart({ role, loading, schools: schools.length, saved })) {
      writeTour(userId, { status: 'active', step: 'intro' })
    }
  }, [userId, saved, role, loading, schools.length])

  const active = saved?.status === 'active' && (role === 'ceo' || role === 'admin')
  const schoolId = activeSchool?.id
  const on = active && Boolean(schoolId)
  const classes = useQuery({ queryKey: classesKey(schoolId), queryFn: () => listClasses(schoolId!), enabled: on })
  const teachers = useQuery({ queryKey: teachersKey(schoolId), queryFn: () => listTeachers(schoolId!), enabled: on })
  const plans = useQuery({ queryKey: plansKey(schoolId), queryFn: () => listPlans(schoolId!), enabled: on })
  const counts: TourCounts = {
    schools: schools.length,
    classes: classes.data?.length ?? null,
    teachers: teachers.data?.length ?? null,
    plans: plans.data?.length ?? null,
  }

  if (!active || !userId || !saved) return null
  return (
    <TourView
      step={saved.step}
      counts={counts}
      pathname={location.pathname}
      onGo={(s) => {
        writeTour(userId, { status: 'active', step: s })
        if (DEFS[s].route) navigate(DEFS[s].route)
      }}
      onFinish={() => { writeTour(userId, { status: 'done', step: 'fin' }); navigate('/app/inicio') }}
      onSkip={() => { writeTour(userId, { status: 'skipped', step: saved.step }); flash('Puedes retomar el recorrido en Ajustes → Ayuda.') }}
    />
  )
}

type ViewProps = {
  step: TourStep
  counts: TourCounts
  pathname: string
  onGo: (s: TourStep) => void
  onFinish: () => void
  onSkip: () => void
}

/** The drawing: separate from the data so it can be tested and reused. */
export function TourView({ step, counts, pathname, onGo, onFinish, onSkip }: ViewProps) {
  const def = DEFS[step]
  const done = stepDone(step, counts)
  const task = TOUR_TASKS.indexOf(step)
  const framed = step === 'intro' || step === 'fin'
  const onRoute = Boolean(def.route) && samePath(def.route, pathname)
  const onForm = Boolean(def.form) && pathname.startsWith(def.form!)
  const wantsSpot = !framed && !done && onRoute && Boolean(def.target)

  const [box, setBox] = useState<Box | null>(null)
  const cardRef = useRef<HTMLDivElement>(null)
  const primaryRef = useRef<HTMLButtonElement>(null)
  const [cardPos, setCardPos] = useState<{ top: number; left: number } | null>(null)

  // Follow the control while the page scrolls, resizes or re-renders (cheap: one rect read per frame, state only on change).
  useLayoutEffect(() => {
    if (!wantsSpot) { setBox(null); return }
    let raf = 0
    let last = ''
    let scrolled = false
    const opened = new Set<Element>()
    const started = performance.now()
    const tick = () => {
      const el = findTarget(def.target!, opened)
      if (el) {
        if (!scrolled && performance.now() - started > 120) {
          scrolled = true
          const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
          const r0 = el.getBoundingClientRect()
          if (r0.top < 72 || r0.bottom > window.innerHeight - 200) el.scrollIntoView({ block: 'center', behavior: reduce ? 'auto' : 'smooth' })
        }
        const r = el.getBoundingClientRect()
        const next = { top: r.top - PAD, left: r.left - PAD, width: r.width + PAD * 2, height: r.height + PAD * 2 }
        const key = `${Math.round(next.top)}:${Math.round(next.left)}:${Math.round(next.width)}:${Math.round(next.height)}`
        if (key !== last) { last = key; setBox(next) }
      } else if (last) { last = ''; setBox(null) }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [wantsSpot, def.target])

  // Beside the control on wide screens; docked (bottom) on phones and when the control is too tall to sit next to.
  const docked = !box || (typeof window !== 'undefined' && (window.innerWidth <= 760 || box.height > window.innerHeight * 0.4))
  useLayoutEffect(() => {
    if (docked || !box || !cardRef.current) { setCardPos(null); return }
    const c = cardRef.current.getBoundingClientRect()
    const vw = window.innerWidth
    const vh = window.innerHeight
    const below = box.top + box.height + 14
    const top = below + c.height < vh - 16 ? below : Math.max(16, box.top - c.height - 14)
    const left = Math.min(Math.max(16, box.left), vw - c.width - 16)
    setCardPos({ top, left })
  }, [docked, box])

  // The intro and the ending take the focus (they ask for a decision); the other steps leave it on the page.
  useEffect(() => { if (framed) primaryRef.current?.focus({ preventScroll: true }) }, [framed, step])

  let title = def.title
  let text = def.text
  let primary: { label: string; run: () => void } | null = null
  let secondary: { label: string; run: () => void } | null = null
  if (step === 'intro') {
    primary = { label: 'Empezar', run: () => onGo('escuela') }
    secondary = { label: 'Lo hago solo', run: onSkip }
  } else if (step === 'fin') {
    primary = { label: 'Terminar', run: onFinish }
  } else if (done) {
    title = def.doneTitle ?? title
    text = def.doneText ?? text
    primary = { label: step === 'plan' ? 'Terminar recorrido' : 'Seguir', run: () => onGo(nextStep(step)) }
  } else if (onForm) {
    text = def.formText ?? text
  } else if (!onRoute) {
    primary = { label: 'Ir al paso', run: () => onGo(step) }
  }
  if (step === 'plan' && !done) secondary = { label: 'Lo veo después', run: () => onGo('fin') }

  const spot = wantsSpot && box
  const scrim = framed || spot
  const quiet = !framed && !spot // docked over a form or elsewhere: small, no dimming

  return (
    <div className="tour" data-motion="off">
      {scrim && <div className={`tour__scrim${spot ? ' tour__scrim--spot' : ''}`} aria-hidden="true" style={spot ? { top: box.top, left: box.left, width: box.width, height: box.height } : undefined} />}
      <div
        ref={cardRef}
        className={`tour-card${framed ? ' tour-card--center' : docked ? ' tour-card--dock' : ' tour-card--beside'}${quiet ? ' tour-card--quiet' : ''}`}
        style={!framed && !docked && cardPos ? { top: cardPos.top, left: cardPos.left } : undefined}
        role="region"
        aria-label="Recorrido guiado"
      >
        <div key={`${step}-${done}-${onForm}`} className="tour-card__inner" aria-live="polite">
          <h2 className="tour-card__title">
            {done && !framed && <span className="tour-card__ok" aria-hidden="true"><Icon name="check" size={14} /></span>}
            {title}
          </h2>
          <p className="tour-card__text">{text}</p>
        </div>
        <div className="tour-card__foot">
          {task >= 0 && (
            <span className="tour-progress" role="img" aria-label={`Paso ${task + 1} de ${TOUR_TASKS.length}`}>
              {TOUR_TASKS.map((s, i) => <i key={s} className={i < task || (i === task && done) ? 'is-done' : i === task ? 'is-now' : ''} />)}
            </span>
          )}
          <span className="tour-card__actions">
            {step !== 'intro' && step !== 'fin' && <button type="button" className="link-btn tour-card__skip" onClick={onSkip}>Saltar</button>}
            {secondary && <button type="button" className="btn btn--ghost" onClick={secondary.run}>{secondary.label}</button>}
            {primary && <button ref={primaryRef} type="button" className="btn" onClick={primary.run}>{primary.label}{step !== 'fin' && <Icon name="arrow" size={16} />}</button>}
          </span>
        </div>
      </div>
    </div>
  )
}
