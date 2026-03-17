import { useState } from 'react'
import { supabase } from '../lib/supabase'

export function SupabaseStatusWidget() {
  const [connStatus, setConnStatus] = useState<'idle' | 'checking' | 'ok' | 'error'>('idle')
  const [connMessage, setConnMessage] = useState('')

  async function handleTest() {
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

  return (
    <aside
      aria-label="Supabase status"
      className="fixed bottom-4 right-4 w-72 rounded-xl border border-slate-200 bg-white shadow-lg p-4 text-sm z-10"
    >
      <h2 className="font-medium text-slate-900 mb-1">Supabase status</h2>
      <p className="text-xs text-slate-500 mb-2">Checks env vars and project connectivity.</p>
      <button
        type="button"
        onClick={handleTest}
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
  )
}
