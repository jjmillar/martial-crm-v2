import { useQuery } from '@tanstack/react-query'
import { useSchool } from '../../lib/school'
import { listTeachers, teachersKey } from '../profesores/api'
import { expensesKey, listExpenses, listRules, rulesKey } from './api'

/** Expenses, rules and teachers of the active school (admins only; the queries stay off for anyone else). */
export function useEgresos() {
  const { activeSchool, role } = useSchool()
  const schoolId = activeSchool?.id
  const enabled = Boolean(schoolId) && (role === 'admin' || role === 'ceo')
  const expenses = useQuery({ queryKey: expensesKey(schoolId), queryFn: () => listExpenses(schoolId!), enabled })
  const rules = useQuery({ queryKey: rulesKey(schoolId), queryFn: () => listRules(schoolId!), enabled })
  const teachers = useQuery({ queryKey: teachersKey(schoolId), queryFn: () => listTeachers(schoolId!), enabled })
  return { schoolId, expenses, rules, teachers }
}
