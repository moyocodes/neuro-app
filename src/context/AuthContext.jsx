import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

async function recordLogin(userId) {
  await Promise.all([
    supabase
      .from('profiles')
      .update({ last_login_at: new Date().toISOString() })
      .eq('id', userId),
    supabase.from('login_events').insert({
      user_id: userId,
      user_agent: navigator.userAgent,
    }),
  ])
}

async function fetchProfile(userId) {
  const { data } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single()
  return data
}

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      setUser(session?.user ?? null)
      setProfile(session?.user ? await fetchProfile(session.user.id) : null)
      setLoading(false)
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setUser(session?.user ?? null)
      setProfile(session?.user ? await fetchProfile(session.user.id) : null)
    })

    return () => subscription.unsubscribe()
  }, [])

  const login = async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })
    if (error) throw error
    await recordLogin(data.user.id)
    setProfile(await fetchProfile(data.user.id))
    return data
  }

  const signup = async (name, email, password) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { name } },
    })
    if (error) throw error
    // handle_new_user trigger creates the profiles row; poll briefly since
    // the trigger runs asynchronously relative to this response.
    let newProfile = null
    for (let attempt = 0; attempt < 5 && !newProfile; attempt++) {
      newProfile = await fetchProfile(data.user.id)
      if (!newProfile) await new Promise((r) => setTimeout(r, 300))
    }
    await recordLogin(data.user.id)
    setProfile(newProfile)
    return data
  }

  const logout = () => supabase.auth.signOut()

  return (
    <AuthContext.Provider
      value={{ user, profile, loading, login, signup, logout }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
