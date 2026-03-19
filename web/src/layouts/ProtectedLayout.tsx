import { useState } from 'react'
import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { CoordinatorLayout } from '../components/CoordinatorLayout'

export function ProtectedLayout() {
  const { session, role, loading } = useAuth()
  const [mobileNavOpen, setMobileNavOpen] = useState(false)

  if (loading || role === null) {
    if (!session && !loading) {
      return <Navigate to="/login" replace />
    }
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-100 text-slate-500 text-sm">
        Loading…
      </div>
    )
  }

  if (!session) {
    return <Navigate to="/login" replace />
  }

  if (role === 'coordinator') {
    return (
      <div className="min-h-screen w-screen flex bg-slate-900">
        {/* Mobile top bar */}
        <div className="fixed top-0 left-0 right-0 z-30 flex items-center justify-between bg-slate-900 px-4 py-3 md:hidden">
          <span className="text-xs font-semibold tracking-[0.2em] uppercase text-slate-200">
            Gateway
          </span>
          <button
            type="button"
            onClick={() => setMobileNavOpen(true)}
            className="text-slate-200 p-1"
            aria-label="Open menu"
          >
            <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
        </div>

        <CoordinatorLayout
          mobileOpen={mobileNavOpen}
          onMobileClose={() => setMobileNavOpen(false)}
        />

        <section className="flex-1 bg-slate-100 px-4 md:px-6 py-5 flex flex-col gap-4 min-h-screen overflow-auto pt-16 md:pt-5">
          <Outlet />
        </section>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col">
      <header className="px-6 py-4 border-b border-slate-200 bg-white">
        <h1 className="text-lg font-semibold text-slate-900">Gateway Training Tool</h1>
      </header>
      <main className="flex-1 flex items-start justify-center px-4 py-10">
        <Outlet />
      </main>
    </div>
  )
}
