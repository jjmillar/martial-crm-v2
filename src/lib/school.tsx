import React, { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { supabase } from './supabase'
import { useAuth } from './auth'
import type { School, SchoolMember } from './database.types'

interface SchoolContextType {
  schools: School[]
  memberships: SchoolMember[]
  activeSchool: School | null
  role: 'ceo' | 'admin' | 'user' | null
  setActiveSchool: (id: string) => void
  loading: boolean
  reload: () => Promise<void>
}

const SchoolContext = createContext<SchoolContextType | undefined>(undefined)

const LOCAL_STORAGE_KEY = 'mcrm.activeSchool'

export const SchoolProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, isCeo } = useAuth()
  const [schools, setSchools] = useState<School[]>([])
  const [memberships, setMemberships] = useState<SchoolMember[]>([])
  const [activeSchoolId, setActiveSchoolId] = useState<string | null>(() => {
    try {
      return localStorage.getItem(LOCAL_STORAGE_KEY)
    } catch {
      return null
    }
  })
  const [loading, setLoading] = useState<boolean>(true)

  const reload = useCallback(async () => {
    if (!user) {
      setSchools([])
      setMemberships([])
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      const [schoolsRes, membershipsRes] = await Promise.all([
        supabase.from('schools').select('*').order('name'),
        supabase.from('school_members').select('*').eq('user_id', user.id)
      ])

      const fetchedSchools = schoolsRes.data || []
      const fetchedMemberships = membershipsRes.data || []

      setSchools(fetchedSchools)
      setMemberships(fetchedMemberships)

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
      setLoading(false)
    }
  }, [user])

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

  let role: 'ceo' | 'admin' | 'user' | null = null
  if (isCeo) {
    role = 'ceo'
  } else if (activeSchool) {
    const membership = memberships.find(m => m.school_id === activeSchool.id)
    role = membership?.role || null
  }

  return (
    <SchoolContext.Provider
      value={{
        schools,
        memberships,
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
