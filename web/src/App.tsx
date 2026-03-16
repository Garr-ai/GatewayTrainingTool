import { useState, useEffect } from 'react'
import type { Session } from '@supabase/supabase-js'
import './App.css'
import { supabase } from './lib/supabase'
import { LoginForm } from './components/LoginForm'

function App() {
  const [session, setSession] = useState<Session | null>(null)
  const [appLoading, setAppLoading] = useState(true)

  // Supabase status widget state
  const [connStatus, setConnStatus] = useState<'idle' | 'checking' | 'ok' | 'error'>('idle')
  const [connMessage, setConnMessage] = useState('')

  useEffect(() => {
    // Load initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setAppLoading(false)
    })

    // React to sign-in / sign-out / token refresh
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
    })

    return () => subscription.unsubscribe()
  }, [])

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

  return (
    <div id="app-root">
      <header>
        <h1>Gateway Training Tool</h1>
      </header>

      <main>
        {session ? (
          <div className="login-card" style={{ textAlign: 'center', gap: 16 }}>
            <h2>Welcome</h2>
            <p style={{ color: 'var(--text)', fontSize: 14 }}>{session.user.email}</p>
            <button
              type="button"
              className="btn-submit"
              onClick={() => supabase.auth.signOut()}
            >
              Sign out
            </button>
          </div>
        ) : (
          <LoginForm />
        )}
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
