import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useSchool } from '../../lib/school'
import { enrollmentsKey, listEnrollments, phaseOf, type Phase } from './api'

export type EnrollFilter = 'vigentes' | 'por_vencer' | 'vencida' | 'pendiente' | 'pausada' | 'cancelada' | 'todas'
export const ENROLL_FILTERS: { id: EnrollFilter; label: string }[] = [
  { id: 'vigentes', label: 'Vigentes' },
  { id: 'por_vencer', label: 'Por vencer' },
  { id: 'vencida', label: 'Vencidas' },
  { id: 'pendiente', label: 'Por pagar' },
  { id: 'pausada', label: 'Pausadas' },
  { id: 'cancelada', label: 'Canceladas' },
  { id: 'todas', label: 'Todas' },
]
export const matches = (f: EnrollFilter, p: Phase) =>
  f === 'todas' || (f === 'vigentes' ? p === 'activa' || p === 'por_vencer' : f === p)

/** The school's enrollments with their phase (shared by the Contabilidad summary and its section). */
export function useSchoolEnrollments() {
  const { activeSchool } = useSchool()
  const schoolId = activeSchool?.id
  const q = useQuery({ queryKey: enrollmentsKey(schoolId), queryFn: () => listEnrollments(schoolId!), enabled: Boolean(schoolId) })
  const withPhase = useMemo(() => (q.data ?? []).map((e) => ({ ...e, phase: phaseOf(e) })), [q.data])
  return { q, withPhase }
}

export const countPhase = (rows: { phase: Phase }[], f: EnrollFilter) => rows.filter((e) => matches(f, e.phase)).length
