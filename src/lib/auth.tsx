import React, { createContext, useContext, useEffect, useRef, useState } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { supabase } from './supabase'
import { loginEmail } from './loginEmail'
import type { Profile } from './database.types'

interface AuthContextType {
  session: Session | null
  user: User | null
  profile: Profile | null
  isCeo: boolean
  /** The platform operator account ("el CRM del CRM"): it never sees schools, only the platform console. */
  platform: Platform | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>
  signOut: () => Promise<void>
  sendPasswordReset: (email: string) => Promise<{ error: Error | null }>
  updatePassword: (password: string) => Promise<{ error: Error | null }>
  /** Re-reads the profile without toggling `loading` (so guarded pages stay mounted). */
  reloadProfile: () => Promise<void>
}

export type Platform = { username: string; verified: boolean }

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<Session | null>(null)
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [isCeo, setIsCeo] = useState<boolean>(false)
  const [platform, setPlatform] = useState<Platform | null>(null)
  const [loading, setLoading] = useState<boolean>(true)
  // Only a different user blocks the UI. Token refreshes (hourly) and USER_UPDATED (password change) refresh in
  // the background; otherwise RequireAuth would unmount the app and wipe any half-filled form.
  const loadedFor = useRef<string | null>(null)

  const fetchUserData = async (currentUserId: string | undefined) => {
    if (!currentUserId) {
      loadedFor.current = null
      setProfile(null)
      setIsCeo(false)
      setPlatform(null)
      setLoading(false)
      return
    }

    try {
      if (loadedFor.current !== currentUserId) setLoading(true)
      // CEO in the app = platform admin or a customer who owns schools (owners).
      const [profileRes, ceoRes, ownerRes, whoRes] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', currentUserId).single(),
        supabase.rpc('is_ceo'),
        supabase.rpc('is_owner'),
        supabase.rpc('platform_whoami'),
      ])
      const who = whoRes.data as { operator?: boolean; username?: string; verified?: boolean } | null
      setPlatform(who?.operator ? { username: who.username ?? '', verified: Boolean(who.verified) } : null)

      if (profileRes.data) {
        setProfile(profileRes.data)
      } else {
        setProfile(null)
      }

      setIsCeo(Boolean(ceoRes.data) || Boolean(ownerRes.data))
      loadedFor.current = currentUserId
    } catch {
      setProfile(null)
      setIsCeo(false)
      setPlatform(null)
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
        loadedFor.current = null
        setProfile(null)
        setIsCeo(false)
        setPlatform(null)
        setLoading(false)
      }
    })

    return () => {
      isMounted = false
      subscription.unsubscribe()
    }
  }, [])

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email: loginEmail(email), password })
    return { error: error ? new Error(error.message) : null }
  }

  const signOut = async () => {
    await supabase.auth.signOut()
    loadedFor.current = null
    setSession(null)
    setUser(null)
    setProfile(null)
    setIsCeo(false)
    setPlatform(null)
  }

  const sendPasswordReset = async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/bienvenida`
    })
    return { error: error ? new Error(error.message) : null }
  }

  const reloadProfile = async () => {
    if (!user?.id) return
    const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single()
    if (data) setProfile(data)
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
        platform,
        loading,
        signIn,
        signOut,
        sendPasswordReset,
        updatePassword,
        reloadProfile
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
