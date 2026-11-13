import { Link } from 'react-router-dom'
import { Icon } from '../ui/Icon'
import { ThemeToggle } from '../ui/ThemeToggle'
import { Wordmark } from '../ui/Wordmark'
import './landing.css'

const week = ['L', 'M', 'M', 'J', 'V', 'S', 'D']
// Decorative attendance pattern for the illustration tile (not real data).
const attendance = [1, 1, 0, 1, 1, 1, 0, 1, 1, 1, 1, 0, 1, 1, 1, 0, 1, 1, 1, 1, 1]

export function Landing() {
  const year = new Date().getFullYear()

  return (
    <div className="landing">
      <header className="landing__nav">
        <Wordmark />
        <div className="landing__nav-actions">
          <ThemeToggle />
          <Link className="btn" to="/login">Ingresar</Link>
        </div>
      </header>

      <main>
        <section className="hero">
          <span className="eyebrow rise">CRM para academias de artes marciales</span>
          <h1 className="rise" style={{ animationDelay: '60ms' }}>Tu academia, en orden.</h1>
          <p className="hero__lead rise" style={{ animationDelay: '120ms' }}>
            Alumnos, clases, asistencia y pagos de cada escuela en un solo lugar, con acceso separado para administradores y equipo.
          </p>
          <div className="hero__actions rise" style={{ animationDelay: '180ms' }}>
            <Link className="btn" to="/login">
              Ingresar a mi cuenta <Icon name="arrow" size={16} />
            </Link>
            <a className="btn btn--ghost" href="#como-funciona">Cómo funciona</a>
          </div>
        </section>

        <section className="features" aria-label="Qué incluye">
          <article className="feature feature--wide">
            <div className="feature__copy">
              <span className="eyebrow">Alumnos</span>
              <h2>Cada alumno con su ficha completa.</h2>
              <p>Datos de contacto, RUT, cinturón y grado, contacto de emergencia y notas médicas.</p>
            </div>
            <div className="mock mock--profile" aria-hidden="true">
              <div className="mock__avatar" />
              <div className="mock__lines">
                <span style={{ width: '70%' }} />
                <span style={{ width: '45%' }} />
              </div>
              <div className="mock__belt"><i /><i /><i /></div>
            </div>
          </article>

          <article className="feature">
            <span className="eyebrow">Clases y calendario</span>
            <h2>Horarios semanales.</h2>
            <div className="mock mock--week" aria-hidden="true">
              {week.map((d, i) => (
                <div key={i} className="mock__day">
                  <b>{d}</b>
                  {i % 2 === 0 && <span />}
                  {i < 5 && <span className="alt" />}
                </div>
              ))}
            </div>
          </article>

          <article className="feature">
            <span className="eyebrow">Asistencia</span>
            <h2>Quién vino a cada clase.</h2>
            <div className="mock mock--dots" aria-hidden="true">
              {attendance.map((v, i) => <span key={i} className={v ? 'on' : ''} />)}
            </div>
          </article>

          <article className="feature">
            <span className="eyebrow">Planes y pagos</span>
            <h2>Mensualidades al día.</h2>
            <div className="mock mock--rows" aria-hidden="true">
              <div><span /><em className="ok">Pagado</em></div>
              <div><span /><em className="ok">Pagado</em></div>
              <div><span /><em>Pendiente</em></div>
            </div>
          </article>

          <article className="feature">
            <span className="eyebrow">Varias escuelas</span>
            <h2>Cada escuela ve solo lo suyo.</h2>
            <p>Los datos de una academia quedan aislados de las demás.</p>
          </article>
        </section>

        <section className="steps" id="como-funciona">
          <header>
            <span className="eyebrow">Cómo funciona</span>
            <h2>Tres tipos de cuenta.</h2>
          </header>
          <ol>
            <li>
              <b>CEO</b>
              <p>Crea su cuenta, da de alta sus escuelas, publica su página y aprueba a los alumnos que se registran.</p>
            </li>
            <li>
              <b>Administrador</b>
              <p>Gestiona su escuela completa: alumnos, planes, pagos y su equipo.</p>
            </li>
            <li>
              <b>Usuario</b>
              <p>Trabaja el día a día: clases, asistencia y fichas de alumnos.</p>
            </li>
          </ol>
        </section>

        <section className="closing">
          <h2>¿Tienes una academia?</h2>
          <p>Crea tu cuenta de CEO y empieza hoy. Tus alumnos se registran desde la página de tu escuela.</p>
          <div className="closing__actions">
            <Link className="btn" to="/registro">Crear cuenta de academia</Link>
            <Link className="btn btn--ghost" to="/login">Ingresar</Link>
          </div>
        </section>
      </main>

      <footer className="landing__footer">
        <span>© {year} Martial CRM</span>
      </footer>
    </div>
  )
}
