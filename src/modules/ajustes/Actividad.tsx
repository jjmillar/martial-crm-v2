import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { formatCLP } from '../../lib/money'

// Audit log (CEO only): who changed the bank data, payment statuses, team roles, or deleted students.
// Written only by database triggers; nobody can edit or erase it from the app.
type Row = { id: number; at: string; actor: string | null; action: string; details: Record<string, unknown> }

const fmt = new Intl.DateTimeFormat('es-CL', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'America/Santiago' })
const statusEs: Record<string, string> = { pendiente: 'pendiente', pagado: 'pagado', fallido: 'fallido', reembolsado: 'reembolsado' }
const roleEs: Record<string, string> = { admin: 'Administrador', user: 'Usuario' }

function describe(r: Row): string {
  const d = r.details as Record<string, never>
  switch (r.action) {
    case 'transfer_data_changed': {
      const b = (d.before ?? {}) as Record<string, string | null>, a = (d.after ?? {}) as Record<string, string | null>
      return `Cambió los datos bancarios: ${b.bank ?? '—'} ${b.number ?? ''} → ${a.bank ?? '—'} ${a.number ?? ''}`
    }
    case 'payment_changed': {
      const [s0, s1] = (d.status ?? []) as string[], [a0, a1] = (d.amount ?? []) as number[]
      const parts = [s0 !== s1 && `estado ${statusEs[s0] ?? s0} → ${statusEs[s1] ?? s1}`, a0 !== a1 && `monto ${formatCLP(a0)} → ${formatCLP(a1)}`].filter(Boolean)
      return `Pago "${d.concept ?? ''}": ${parts.join(', ')}`
    }
    case 'payment_deleted': return `Eliminó el pago "${d.concept ?? ''}" (${formatCLP(Number(d.amount ?? 0))})`
    case 'member_added': return `Agregó a un miembro del equipo como ${roleEs[d.role as string] ?? d.role}`
    case 'member_removed': return 'Quitó a un miembro del equipo'
    case 'member_role_changed': { const [r0, r1] = (d.role ?? []) as string[]; return `Cambió un rol: ${roleEs[r0] ?? r0} → ${roleEs[r1] ?? r1}` }
    case 'student_deleted': return `Eliminó al alumno ${d.name ?? ''}`
    default: return r.action
  }
}

export function Actividad({ schoolId }: { schoolId: string }) {
  const log = useQuery({
    queryKey: ['audit-log', schoolId],
    queryFn: async () => {
      const { data, error } = await supabase.from('audit_log').select('id, at, actor, action, details').eq('school_id', schoolId).order('at', { ascending: false }).limit(100)
      if (error) throw error
      const rows = data as Row[]
      const ids = [...new Set(rows.map((r) => r.actor).filter(Boolean))] as string[]
      const { data: people } = ids.length ? await supabase.from('profiles').select('id, full_name, email').in('id', ids) : { data: [] }
      const name = new Map((people ?? []).map((p) => [p.id, p.full_name || p.email || 'Usuario']))
      return rows.map((r) => ({ ...r, who: r.actor ? name.get(r.actor) ?? 'Usuario' : 'Sistema' }))
    },
  })
  return (
    <>
      <p className="hint">Cambios sensibles de esta escuela: datos bancarios, estados de pago, roles del equipo y alumnos eliminados. Nadie puede editar ni borrar este registro.</p>
      {log.isLoading && <p className="hint">Cargando…</p>}
      {log.isError && <p className="alert">No se pudo cargar el registro.</p>}
      {log.data?.length === 0 && <p className="hint">Todavía no hay actividad registrada.</p>}
      {Boolean(log.data?.length) && (
        <ul className="email-log">
          {log.data!.map((r) => (
            <li key={r.id} className="email-log__row">
              <div className="email-log__main">
                <strong>{describe(r)}</strong>
                <span className="hint">{r.who} · {fmt.format(new Date(r.at))}</span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  )
}
