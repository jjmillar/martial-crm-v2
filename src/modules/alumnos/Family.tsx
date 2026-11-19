import { useQuery } from '@tanstack/react-query'
import { Link } from '../../lib/nav'
import { supabase } from '../../lib/supabase'

// Staff view of the guardian relationship: "Apoderado: Carla Soto" on a child, "Apoderado de: Tomás" on a parent.
export function Family({ studentId, userId, schoolId }: { studentId: string; userId: string | null; schoolId: string }) {
  const q = useQuery({
    queryKey: ['family', studentId, userId],
    queryFn: async () => {
      const guardians = await supabase.from('student_guardians').select('guardian_id').eq('student_id', studentId)
      const gIds = (guardians.data ?? []).map((g) => g.guardian_id)
      const parents = gIds.length ? (await supabase.from('students').select('id, full_name').eq('school_id', schoolId).in('user_id', gIds)).data ?? [] : []
      const kidsIds = userId ? ((await supabase.from('student_guardians').select('student_id').eq('guardian_id', userId).eq('school_id', schoolId)).data ?? []).map((k) => k.student_id) : []
      const kids = kidsIds.length ? (await supabase.from('students').select('id, full_name').in('id', kidsIds).order('full_name')).data ?? [] : []
      return { parents, kids }
    },
  })
  const { parents = [], kids = [] } = q.data ?? {}
  if (!parents.length && !kids.length) return null
  const links = (xs: { id: string; full_name: string | null }[]) => xs.map((x, i) => <span key={x.id}>{i > 0 && ', '}<Link to={`/app/alumnos/${x.id}`}>{x.full_name}</Link></span>)
  return (
    <p className="hint family">
      {parents.length > 0 && <>Apoderado: {links(parents)}</>}
      {parents.length > 0 && kids.length > 0 && ' · '}
      {kids.length > 0 && <>Apoderado de: {links(kids)}</>}
    </p>
  )
}
