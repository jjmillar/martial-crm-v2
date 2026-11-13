import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../../lib/auth'
import { useSchool } from '../../lib/school'
import { Acc } from '../../ui/Accordion'
import { openFromHash } from '../../ui/openFromHash'
import { Icon } from '../../ui/Icon'
import { CuentaSections } from '../cuenta/CuentaPage'
import { listEmailLog, sendTemplate } from './api'
import { Agendamiento } from './Agendamiento'
import { Catalogo } from './Catalogo'
import { EscuelaPerfil } from './EscuelaPerfil'
import { LandingSettings } from './LandingSettings'
import { Exportar } from './Exportar'
import './ajustes.css'

const dateFmt = new Intl.DateTimeFormat('es-CL', { dateStyle: 'medium', timeStyle: 'short' })

// Every block is a closed accordion. School settings for CEO/admin; "Mi cuenta" for everyone.
export function AjustesPage() {
  const { activeSchool, role } = useSchool()
  const location = useLocation()
  const manages = Boolean(activeSchool) && (role === 'ceo' || role === 'admin')
  useEffect(() => {
    const t = setTimeout(() => openFromHash(location.hash), 50)
    return () => clearTimeout(t)
  }, [location.hash])

  return (
    <div className="ajustes">
      <header className="page-head">
        <span className="eyebrow">{manages ? activeSchool!.name : 'Configuración'}</span>
        <h1>Ajustes</h1>
        <p className="hint">{manages ? 'Toca una sección para abrirla.' : 'Tu perfil, contraseña y apariencia.'}</p>
      </header>
      {manages && <SchoolSections />}
      <CuentaSections />
    </div>
  )
}

function SchoolSections() {
  const { activeSchool } = useSchool()
  const school = activeSchool!
  return (
    <>
      <h2 className="acc-group">Escuela</h2>
      <Acc id="escuela" icon="school" title="Datos de la escuela" hint="Nombre, logo, contacto y matrícula">
        <EscuelaPerfil key={school.id} school={school} embedded />
      </Acc>
      <Acc id="landing" icon="globe" title="Landing page" hint="Página pública, colores y fotos">
        <LandingSettings key={`landing-${school.id}`} school={school} />
      </Acc>
      <Acc id="agendamiento" icon="calendar" title="Agendamiento" hint="Clases de prueba gratis desde la landing">
        <Agendamiento key={`agenda-${school.id}`} school={school} />
      </Acc>
      <Acc id="catalogos" icon="plan" title="Catálogos" hint="Especialidades y etiquetas de clase">
        <p className="hint">Listas que usa toda la escuela. Desactivar oculta un elemento de las opciones sin borrar su historial.</p>
        <div className="catalog-grid">
          <Catalogo table="specialties" schoolId={school.id} canEdit title="Especialidades" description="Disciplinas que enseñan los profesores." placeholder="Ej: Jiu-jitsu brasileño" />
          <Catalogo table="tags" schoolId={school.id} canEdit withIcon title="Etiquetas de clase (skills)" description="Clasifican las clases y son las skills de los alumnos: cada asistencia confirmada suma XP a las etiquetas de esa clase." placeholder="Ej: Guardia, Derribos" />
        </div>
      </Acc>
      <Acc id="exportar" icon="share" title="Exportar datos" hint="Archivos CSV para Excel o Sheets">
        <Exportar schoolId={school.id} schoolName={school.name} />
      </Acc>
      <Acc id="correos" icon="mail" title="Correos" hint="Correo de prueba e historial de envíos">
        <Correos schoolId={school.id} />
      </Acc>
    </>
  )
}

function Correos({ schoolId }: { schoolId: string }) {
  const { user } = useAuth()
  const qc = useQueryClient()
  const key = ['email_log', schoolId]
  const [notice, setNotice] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const log = useQuery({ queryKey: key, queryFn: () => listEmailLog(schoolId) })
  const test = useMutation({
    mutationFn: () => sendTemplate('test', schoolId),
    onMutate: () => { setNotice(null); setError(null) },
    onSuccess: () => setNotice(`Enviado a ${user?.email}. Revisa tu bandeja (y spam).`),
    onError: (e: Error) => setError(e.message),
    onSettled: () => qc.invalidateQueries({ queryKey: key }),
  })

  return (
    <>
      <div className="ajustes__section-head">
        <p className="hint">Invitaciones, avisos de pago e informativos salen desde Martial CRM. Envíate uno de prueba para revisar cómo llega.</p>
        <button className="btn" type="button" onClick={() => test.mutate()} disabled={test.isPending}>
          <Icon name="mail" size={16} /> {test.isPending ? 'Enviando…' : 'Enviarme un correo de prueba'}
        </button>
      </div>
      {notice && <p className="alert alert--ok" role="status">{notice}</p>}
      {error && <p className="alert" role="alert">{error}</p>}

      <h3 className="ajustes__sub">Últimos envíos</h3>
      {log.isLoading && <p className="hint">Cargando…</p>}
      {log.isError && <p className="alert">No se pudo cargar el historial.</p>}
      {log.data?.length === 0 && <p className="hint">Todavía no se ha enviado ningún correo desde esta escuela.</p>}
      {Boolean(log.data?.length) && (
        <ul className="email-log">
          {log.data!.map((r) => (
            <li key={r.id} className="email-log__row">
              <span className={`status-dot status-dot--${r.status}`} aria-hidden="true" />
              <div className="email-log__main">
                <strong>{r.subject}</strong>
                <span className="hint">{r.to_email} · {dateFmt.format(new Date(r.created_at))}</span>
              </div>
              <span className={`tag tag--${r.status}`}>{r.status === 'sent' ? 'Enviado' : 'Falló'}</span>
            </li>
          ))}
        </ul>
      )}
    </>
  )
}
