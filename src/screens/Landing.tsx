import { useEffect, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link, useNavigate } from '../lib/nav'
import { supabase } from '../lib/supabase'
import { formatCLP } from '../lib/money'
import { Icon, type IconName } from '../ui/Icon'
import { ThemeToggle } from '../ui/ThemeToggle'
import { Wordmark } from '../ui/Wordmark'
import { PLAN_PICK_KEY } from '../modules/suscripcion/api'

// Main site landing. One goal: an academy starts its free trial on a plan. Persuasion stays honest (see
// docs/landing.md): real prices and limits from the database, the real 14-day trial, no fake urgency, scarcity,
// testimonials or counters, no hidden costs and no shaming on the way out.

/** New owners get this many free days (see subscription_for_new_owner in the database). */
const TRIAL_DAYS = 14

type PublicPlan = { id: string; name: string; price_clp: number; period: string; max_schools: number | null; max_students: number | null }

async function fetchPlans(): Promise<PublicPlan[]> {
  const { data, error } = await supabase.rpc('public_plans')
  if (error) throw error
  return (data ?? []) as PublicPlan[]
}

const features: { icon: IconName; title: string; text: string }[] = [
  { icon: 'users', title: 'Alumnos y familias', text: 'Ficha completa con RUT, contacto de emergencia y notas médicas. Los apoderados ven y marcan la asistencia de sus hijos.' },
  { icon: 'qr', title: 'Asistencia con QR', text: 'El alumno escanea el código de la escuela o marca desde su celular desde 1 hora antes. Tú apruebas con un toque.' },
  { icon: 'calendar', title: 'Clases y calendario', text: 'Horarios semanales, profesor, sala y skills de cada clase. Cada sesión queda registrada con su número.' },
  { icon: 'wallet', title: 'Planes y pagos', text: 'Mensualidades, matrículas y packs en pesos. Comprobantes de transferencia, códigos de descuento y quién está por vencer.' },
  { icon: 'bank', title: 'Egresos y comisiones', text: 'Arriendo, cuentas y sueldos. Comisiones de profesores manuales o automáticas, por clase dictada o monto fijo.' },
  { icon: 'tag', title: 'Cinturones reales', text: 'Las artes marciales de tu escuela con sus cinturones, grados y franjas, y el historial de graduaciones de cada alumno.' },
  { icon: 'globe', title: 'Tu página pública', text: 'Una página para tu escuela con horarios y ubicación, donde agendan una clase de prueba y se registran solos.' },
  { icon: 'school', title: 'Varias escuelas, un equipo', text: 'Cada sede ve solo lo suyo. Administradores y equipo con permisos distintos, y verificación en dos pasos.' },
]

const included = [
  'Alumnos, apoderados y profesores',
  'Clases, calendario y asistencia con QR',
  'Planes, pagos y códigos de descuento',
  'Egresos y comisiones de profesores',
  'Portal del alumno: nivel, XP, skills y logros',
  'Página pública con clase de prueba',
  'Fotos de perfil y fichas completas',
  'Verificación en dos pasos',
]

const faqs: { q: string; a: string }[] = [
  { q: '¿Necesito tarjeta de crédito para probar?', a: `No. Creas tu cuenta y usas todo durante ${TRIAL_DAYS} días sin ingresar ningún medio de pago.` },
  { q: '¿Qué pasa cuando termina la prueba?', a: 'Eliges tu plan y pagas por transferencia desde Ajustes → Mi suscripción. Si decides no seguir, no se te cobra nada.' },
  { q: '¿Cómo se paga?', a: 'Por transferencia bancaria, en pesos chilenos, por período. Nos avisas desde la app y la confirmamos. Sin cargos automáticos.' },
  { q: '¿Hay permanencia o multa por salir?', a: 'No. Pagas período a período, sin contrato ni multa por dejar de usarlo.' },
  { q: '¿Mis alumnos pagan algo por usar la app?', a: 'No. Tus alumnos y sus apoderados entran gratis a su portal para marcar asistencia, ver su progreso y pagarte a ti.' },
  { q: '¿Mis datos están seguros?', a: 'Cada escuela ve solo sus datos, las fotos se guardan en privado y puedes activar la verificación en dos pasos. Los detalles están en la política de privacidad.' },
]

const perLabel = (period: string) => (period === 'anual' ? '/año' : '/mes')
const limit = (n: number | null, one: string, many: string, none: string) => (n == null ? none : `Hasta ${n.toLocaleString('es-CL')} ${n === 1 ? one : many}`)

export function Landing() {
  const year = new Date().getFullYear()
  const navigate = useNavigate()
  const plans = useQuery({ queryKey: ['public-plans'], queryFn: fetchPlans, staleTime: 10 * 60 * 1000 })
  const hero = useRef<HTMLElement>(null)
  const [pastHero, setPastHero] = useState(false)

  // Phones: once the hero's buttons scroll away, a slim bar keeps the trial one tap away.
  useEffect(() => {
    const el = hero.current
    if (!el || typeof IntersectionObserver === 'undefined') return
    const io = new IntersectionObserver(([e]) => setPastHero(!e.isIntersecting), { rootMargin: '-80px 0px 0px 0px' })
    io.observe(el)
    return () => io.disconnect()
  }, [])

  const pick = (id: string) => {
    try { localStorage.setItem(PLAN_PICK_KEY, id) } catch { /* storage blocked: Mi suscripción asks again */ }
    navigate('/registro')
  }
  const cheapest = plans.data?.[0]

  return (
    <div className="landing">
      <header className="landing__nav">
        <Wordmark />
        <nav className="landing__links" aria-label="Secciones">
          <a href="#funciones">Funciones</a>
          <a href="#planes">Planes</a>
          <a href="#preguntas">Preguntas</a>
        </nav>
        <div className="landing__nav-actions">
          <ThemeToggle />
          <Link className="btn btn--ghost landing__login" to="/login">Ingresar</Link>
          <Link className="btn" to="/registro">Prueba gratis</Link>
        </div>
      </header>

      <main>
        <section className="hero" ref={hero}>
          <div className="hero__copy">
            <h1 className="rise" style={{ animationDelay: '60ms' }}>Tu academia, en orden.</h1>
            <p className="hero__lead rise" style={{ animationDelay: '120ms' }}>
              El CRM para academias de artes marciales: alumnos, clases, asistencia con QR, pagos y comisiones en un solo lugar. Y un portal para que tus alumnos vean su nivel, sus skills y su progreso.
            </p>
            <div className="hero__actions rise" style={{ animationDelay: '180ms' }}>
              <Link className="btn btn--lg" to="/registro">Empieza tu prueba de {TRIAL_DAYS} días <Icon name="arrow" size={18} /></Link>
              <a className="btn btn--ghost btn--lg" href="#planes">Ver planes y precios</a>
            </div>
            <ul className="hero__assure rise" style={{ animationDelay: '240ms' }}>
              <li><Icon name="check" size={16} /> Sin tarjeta de crédito</li>
              <li><Icon name="check" size={16} /> {cheapest ? `Desde ${formatCLP(cheapest.price_clp)}${perLabel(cheapest.period)}` : 'Precios claros en pesos'}</li>
              <li><Icon name="check" size={16} /> Sin permanencia</li>
            </ul>
            <p className="hero__login">¿Ya tienes cuenta? <Link to="/login">Ingresa aquí</Link></p>
          </div>
          <HeroMock />
        </section>

        <section className="facts" aria-label="Hecho para academias en Chile">
          <p><Icon name="pin" size={18} /> Hecho en Chile, en pesos y con RUT</p>
          <p><Icon name="bank" size={18} /> Pagos por transferencia con comprobante</p>
          <p><Icon name="lock" size={18} /> Cada escuela ve solo sus datos</p>
          <p><Icon name="phone" size={18} /> Pensado para el celular</p>
        </section>

        <section className="lp-section" id="funciones" aria-labelledby="funciones-h">
          <header className="lp-head">
            <h2 id="funciones-h">Todo lo que tu academia hace, en una app.</h2>
            <p>De la primera clase de prueba al pago de la comisión del profesor.</p>
          </header>
          <div className="lp-features">
            {features.map((f) => (
              <article key={f.title} className="lp-feature">
                <span className="lp-feature__icon"><Icon name={f.icon} size={22} /></span>
                <h3>{f.title}</h3>
                <p>{f.text}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="lp-section lp-portal" aria-labelledby="portal-h">
          <div className="lp-portal__copy">
            <h2 id="portal-h">Tus alumnos vuelven por su progreso.</h2>
            <p>Cada alumno tiene su portal: marca su asistencia, sube de nivel con cada clase, ve cuánto entrena Gi y NoGi, sus cinturones y sus logros. Los apoderados siguen a sus hijos desde el mismo lugar.</p>
            <ul className="lp-checks">
              <li><Icon name="check" size={18} /> Nivel y experiencia por clase aprobada</li>
              <li><Icon name="check" size={18} /> Skills en porcentaje: Gi vs NoGi, guardia, derribos…</li>
              <li><Icon name="check" size={18} /> Perfil público para compartir su camino</li>
            </ul>
          </div>
          <PortalMock />
        </section>

        <section className="lp-section" id="planes" aria-labelledby="planes-h">
          <header className="lp-head lp-head--center">
            <h2 id="planes-h">Un precio claro. Todo incluido.</h2>
            <p>Prueba {TRIAL_DAYS} días gratis con todas las funciones. Después eliges tu plan.</p>
          </header>
          {plans.isLoading && <div className="plan-offers" aria-busy="true"><div className="plan-offer is-loading" /><div className="plan-offer is-loading" /></div>}
          {(plans.isError || plans.data?.length === 0) && (
            <div className="plan-offers">
              <article className="plan-offer">
                <h3>Prueba gratis</h3>
                <p className="plan-offer__price"><strong>{TRIAL_DAYS} días</strong></p>
                <p className="hint">Conoces los planes y precios al crear tu cuenta, antes de pagar nada.</p>
                <Link className="btn btn--lg" to="/registro">Empieza gratis</Link>
              </article>
            </div>
          )}
          {Boolean(plans.data?.length) && (
            <div className={`plan-offers${plans.data!.length === 1 ? ' plan-offers--one' : ''}`}>
              {plans.data!.map((p, i) => (
                <article key={p.id} className={`plan-offer${i === 0 ? ' is-featured' : ''}`}>
                  {i === 0 && <span className="plan-offer__badge">Con el que empieza tu prueba</span>}
                  <h3>{p.name}</h3>
                  <p className="plan-offer__price"><strong>{formatCLP(p.price_clp)}</strong><span>{perLabel(p.period)}</span></p>
                  <ul className="plan-offer__limits">
                    <li><Icon name="school" size={16} /> {limit(p.max_schools, 'escuela', 'escuelas', 'Escuelas ilimitadas')}</li>
                    <li><Icon name="users" size={16} /> {limit(p.max_students, 'alumno activo', 'alumnos activos', 'Alumnos ilimitados')}</li>
                    <li><Icon name="check" size={16} /> Todas las funciones</li>
                  </ul>
                  <button type="button" className={`btn btn--lg${i === 0 ? '' : ' btn--ghost'}`} onClick={() => pick(p.id)}>
                    Probar {TRIAL_DAYS} días gratis
                  </button>
                  <p className="plan-offer__fine">Sin tarjeta. Pagas por transferencia solo si te quedas.</p>
                </article>
              ))}
            </div>
          )}
          <div className="lp-included">
            <h3>Todos los planes incluyen</h3>
            <ul className="lp-checks lp-checks--cols">
              {included.map((x) => <li key={x}><Icon name="check" size={18} /> {x}</li>)}
            </ul>
          </div>
        </section>

        <section className="lp-section" aria-labelledby="pasos-h">
          <header className="lp-head">
            <h2 id="pasos-h">Funcionando hoy mismo.</h2>
          </header>
          <ol className="lp-steps">
            <li><b>1</b><h3>Crea tu cuenta</h3><p>Con tu correo, en un minuto. Empiezan tus {TRIAL_DAYS} días gratis.</p></li>
            <li><b>2</b><h3>Arma tu escuela</h3><p>Clases y horarios, planes y precios, cinturones y tu página pública.</p></li>
            <li><b>3</b><h3>Invita a tus alumnos</h3><p>Se registran desde tu página, tú los apruebas y empiezan a marcar asistencia.</p></li>
          </ol>
        </section>

        <section className="lp-section" id="preguntas" aria-labelledby="faq-h">
          <header className="lp-head">
            <h2 id="faq-h">Preguntas frecuentes</h2>
          </header>
          <div className="lp-faq">
            {faqs.map((f) => (
              <details key={f.q}>
                <summary>{f.q}<Icon name="down" size={18} /></summary>
                <p>{f.a}</p>
              </details>
            ))}
          </div>
        </section>

        <section className="closing">
          <h2>Ordena tu academia este mes.</h2>
          <p>Prueba todo gratis durante {TRIAL_DAYS} días. Sin tarjeta y sin permanencia.</p>
          <div className="closing__actions">
            <Link className="btn btn--lg" to="/registro">Empieza tu prueba gratis <Icon name="arrow" size={18} /></Link>
            <a className="btn btn--ghost btn--lg" href="#planes">Ver planes</a>
          </div>
          <p className="closing__login">¿Ya tienes cuenta? <Link to="/login">Ingresa aquí</Link></p>
        </section>
      </main>

      <footer className="landing__footer">
        <span>© {year} Martial CRM</span>
        <nav className="landing__legal"><Link to="/terminos">Términos y condiciones</Link> · <Link to="/privacidad">Política de privacidad</Link></nav>
      </footer>

      <div className={`lp-sticky${pastHero ? ' is-on' : ''}`} aria-hidden={!pastHero}>
        <span>{cheapest ? <>Desde <b>{formatCLP(cheapest.price_clp)}</b>{perLabel(cheapest.period)}</> : <>{TRIAL_DAYS} días gratis</>}</span>
        <Link className="btn" to="/registro" tabIndex={pastHero ? 0 : -1}>Prueba gratis</Link>
      </div>
    </div>
  )
}

/** Decorative: the staff app's month summary behind the student's phone (made with CSS, not real data). */
function HeroMock() {
  return (
    <div className="hero-mock" aria-hidden="true">
      <div className="hero-mock__desk">
        <div className="hm-bar"><i /><i /><i /></div>
        <div className="hm-kpis">
          <div><span>Recaudado</span><b>$1.840.000</b></div>
          <div><span>Por cobrar</span><b>$210.000</b></div>
          <div><span>Vigentes</span><b>86</b></div>
        </div>
        <div className="hm-rows">
          {[['Fundamentos', '19:00', '#3d7be0', 14], ['NoGi avanzado', '20:30', '#8a5cd6', 9], ['Kids', '18:00', '#3fb27f', 12]].map(([n, t, c, k]) => (
            <div key={n as string} style={{ ['--c' as string]: c as string }}><em>{t}</em><span>{n}</span><small>{k} alumnos</small></div>
          ))}
        </div>
      </div>
      <PortalMock small />
    </div>
  )
}

/** Decorative: the student portal on a phone (made with CSS, not real data). */
function PortalMock({ small = false }: { small?: boolean }) {
  return (
    <div className={`phone-mock${small ? ' phone-mock--small' : ''}`} aria-hidden="true">
      <div className="pm-hero"><span>Viernes</span><b>Hola, Camila</b><i className="pm-photo" /></div>
      <div className="pm-card pm-level"><div><span>Nivel</span><b>7</b></div><div className="pm-xp"><i style={{ width: '62%' }} /><small>74 / 120 XP</small></div></div>
      <div className="pm-card"><small>Gi vs NoGi</small><div className="pm-split"><i style={{ width: '58%' }} /><i /></div></div>
      <div className="pm-card pm-check"><div><b>Fundamentos</b><small>19:00 · Tatami 1</small></div><span>Marcar</span></div>
    </div>
  )
}
