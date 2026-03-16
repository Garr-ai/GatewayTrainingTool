import { useState } from 'react'
import './App.css'
import { supabase } from './lib/supabase'

function App() {
  const [status, setStatus] = useState<'idle' | 'checking' | 'ok' | 'error'>(
    'idle',
  )
  const [message, setMessage] = useState('')

  async function handleTestSupabase() {
    setStatus('checking')
    setMessage('')
    try {
      const { error } = await supabase.auth.getSession()
      if (error) throw error
      setStatus('ok')
      setMessage('Supabase connection OK (auth.getSession)')
    } catch (err) {
      setStatus('error')
      setMessage(
        err instanceof Error ? err.message : 'Failed to contact Supabase.',
      )
    }
  }

  return (
    <div id="app-root">
      <header>
        <h1>Gateway Training Tool</h1>
        <p>Internal training platform prototype</p>
      </header>

      <main>{/* Main app content will go here later */}</main>

      <aside className="supabase-status" aria-label="Supabase status">
        <section className="card">
          <h2>Supabase status</h2>
          <p className="hint">
            Checks that your env vars and project are set up correctly.
          </p>
          <button
            type="button"
            className="primary"
            onClick={handleTestSupabase}
            disabled={status === 'checking'}
          >
            {status === 'checking' ? 'Checking…' : 'Test Supabase connection'}
          </button>
          {status === 'ok' && (
            <p className="result ok" role="status">
              {message}
            </p>
          )}
          {status === 'error' && (
            <p className="result error" role="status">
              {message}
            </p>
          )}
        </section>
      </aside>
    </div>
  )
}

export default App
