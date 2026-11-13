import { useQuery } from '@tanstack/react-query'
import { useAuth } from '../../lib/auth'
import { useSchool } from '../../lib/school'
import { supabase } from '../../lib/supabase'

// Signed-in account with no school role yet: usually a student whose self-signup is waiting for approval.
export function PendingSignup() {
  const { profile, user, signOut } = useAuth()
  const { reload } = useSchool()
  const q = useQuery({
    queryKey: ['my-signup', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase.from('student_signups').select('status, created_at').order('created_at', { ascending: false }).limit(1)
      if (error) throw error
      return data[0] ?? null
    },
    enabled: Boolean(user),
  })
  const first = (profile?.full_name ?? '').split(' ')[0]
  const s = q.data?.status

  return (
    <div className="bento">
      <section className="tile tile--hero tile--full rise">
        <span className="eyebrow">{s === 'pendiente' ? 'Registro en revisión' : s === 'rechazada' ? 'Registro no aprobado' : 'Sin acceso todavía'}</span>
        <h1>Hola{first ? `, ${first}` : ''}.</h1>
        <p className="tile__lead">
          {s === 'pendiente' && 'Tu escuela está revisando tu registro. Cuando lo apruebe vas a ver aquí tu nivel, tus skills y las clases para marcar asistencia.'}
          {s === 'rechazada' && 'Tu escuela no aprobó el registro. Si crees que es un error, habla con ellos.'}
          {!s && q.isSuccess && 'Tu cuenta todavía no está asociada a ninguna escuela. Pide acceso a tu escuela.'}
        </p>
        <div className="form-actions">
          {s === 'pendiente' && <button type="button" className="btn" onClick={() => { void reload(); void q.refetch() }}>Revisar de nuevo</button>}
          <button type="button" className="btn btn--ghost" onClick={signOut}>Cerrar sesión</button>
        </div>
      </section>
    </div>
  )
}
