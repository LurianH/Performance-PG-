import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { hasSupabaseConfiguration } from '../../config/env'
import { supabase } from '../../lib/supabase'
import type { ProfileRow } from '../../types/database.types'
import { AuthContext, type AuthContextValue } from './AuthContext'

async function loadProfile(userId: string): Promise<ProfileRow | null> {
  if (!supabase) return null
  const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).single()
  if (error) return null
  return data as ProfileRow
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<ProfileRow | null>(null)
  const [loading, setLoading] = useState(hasSupabaseConfiguration)

  useEffect(() => {
    if (!supabase) return
    let active = true

    void supabase.auth.getSession().then(async ({ data }) => {
      if (!active) return
      setSession(data.session)
      setUser(data.session?.user ?? null)
      setProfile(data.session?.user ? await loadProfile(data.session.user.id) : null)
      setLoading(false)
    })

    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!active) return
      setSession(nextSession)
      setUser(nextSession?.user ?? null)
      void (async () => {
        setProfile(nextSession?.user ? await loadProfile(nextSession.user.id) : null)
        setLoading(false)
      })()
    })

    return () => {
      active = false
      listener.subscription.unsubscribe()
    }
  }, [])

  const signIn = useCallback(async (email: string, password: string) => {
    if (!supabase) return 'Supabase não está configurado neste ambiente.'
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    return error?.message ?? null
  }, [])

  const signOut = useCallback(async () => {
    if (supabase) await supabase.auth.signOut()
  }, [])

  const value = useMemo<AuthContextValue>(() => ({
    session,
    user,
    profile,
    role: profile?.active ? profile.role : null,
    loading,
    isMockMode: !hasSupabaseConfiguration,
    signIn,
    signOut,
  }), [loading, profile, session, signIn, signOut, user])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
