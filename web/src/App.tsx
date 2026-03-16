import { useState, useEffect } from 'react'
import type { Session } from '@supabase/supabase-js'
import './App.css'
import { supabase } from './lib/supabase'
import type { UserRole } from './types'
import { LoginForm } from './components/LoginForm'
import { InProgressPage } from './pages/InProgressPage'
import { CoordinatorPage } from './pages/CoordinatorPage'

function App() {
  const [session, setSession] = useState<Session | null>(null)
  const [role, setRole] = useState<UserRole | null>(null)
  const [appLoading, setAppLoading] = useState(true)

  // Supabase status widget state
  const [connStatus, setConnStatus] = useState<'idle' | 'checking' | 'ok' | 'error'>('idle')
  const [connMessage, setConnMessage] = useState('')

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      if (session) fetchRole(session.user.id)
      else setAppLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      if (session) fetchRole(session.user.id)
      else { setRole(null); setAppLoading(false) }
    })

    return () => subscription.unsubscribe()
  }, [])

  async function fetchRole(userId: string) {
    const { data, error } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', userId)
      .single()

    if (error) {
      console.error('fetchRole error:', error.message, error.code)
    }
    // If data is null (RLS blocking or row missing), default to trainee
    setRole((data?.role as UserRole) ?? 'trainee')
    setAppLoading(false)
  }

  function handleSignOut() {
    supabase.auth.signOut()
  }

  async function handleTestSupabase() {
    setConnStatus('checking')
    setConnMessage('')
    try {
      const { error } = await supabase.auth.getSession()
      if (error) throw error
      setConnStatus('ok')
      setConnMessage('Supabase connection OK')
    } catch (err) {
      setConnStatus('error')
      setConnMessage(err instanceof Error ? err.message : 'Failed to contact Supabase.')
    }
  }

  if (appLoading) {
    return (
      <div id="app-root">
        <p style={{ textAlign: 'center', color: 'var(--text)', marginTop: 80 }}>Loading…</p>
      </div>
    )
  }

  function renderMain() {
    if (!session) return <LoginForm />

    const email = session.user.email ?? ''

    if (role === 'coordinator') {
      return <CoordinatorPage email={email} onSignOut={handleSignOut} />
    }

    // trainer and trainee both see the in-progress page for now
    return <InProgressPage email={email} onSignOut={handleSignOut} />
  }

  return (
    <div id="app-root">
      <header>
        <h1>Gateway Training Tool</h1>
      </header>

      <main>
        {renderMain()}
      </main>

      {/* Dev tool: Supabase connection check */}
      <aside className="supabase-status" aria-label="Supabase status">
        <section className="card">
          <h2>Supabase status</h2>
          <p className="hint">Checks env vars and project connectivity.</p>
          <button
            type="button"
            className="primary"
            onClick={handleTestSupabase}
            disabled={connStatus === 'checking'}
          >
            {connStatus === 'checking' ? 'Checking…' : 'Test connection'}
          </button>
          {connStatus === 'ok' && <p className="result ok" role="status">{connMessage}</p>}
          {connStatus === 'error' && <p className="result error" role="status">{connMessage}</p>}
        </section>
      </aside>
    </div>
  )
}

export default App
