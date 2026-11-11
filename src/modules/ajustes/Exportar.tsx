import { useState } from 'react'
import { supabase } from '../../lib/supabase'
import { downloadCsv, toCsv } from '../../lib/csv'
import { formatDate, santiagoDate, todayIso } from '../../lib/dates'
import { formatRut } from '../../lib/rut'
import { slugify } from '../../lib/slug'
import { listStudents } from '../alumnos/api'
import { listEnrollments, phaseLabel, phaseOf } from '../matriculas/api'
import { listPayments, methodLabel, statusLabel } from '../pagos/api'

type Kind = 'alumnos' | 'matriculas' | 'pagos' | 'asistencia'

// Data export (S6): CSV files that open directly in Excel (es-CL).
export function Exportar({ schoolId, schoolName }: { schoolId: string; schoolName: string }) {
  const [busy, setBusy] = useState<Kind | null>(null)
  const [error, setError] = useState<string | null>(null)
  const file = (k: Kind) => `${slugify(schoolName) || 'escuela'}-${k}-${todayIso()}.csv`

  async function run(kind: Kind) {
    setBusy(kind)
    setError(null)
    try {
      if (kind === 'alumnos') {
        const rows = await listStudents(schoolId)
        downloadCsv(file(kind), toCsv(
          ['Nombre', 'RUT', 'Género', 'Nacimiento', 'Inscripción', 'Correo', 'Teléfono', 'Dirección', 'Cinturón', 'Grado', 'Peso kg', 'Contacto emergencia', 'Teléfono emergencia', 'Notas médicas', 'Notas', 'Activo'],
          rows.map((s) => [s.full_name, formatRut(s.rut), s.gender, formatDate(s.birth_date), formatDate(s.enrollment_date), s.email, s.phone, s.address, s.belt, s.belt_degree, s.weight_kg?.toString().replace('.', ','), s.emergency_contact, s.emergency_phone, s.medical_notes, s.notes, s.active]),
        ))
      } else if (kind === 'matriculas') {
        const rows = await listEnrollments(schoolId)
        downloadCsv(file(kind), toCsv(
          ['Alumno', 'Plan', 'Estado', 'Inicio', 'Vencimiento', 'Precio', 'Matrícula', 'Notas'],
          rows.map((e) => [e.student?.full_name, e.plan?.name, phaseLabel[phaseOf(e)], formatDate(e.start_date), formatDate(e.ends_at), e.price, e.enrollment_fee, e.notes]),
        ))
      } else if (kind === 'pagos') {
        const rows = await listPayments(schoolId)
        downloadCsv(file(kind), toCsv(
          ['Alumno', 'Concepto', 'Monto', 'Medio', 'Estado', 'Registrado', 'Pagado', 'Vence', 'Comprobante', 'Notas'],
          rows.map((p) => [p.student?.full_name, p.concept, p.amount, methodLabel[p.method], statusLabel[p.status], formatDate(santiagoDate(p.created_at)), p.paid_at ? formatDate(santiagoDate(p.paid_at)) : '', formatDate(p.due_date), Boolean(p.receipt_path), p.notes]),
        ))
      } else {
        const { data, error: e } = await supabase
          .from('attendance')
          .select('date, class:classes(name), student:students(full_name)')
          .eq('school_id', schoolId)
          .order('date', { ascending: false })
          .limit(20000)
        if (e) throw e
        const rows = data as unknown as { date: string; class: { name: string } | null; student: { full_name: string | null } | null }[]
        downloadCsv(file(kind), toCsv(['Fecha', 'Clase', 'Alumno'], rows.map((r) => [formatDate(r.date), r.class?.name, r.student?.full_name])))
      }
    } catch {
      setError('No se pudo generar el archivo. Intenta de nuevo.')
    } finally {
      setBusy(null)
    }
  }

  const items: { k: Kind; label: string }[] = [
    { k: 'alumnos', label: 'Alumnos' },
    { k: 'matriculas', label: 'Matrículas' },
    { k: 'pagos', label: 'Pagos' },
    { k: 'asistencia', label: 'Asistencia' },
  ]

  return (
    <section className="card ajustes__section" aria-labelledby="export-h">
      <div>
        <h2 id="export-h">Exportar datos</h2>
        <p className="hint">Descarga archivos CSV que se abren directo en Excel o Google Sheets.</p>
      </div>
      <div className="form-actions">
        {items.map((i) => (
          <button key={i.k} type="button" className="btn btn--ghost" disabled={busy !== null} onClick={() => run(i.k)}>
            {busy === i.k ? 'Generando…' : i.label}
          </button>
        ))}
      </div>
      {error && <p className="alert" role="alert">{error}</p>}
    </section>
  )
}
