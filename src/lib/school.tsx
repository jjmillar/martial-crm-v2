import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react'
import { supabase } from './supabase'
import { useAuth } from './auth'
import type { School, SchoolMember } from './database.types'
import type { AppRole } from '../modules/types'

// The signed-in user's own student records (student portal), one per school at most.
export type StudentLink = { id: string; school_id: string; full_name: string | null }

interface SchoolContextType {
  schools: School[]
  memberships: SchoolMember[]
  studentLinks: StudentLink[]
  /** The student record of the signed-in user in the active school (student portal), if any. */
  myStudent: StudentLink | null
  activeSchool: School | null
  role: AppRole | null
  setActiveSchool: (id: string) => void
  loading: boolean
  reload: () => Promise<void>
}

const SchoolContext = createContext<SchoolContextType | undefined>(undefined)

const LOCAL_STORAGE_KEY = 'mcrm.activeSchool'

export const SchoolProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, isCeo } = useAuth()
  // Depend on the id, not the object: token refreshes replace the user object.
  const userId = user?.id ?? null
  const [schools, setSchools] = useState<School[]>([])
  const [memberships, setMemberships] = useState<SchoolMember[]>([])
  const [studentLinks, setStudentLinks] = useState<StudentLink[]>([])
  const [activeSchoolId, setActiveSchoolId] = useState<string | null>(() => {
    try {
      return localStorage.getItem(LOCAL_STORAGE_KEY)
    } catch {
      return null
    }
  })
  const [loading, setLoading] = useState<boolean>(true)
  // Only the first load for a user blocks the UI; later reloads refresh in the background so pages stay mounted.
  const loadedFor = useRef<string | null>(null)

  const reload = useCallback(async () => {
    if (!userId) {
      setSchools([])
      setMemberships([])
      setStudentLinks([])
      setLoading(false)
      return
    }

    try {
      if (loadedFor.current !== userId) setLoading(true)
      const [schoolsRes, membershipsRes, studentsRes] = await Promise.all([
        supabase.from('schools').select('*').order('name'),
        supabase.from('school_members').select('*').eq('user_id', userId),
        supabase.from('students').select('id, school_id, full_name').eq('user_id', userId).eq('active', true),
      ])

      const fetchedSchools = schoolsRes.data || []
      const fetchedMemberships = membershipsRes.data || []

      setSchools(fetchedSchools)
      setMemberships(fetchedMemberships)
      setStudentLinks(studentsRes.data || [])

      setActiveSchoolId((currentId) => {
        let storedId = currentId
        try {
          storedId = localStorage.getItem(LOCAL_STORAGE_KEY)
        } catch {
          // ignore
        }

        if (storedId && fetchedSchools.some(s => s.id === storedId)) {
          return storedId
        }

        if (fetchedSchools.length > 0) {
          const firstId = fetchedSchools[0].id
          try {
            localStorage.setItem(LOCAL_STORAGE_KEY, firstId)
          } catch {
            // ignore
          }
          return firstId
        }

        try {
          localStorage.removeItem(LOCAL_STORAGE_KEY)
        } catch {
          // ignore
        }
        return null
      })
    } catch {
      setSchools([])
      setMemberships([])
    } finally {
      loadedFor.current = userId
      setLoading(false)
    }
  }, [userId])

  useEffect(() => {
    reload()
  }, [reload])

  const setActiveSchool = (id: string) => {
    setActiveSchoolId(id)
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY, id)
    } catch {
      // ignore
    }
  }

  const activeSchool = schools.find(s => s.id === activeSchoolId) || schools[0] || null

  const myStudent = (activeSchool && studentLinks.find((s) => s.school_id === activeSchool.id)) || null
  // Staff role wins: a member who is also a student uses the staff app in that school.
  let role: AppRole | null = null
  if (isCeo) {
    role = 'ceo'
  } else if (activeSchool) {
    const membership = memberships.find(m => m.school_id === activeSchool.id)
    role = membership?.role || (myStudent ? 'alumno' : null)
  }

  return (
    <SchoolContext.Provider
      value={{
        schools,
        memberships,
        studentLinks,
        myStudent,
        activeSchool,
        role,
        setActiveSchool,
        loading,
        reload
      }}
    >
      {children}
    </SchoolContext.Provider>
  )
}

export const useSchool = () => {
  const context = useContext(SchoolContext)
  if (!context) {
    throw new Error('useSchool debe ser usado dentro de un SchoolProvider')
  }
  return context
}
