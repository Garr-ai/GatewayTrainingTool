/**
 * layouts/ProtectedLayout.tsx — Authenticated shell layout
 *
 * This component is the parent route element for all authenticated pages (`/`).
 * It enforces authentication and renders the appropriate shell layout depending
 * on the user's role:
 *
 *   - Coordinators get the full dark sidebar (CoordinatorLayout) with a mobile
 *     top bar and a hamburger menu button.
 *   - Trainers and trainees get a minimal header-only layout (their dashboard
 *     content is rendered by DashboardView → InProgressPage).
 *
 * Loading states:
 *   - While `loading` is true (session + role not yet resolved), a spinner
 *     placeholder is shown to prevent a flash of the login page.
 *   - If loading completes with no session, redirect to /login.
 *
 * `Outlet` (from React Router) renders the matched child route inside the layout.
 */

import { useState } from 'react'
import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { CoordinatorLayout } from '../components/CoordinatorLayout'

export function ProtectedLayout() {
  const { session, role, loading } = useAuth()
  // Controls the mobile slide-in navigation drawer on small screens
  const [mobileNavOpen, setMobileNavOpen] = useState(false)

  // While auth state is resolving, show a loading screen rather than flashing
  // an incorrect UI (e.g. briefly showing the login page to an authenticated user)
  if (loading || role === null) {
    // Edge case: if loading finished but there's no session, go to login immediately
    if (!session && !loading) {
      return <Navigate to="/login" replace />
    }
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-100 text-slate-500 text-sm">
        Loading…
      </div>
    )
  }

  // Auth resolved but no session — redirect to login
  if (!session) {
    return <Navigate to="/login" replace />
  }

  // Coordinator layout: dark sidebar + content area
  if (role === 'coordinator') {
    return (
      <div className="min-h-screen w-screen flex bg-slate-900">
        {/* Mobile top bar — only visible on small screens (md:hidden) */}
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

        {/* Sidebar navigation — slides in on mobile, always visible on desktop */}
        <CoordinatorLayout
          mobileOpen={mobileNavOpen}
          onMobileClose={() => setMobileNavOpen(false)}
        />

        {/* Main content area — Outlet renders the active child route */}
        <section className="flex-1 bg-slate-100 px-4 md:px-6 py-5 flex flex-col gap-4 min-h-screen overflow-auto pt-16 md:pt-5">
          <Outlet />
        </section>
      </div>
    )
  }

  // Non-coordinator layout (trainer / trainee): simple header + centered content
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
