import { useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useLocation } from '../../lib/nav'
import { useSchool } from '../../lib/school'
import { Acc } from '../../ui/Accordion'
import { openFromHash } from '../../ui/openFromHash'
import { StaffAttendance } from '../asistencia/AsistenciaPage'
import { ClasesList } from '../clases/ClasesList'
import { classesKey, listClasses } from '../clases/api'
import { EscuelasSection } from './EscuelasPage'

// Escuelas: the school in one place, one accordion each (like Miembros). Escuelas (CEO only: create and edit their
// schools), Asistencia (take attendance by day, week or month) and Clases (the classes and their weekly schedule).
// Old links (/app/asistencia, /app/clases, Ajustes → Escuelas) land here, on the right accordion.
export function EscuelasHub() {
  const { activeSchool, role, schools } = useSchool()
  const location = useLocation()
  const schoolId = activeSchool?.id
  const classes = useQuery({ queryKey: classesKey(schoolId), queryFn: () => listClasses(schoolId!), enabled: Boolean(schoolId) })
  useEffect(() => {
    const t = setTimeout(() => openFromHash(location.hash), 50)
    return () => clearTimeout(t)
  }, [location.hash])

  const ceo = role === 'ceo'
  const active = classes.data?.filter((c) => c.active)
  const blocks = active?.reduce((n, c) => n + c.schedules.length, 0)

  return (
    <div className="miembros escuelas-hub">
      <header className="page-head">
        <h1>Escuelas</h1>
        <p className="hint">{activeSchool ? 'Toca una sección para abrirla.' : ceo ? 'Crea tu primera escuela para empezar.' : 'Selecciona una escuela.'}</p>
      </header>

      {/* A CEO without schools yet: the create form right away, nothing else to open. */}
      {!activeSchool && ceo && <EscuelasSection />}

      {activeSchool && (
        <div className="miembros__sections">
          {ceo && (
            <Acc id="escuelas" icon="school" title="Escuelas" hint={`${schools.length} ${schools.length === 1 ? 'escuela' : 'escuelas'} · crear y editar`}>
              <EscuelasSection />
            </Acc>
          )}
          <Acc id="asistencia" icon="check" title="Asistencia" hint="Toma la asistencia por día, semana o mes">
            <StaffAttendance />
          </Acc>
          <Acc id="clases" icon="clock" title="Clases"
            hint={active ? `${active.length} ${active.length === 1 ? 'clase activa' : 'clases activas'} · ${blocks} ${blocks === 1 ? 'horario' : 'horarios'} por semana` : 'Cargando…'}>
            <ClasesList />
          </Acc>
        </div>
      )}
    </div>
  )
}
