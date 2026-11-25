'use client'
import { useEffect } from 'react'
import { useNavigate } from '@/lib/nav'
import { useSchool } from '@/lib/school'

// Plans are a section of Contabilidad (staff) and of "Pagos y planes" (students); old links land there.
export default function Page() {
  const { role } = useSchool()
  const navigate = useNavigate()
  useEffect(() => {
    if (role) navigate(role === 'alumno' ? '/app/pagos#planes' : '/app/contabilidad#planes', { replace: true })
  }, [role, navigate])
  return null
}
