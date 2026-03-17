import { useState } from 'react'
import { ClassesPage } from './ClassesPage'

type CoordinatorView = 'dashboard' | 'classes' | 'settings'

interface CoordinatorPageProps {
  email: string
  onSignOut: () => void
}

export function CoordinatorPage({ email, onSignOut }: CoordinatorPageProps) {
  const [view, setView] = useState<CoordinatorView>('dashboard')

  return (
    <div className="flex w-full h-full min-h-0 flex-1 overflow-hidden bg-slate-900">
      <aside className="w-56 bg-gradient-to-b from-slate-900 to-slate-800 text-slate-100 px-4 py-5 flex flex-col gap-6">
        <div className="text-xs font-semibold tracking-[0.2em] uppercase text-slate-200">
          Gateway
        </div>
        <nav className="flex flex-col gap-1" aria-label="Main navigation">
          <button
            className={`w-full rounded-lg px-3 py-2 text-left text-sm ${view === 'dashboard' ? 'bg-slate-700/70' : 'hover:bg-slate-700/40'}`}
            type="button"
            onClick={() => setView('dashboard')}
          >
            Dashboard
          </button>
          <button
            className={`w-full rounded-lg px-3 py-2 text-left text-sm ${view === 'classes' ? 'bg-slate-700/70' : 'hover:bg-slate-700/40'}`}
            type="button"
            onClick={() => setView('classes')}
          >
            Classes
          </button>
          <button
            className={`w-full rounded-lg px-3 py-2 text-left text-sm ${view === 'settings' ? 'bg-slate-700/70' : 'hover:bg-slate-700/40'}`}
            type="button"
            onClick={() => setView('settings')}
          >
            Settings
          </button>
        </nav>
      </aside>

      <section className="flex-1 bg-slate-100 px-6 py-5 flex flex-col gap-4 min-h-0 overflow-hidden">
        {view === 'classes' ? (
          <ClassesPage email={email} onSignOut={onSignOut} />
        ) : view === 'settings' ? (
          <>
            <header className="flex items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">Settings</h2>
                <p className="mt-0.5 text-xs text-slate-500">App and account settings</p>
              </div>
              <div className="flex flex-col items-end gap-1">
                <span className="text-[10px] font-semibold tracking-[0.16em] uppercase text-slate-500">Coordinator</span>
                <span className="text-xs text-slate-800">{email}</span>
                <button type="button" className="mt-1 rounded-md border border-slate-300 px-2 py-1 text-[11px] text-slate-700 hover:border-slate-400" onClick={onSignOut}>Sign out</button>
              </div>
            </header>
            <p className="text-sm text-slate-500">Settings page coming soon.</p>
          </>
        ) : (
          <>
            <header className="flex items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">Dashboard</h2>
                <p className="mt-0.5 text-xs text-slate-500">Coordinator overview</p>
              </div>
              <div className="flex items-center gap-3">
                <input
                  type="search"
                  className="hidden sm:block rounded-full border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 min-w-[220px]"
                  placeholder="Search students or classes..."
                />
                <div className="flex flex-col items-end gap-1">
                  <span className="text-[10px] font-semibold tracking-[0.16em] uppercase text-slate-500">Coordinator</span>
                  <span className="text-xs text-slate-800">{email}</span>
                  <button type="button" className="mt-1 inline-flex items-center rounded-md border border-slate-300 px-2 py-1 text-[11px] text-slate-700 hover:border-slate-400" onClick={onSignOut}>Sign out</button>
                </div>
              </div>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <section className="rounded-xl bg-white p-4 shadow-sm min-h-[110px]">
                <h3 className="text-sm font-semibold text-slate-900 mb-1">Today&apos;s classes</h3>
                <p className="text-xs text-slate-500">No classes scheduled yet.</p>
              </section>
              <section className="rounded-xl bg-white p-4 shadow-sm min-h-[110px]">
                <h3 className="text-sm font-semibold text-slate-900 mb-1">Attendance alerts</h3>
                <p className="text-xs text-slate-500">Attendance alerts will appear here.</p>
              </section>
              <section className="rounded-xl bg-white p-4 shadow-sm min-h-[110px]">
                <h3 className="text-sm font-semibold text-slate-900 mb-1">Pending sign-offs</h3>
                <p className="text-xs text-slate-500">Upcoming competency and graduation reviews.</p>
              </section>
            </div>

            <section className="mt-2 rounded-xl bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between mb-1">
                <h3 className="text-sm font-semibold text-slate-900">Active classes</h3>
                <button type="button" className="text-xs font-medium text-indigo-600 hover:underline" onClick={() => setView('classes')}>View all</button>
              </div>
              <p className="text-xs text-slate-500">Active class details will appear here.</p>
            </section>

            <section className="mt-2 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4">
              <p className="text-xs text-slate-500">Additional dashboard modules will be added here.</p>
            </section>
          </>
        )}
      </section>
    </div>
  )
}
