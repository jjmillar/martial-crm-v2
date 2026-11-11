import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../../lib/auth'
import { useSchool } from '../../lib/school'
import { Icon } from '../../ui/Icon'
import { listEmailLog, sendTemplate } from './api'
import { Catalogo } from './Catalogo'
import './ajustes.css'

const dateFmt = new Intl.DateTimeFormat('es-CL', { dateStyle: 'medium', timeStyle: 'short' })

export function AjustesPage() {
  const { activeSchool } = useSchool()
  const { user } = useAuth()
  const qc = useQueryClient()
  const schoolId = activeSchool?.id
  const key = ['email_log', schoolId]
  const [notice, setNotice] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const log = useQuery({ queryKey: key, queryFn: () => listEmailLog(schoolId!), enabled: Boolean(schoolId) })

  const test = useMutation({
    mutationFn: () => sendTemplate('test', schoolId!),
    onMutate: () => {
      setNotice(null)
      setError(null)
    },
    onSuccess: () => setNotice(`Enviado a ${user?.email}. Revisa tu bandeja (y spam).`),
    onError: (e: Error) => setError(e.message),
    onSettled: () => qc.invalidateQueries({ queryKey: key }),
  })

  if (!activeSchool) return <p className="page-note">Selecciona una escuela para ver sus ajustes.</p>

  return (
    <div className="ajustes">
      <header className="page-head">
        <span className="eyebrow">{activeSchool.name}</span>
        <h1>Ajustes</h1>
        <p className="hint">Configuración de la escuela. Irán apareciendo más secciones aquí.</p>
      </header>

      <section className="card ajustes__section" aria-labelledby="catalogos-h">
        <div className="ajustes__section-head">
          <div>
            <h2 id="catalogos-h">Catálogos</h2>
            <p className="hint">Listas que usa toda la escuela. Desactivar oculta un elemento de las opciones sin borrar su historial.</p>
          </div>
        </div>
        <div className="catalog-grid">
          <Catalogo table="specialties" schoolId={activeSchool.id} canEdit title="Especialidades" description="Disciplinas que enseñan los profesores." placeholder="Ej: Jiu-jitsu brasileño" />
          <Catalogo table="tags" schoolId={activeSchool.id} canEdit withIcon title="Etiquetas de clase" description="Para clasificar clases: niños, competición, principiantes…" placeholder="Ej: Niños" />
        </div>
      </section>

      <section className="card ajustes__section" aria-labelledby="correos-h">
        <div className="ajustes__section-head">
          <div>
            <h2 id="correos-h">Correos</h2>
            <p className="hint">Invitaciones, avisos de pago e informativos salen desde Martial CRM. Envíate uno de prueba para revisar cómo llega.</p>
          </div>
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
      </section>
    </div>
  )
}
