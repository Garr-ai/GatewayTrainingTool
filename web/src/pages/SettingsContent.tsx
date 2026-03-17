import { useAuth } from '../contexts/AuthContext'

export function SettingsContent() {
  const { email, signOut } = useAuth()

  return (
    <>
      <header className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Settings</h2>
          <p className="mt-0.5 text-xs text-slate-500">App and account settings</p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <span className="text-[10px] font-semibold tracking-[0.16em] uppercase text-slate-500">Coordinator</span>
          <span className="text-xs text-slate-800">{email}</span>
          <button type="button" className="mt-1 rounded-md border border-slate-300 px-2 py-1 text-[11px] text-slate-700 hover:border-slate-400" onClick={signOut}>Sign out</button>
        </div>
      </header>
      <p className="text-sm text-slate-500">Settings page coming soon.</p>
    </>
  )
}
