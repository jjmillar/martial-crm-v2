import { Link } from 'react-router-dom'
import { Wordmark } from '../ui/Wordmark'
import { SignupForm } from './SignupForm'
import './auth.css'

// /registro — main site: a customer creates a CEO account, then creates their schools.
// Students sign up from their school's landing page (/e/<slug>), never here.
export function Registro() {
  return (
    <div className="auth">
      <header className="auth__nav">
        <Wordmark />
        <Link className="link-btn" to="/login">Iniciar sesión</Link>
      </header>
      <main className="auth__main">
        <SignupForm
          kind="ceo"
          loginTo="/login"
          head={
            <>
              <span className="eyebrow">Para academias</span>
              <h1>Crea tu cuenta de CEO</h1>
              <p className="hint">Administra una o varias escuelas: alumnos, clases, asistencia, pagos y una página pública para cada una. ¿Eres alumno? Regístrate desde la página de tu escuela.</p>
            </>
          }
        />
      </main>
    </div>
  )
}
