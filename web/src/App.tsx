import { useState, useEffect } from 'react'
import type { Session } from '@supabase/supabase-js'
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

  function renderMain() {
    if (!session) return <LoginForm />

    const email = session.user.email ?? ''

    if (role === 'coordinator') {
      return <CoordinatorPage email={email} onSignOut={handleSignOut} />
    }

    // trainer and trainee both see the in-progress page for now
    return <InProgressPage email={email} onSignOut={handleSignOut} />
  }

  // Wait for role when logged in so we don't flash InProgress before Coordinator
  const waitingForRole = session !== null && role === null
  const showLoading = appLoading || waitingForRole

  // Coordinator gets full-screen layout (no header/main chrome)
  if (!showLoading && session && role === 'coordinator') {
    return (
      <>
        <div className="h-screen w-screen flex flex-col overflow-hidden bg-slate-100">
          {renderMain()}
        </div>
        <aside
          aria-label="Supabase status"
          className="fixed bottom-4 right-4 w-72 rounded-xl border border-slate-200 bg-white shadow-lg p-4 text-sm z-10"
        >
          <h2 className="font-medium text-slate-900 mb-1">Supabase status</h2>
          <p className="text-xs text-slate-500 mb-2">Checks env vars and project connectivity.</p>
          <button
            type="button"
            onClick={handleTestSupabase}
            disabled={connStatus === 'checking'}
            className="inline-flex items-center rounded-md border border-slate-300 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-800 hover:bg-slate-100 disabled:opacity-60"
          >
            {connStatus === 'checking' ? 'Checking…' : 'Test connection'}
          </button>
          {connStatus === 'ok' && (
            <p className="mt-2 text-xs text-emerald-600" role="status">{connMessage}</p>
          )}
          {connStatus === 'error' && (
            <p className="mt-2 text-xs text-rose-600" role="status">{connMessage}</p>
          )}
        </aside>
      </>
    )
  }

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col">
      <header className="px-6 py-4 border-b border-slate-200 bg-white">
        <h1 className="text-lg font-semibold text-slate-900">Gateway Training Tool</h1>
      </header>

      <main className="flex-1 flex items-start justify-center px-4 py-10">
        {showLoading ? (
          <div className="flex items-center justify-center w-full text-slate-500 text-sm">
            Loading…
          </div>
        ) : (
          renderMain()
        )}
      </main>

      {/* Dev tool: Supabase connection check */}
      <aside
        aria-label="Supabase status"
        className="fixed bottom-4 right-4 w-72 rounded-xl border border-slate-200 bg-white shadow-lg p-4 text-sm"
      >
        <h2 className="font-medium text-slate-900 mb-1">Supabase status</h2>
        <p className="text-xs text-slate-500 mb-2">Checks env vars and project connectivity.</p>
        <button
          type="button"
          onClick={handleTestSupabase}
          disabled={connStatus === 'checking'}
          className="inline-flex items-center rounded-md border border-slate-300 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-800 hover:bg-slate-100 disabled:opacity-60"
        >
          {connStatus === 'checking' ? 'Checking…' : 'Test connection'}
        </button>
        {connStatus === 'ok' && (
          <p className="mt-2 text-xs text-emerald-600" role="status">
            {connMessage}
          </p>
        )}
        {connStatus === 'error' && (
          <p className="mt-2 text-xs text-rose-600" role="status">
            {connMessage}
          </p>
        )}
      </aside>
    </div>
  )
}

export default App
