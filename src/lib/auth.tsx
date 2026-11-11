import React, { createContext, useContext, useEffect, useState } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { supabase } from './supabase'
import type { Profile } from './database.types'

interface AuthContextType {
  session: Session | null
  user: User | null
  profile: Profile | null
  isCeo: boolean
  loading: boolean
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>
  signOut: () => Promise<void>
  sendPasswordReset: (email: string) => Promise<{ error: Error | null }>
  updatePassword: (password: string) => Promise<{ error: Error | null }>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<Session | null>(null)
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [isCeo, setIsCeo] = useState<boolean>(false)
  const [loading, setLoading] = useState<boolean>(true)

  const fetchUserData = async (currentUserId: string | undefined) => {
    if (!currentUserId) {
      setProfile(null)
      setIsCeo(false)
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      const [profileRes, ceoRes] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', currentUserId).single(),
        supabase.rpc('is_ceo')
      ])

      if (profileRes.data) {
        setProfile(profileRes.data)
      } else {
        setProfile(null)
      }

      setIsCeo(Boolean(ceoRes.data))
    } catch {
      setProfile(null)
      setIsCeo(false)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    let isMounted = true

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!isMounted) return
      setSession(session)
      setUser(session?.user ?? null)
      if (session?.user) {
        fetchUserData(session.user.id)
      } else {
        setLoading(false)
      }
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!isMounted) return
      setSession(session)
      setUser(session?.user ?? null)
      if (session?.user) {
        // Supabase warns against awaiting other supabase calls inside this callback (it can deadlock),
        // so the profile/CEO lookup is deferred to the next tick.
        const id = session.user.id
        setTimeout(() => fetchUserData(id), 0)
      } else {
        setProfile(null)
        setIsCeo(false)
        setLoading(false)
      }
    })

    return () => {
      isMounted = false
      subscription.unsubscribe()
    }
  }, [])

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    return { error: error ? new Error(error.message) : null }
  }

  const signOut = async () => {
    await supabase.auth.signOut()
    setSession(null)
    setUser(null)
    setProfile(null)
    setIsCeo(false)
  }

  const sendPasswordReset = async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/bienvenida`
    })
    return { error: error ? new Error(error.message) : null }
  }

  const updatePassword = async (password: string) => {
    const { error } = await supabase.auth.updateUser({ password })
    return { error: error ? new Error(error.message) : null }
  }

  return (
    <AuthContext.Provider
      value={{
        session,
        user,
        profile,
        isCeo,
        loading,
        signIn,
        signOut,
        sendPasswordReset,
        updatePassword
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth debe ser usado dentro de un AuthProvider')
  }
  return context
}
