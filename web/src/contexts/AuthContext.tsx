/**
 * contexts/AuthContext.tsx — Global authentication state
 *
 * Provides session, role, loading state, and sign-out to the entire React tree
 * via a context. All route guards and role-based rendering read from this context.
 *
 * Design decisions:
 *   - The Supabase session (JWT) is stored in state and kept in sync with the
 *     Supabase auth listener, so the UI reacts to sign-in/out events even in
 *     other browser tabs.
 *   - The user's role is fetched from the `profiles` table (not from the JWT)
 *     so it can be changed in the DB without requiring users to re-login.
 *   - `loading` stays true until BOTH the session AND the role are resolved,
 *     which prevents a flash of unauthenticated UI on page refresh.
 *
 * Usage:
 *   const { session, role, loading, email, signOut } = useAuth()
 */

import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import type { UserRole } from '../types'

/** The shape of data exposed by AuthContext to all consumers. */
type AuthContextValue = {
  session: Session | null  // Null when the user is not signed in
  role: UserRole | null    // Null during initial load or when not signed in
  loading: boolean         // True until session + role are both resolved
  email: string            // Convenience shortcut to session.user.email
  signOut: () => void
}

// Initialised to null so `useAuth()` can detect if it's called outside a provider
const AuthContext = createContext<AuthContextValue | null>(null)

/**
 * Hook for consuming the auth context.
 * Throws an error rather than returning null so callers don't need to handle
 * the null case — it would only be null due to a programming mistake (missing provider).
 */
export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}

/** Wraps the app (or a subtree) and provides auth state to all descendants. */
export function AuthProvider({ children }: { children: React.ReactNode }) {
  // The Supabase session object; contains the JWT access_token used for API calls
  const [session, setSession] = useState<Session | null>(null)
  // The user's role from the profiles table; drives route guards and UI branching
  const [role, setRole] = useState<UserRole | null>(null)
  // Stays true until we've resolved both session and role (prevents auth flicker)
  const [loading, setLoading] = useState(true)

  /**
   * Queries the `profiles` table for the role of the given user.
   * Wrapped in useCallback so it can be referenced as a stable dependency in useEffect.
   * Falls back to 'trainee' if the profile row doesn't exist yet.
   */
  const fetchRole = useCallback(async (userId: string) => {
    const { data, error } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', userId)
      .single()
    if (error) console.error('fetchRole error:', error.message, error.code)
    setRole((data?.role as UserRole) ?? 'trainee')
    setLoading(false)
  }, [])

  useEffect(() => {
    // Check for an existing session on mount (e.g. page refresh with a stored session)
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      if (session) fetchRole(session.user.id)
      else setLoading(false)  // No session — done loading, show login
    })

    // Subscribe to future auth state changes (sign-in, sign-out, token refresh)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      if (session) fetchRole(session.user.id)
      else {
        setRole(null)
        setLoading(false)
      }
    })

    // Unsubscribe when the provider unmounts (rare but good practice)
    return () => subscription.unsubscribe()
  }, [fetchRole])

  /** Signs the user out via Supabase; the auth listener above will clear session/role. */
  const signOut = useCallback(() => {
    supabase.auth.signOut()
  }, [])

  // Derive email from session to avoid spreading the entire session object
  const email = session?.user?.email ?? ''

  const value: AuthContextValue = {
    session,
    role,
    loading,
    email,
    signOut,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
