import { useQuery } from '@tanstack/react-query'
import { useAuth } from '../../lib/auth'
import { useSchool } from '../../lib/school'
import { supabase } from '../../lib/supabase'

// Signed-in account with no role yet: usually someone who signed up and is waiting for approval.
export function PendingSignup() {
  const { profile, user, signOut } = useAuth()
  const { reload } = useSchool()
  const q = useQuery({
    queryKey: ['my-request', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase.from('account_requests').select('status, kind, created_at').order('created_at', { ascending: false }).limit(1)
      if (error) throw error
      return data[0] ?? null
    },
    enabled: Boolean(user),
  })
  // A school whose Martial CRM subscription is suspended or cancelled is closed for everyone: say so plainly.
  const blocked = useQuery({
    queryKey: ['my-blocked-schools', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('my_blocked_schools')
      if (error) throw error
      return data ?? []
    },
    enabled: Boolean(user),
  })
  const first = (profile?.full_name ?? '').split(' ')[0]
  const closed = blocked.data ?? []
  if (closed.length > 0) {
    const names = closed.map((b) => b.name).join(', ')
    const cancelled = closed.every((b) => b.status === 'cancelada')
    return (
      <div className="bento">
        <section className="tile tile--hero tile--full rise">
          <span className="eyebrow">{cancelled ? 'Suscripción cancelada' : 'Suscripción suspendida'}</span>
          <h1>Hola{first ? `, ${first}` : ''}.</h1>
          <p className="tile__lead">
            El acceso a {names} está pausado porque la suscripción a Martial CRM {cancelled ? 'fue cancelada' : 'está suspendida'}. Tus datos siguen guardados: cuando se reactive, todo vuelve a estar como lo dejaste.
          </p>
          <p className="hint">Si eres el dueño de la escuela, escríbenos para reactivarla. Si eres alumno o parte del equipo, avisa a tu escuela.</p>
          <div className="form-actions">
            <button type="button" className="btn" onClick={() => { void reload(); void blocked.refetch() }}>Revisar de nuevo</button>
            <button type="button" className="btn btn--ghost" onClick={signOut}>Cerrar sesión</button>
          </div>
        </section>
      </div>
    )
  }
  const s = q.data?.status
  const asStudent = q.data?.kind === 'alumno'

  return (
    <div className="bento">
      <section className="tile tile--hero tile--full rise">
        <span className="eyebrow">{s === 'pendiente' ? 'Cuenta en revisión' : s === 'rechazada' ? 'Solicitud no aprobada' : 'Sin acceso todavía'}</span>
        <h1>Hola{first ? `, ${first}` : ''}.</h1>
        <p className="tile__lead">
          {s === 'pendiente' && (asStudent
            ? 'Tu cuenta de alumno está esperando aprobación. Cuando la aprueben vas a poder completar tu perfil, ver tu nivel y marcar asistencia.'
            : 'Tu cuenta de miembro del equipo está esperando aprobación. Cuando la aprueben vas a ver la escuela aquí.')}
          {s === 'rechazada' && 'Tu solicitud no fue aprobada. Si crees que es un error, habla con tu escuela.'}
          {s === 'aprobada' && 'Tu solicitud fue aprobada. Toca "Revisar de nuevo" para entrar.'}
          {!s && q.isSuccess && 'Tu cuenta todavía no está asociada a ninguna escuela.'}
        </p>
        <div className="form-actions">
          {s !== 'rechazada' && <button type="button" className="btn" onClick={() => { void reload(); void q.refetch() }}>Revisar de nuevo</button>}
          <button type="button" className="btn btn--ghost" onClick={signOut}>Cerrar sesión</button>
        </div>
      </section>
    </div>
  )
}
