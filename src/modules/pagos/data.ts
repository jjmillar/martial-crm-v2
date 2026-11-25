import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { useSchool } from '../../lib/school'
import { santiagoDate, todayIso } from '../../lib/dates'
import type { PaymentStatus } from '../../lib/database.types'
import { latestSubmissions, submissionsKey } from '../pagar/api'
import { listPayments, paymentsKey, type PaymentRow } from './api'

export type PayFilter = PaymentStatus | 'todos'

/** The school's payments (shared by the Contabilidad summary and its sections; React Query dedupes). */
export function useSchoolPayments() {
  const { activeSchool, role } = useSchool()
  const schoolId = activeSchool?.id
  const isAdmin = role === 'admin' || role === 'ceo'
  // Admins: make sure due enrollment fees exist before listing (the daily job does the same; this is idempotent).
  const fees = useQuery({
    queryKey: ['enrollment-fees-run', schoolId],
    queryFn: async () => { const { error } = await supabase.rpc('generate_enrollment_fees', { p_school_id: schoolId! }); return !error },
    enabled: Boolean(schoolId) && isAdmin && Boolean(activeSchool?.enrollment_fee),
    staleTime: 10 * 60_000,
  })
  const feesReady = !isAdmin || !activeSchool?.enrollment_fee || fees.isFetched
  const q = useQuery({ queryKey: paymentsKey(schoolId), queryFn: () => listPayments(schoolId!), enabled: Boolean(schoolId) && feesReady })
  // Transfers students reported from the payment gateway, waiting for the CEO.
  const subs = useQuery({ queryKey: submissionsKey(`school:${schoolId}`), queryFn: () => latestSubmissions({ schoolId }), enabled: Boolean(schoolId) })
  return { q, subs }
}

/** This month's collected total and what is still pending, for the summary. */
export function paymentStats(all: PaymentRow[]) {
  const thisMonth = todayIso().slice(0, 7)
  const paidMonth = all.filter((p) => p.status === 'pagado' && p.paid_at && santiagoDate(p.paid_at).slice(0, 7) === thisMonth)
  const pending = all.filter((p) => p.status === 'pendiente')
  return {
    collected: paidMonth.reduce((a, p) => a + p.amount, 0),
    collectedCount: paidMonth.length,
    pending: pending.reduce((a, p) => a + p.amount, 0),
    pendingCount: pending.length,
  }
}
