import { useState } from 'react'
import { Navigate, NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { CoordinatorLayout } from '../components/CoordinatorLayout'
import { TrainerLayout, TRAINER_NAV_ITEMS } from '../components/TrainerLayout'

const navIcon = (d: string) => (
  <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
    <path d={d} />
  </svg>
)

const BOTTOM_NAV = [
  { to: '/dashboard', label: 'Dashboard', icon: navIcon('M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2V9z') },
  { to: '/classes',   label: 'Classes',   icon: navIcon('M4 19.5A2.5 2.5 0 016.5 17H20M4 19.5A2.5 2.5 0 004 17V5a2 2 0 012-2h14a2 2 0 012 2v12a2.5 2.5 0 01-2.5 2.5H4z') },
  { to: '/schedule',  label: 'Schedule',  icon: navIcon('M19 4H5a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2V6a2 2 0 00-2-2zM16 2v4M8 2v4M3 10h18') },
  { to: '/reports',   label: 'Reports',   icon: navIcon('M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8zM14 2v6h6M16 13H8M16 17H8M10 9H8') },
]

const MORE_ITEMS = [
  { to: '/students',        label: 'Students',        icon: navIcon('M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4-4v2M9 11a4 4 0 100-8 4 4 0 000 8zM23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75') },
  { to: '/trainers',        label: 'Trainers',        icon: navIcon('M16 21v-2a4 4 0 00-4-4H5a4 4 0 00-4-4v2M8.5 11a4 4 0 100-8 4 4 0 000 8zM20 8v6M23 11h-6') },
  { to: '/settings',        label: 'Settings',        icon: navIcon('M12 15a3 3 0 100-6 3 3 0 000 6zM19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 01-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z') },
]

export function ProtectedLayout() {
  const { session, role, loading, email, signOut } = useAuth()
  const [moreOpen, setMoreOpen] = useState(false)

  const initials = email ? email.slice(0, 2).toUpperCase() : 'CO'

  if (loading || role === null) {
    if (!session && !loading) {
      return <Navigate to="/login" replace />
    }
    return (
      <div className="min-h-screen flex items-center justify-center bg-gw-darkest text-slate-500 text-sm">
        Loading…
      </div>
    )
  }

  if (!session) {
    return <Navigate to="/login" replace />
  }

  // Coordinator layout: icon sidebar (desktop) + bottom nav (mobile)
  if (role === 'coordinator') {
    return (
      <div className="min-h-screen w-screen bg-gw-darkest">
        {/* Desktop icon sidebar — hidden on mobile */}
        <CoordinatorLayout />

        {/* Mobile top bar */}
        <div className="fixed top-0 left-0 right-0 z-30 flex items-center justify-between h-14 bg-gw-darkest border-b border-white/[0.06] px-4 md:hidden">
          <div className="w-8 h-8 rounded-[10px] bg-gradient-to-br from-gw-blue to-gw-teal flex items-center justify-center shrink-0">
            <span className="text-white font-bold text-sm leading-none select-none">G</span>
          </div>
          <div className="w-8 h-8 rounded-full bg-gw-blue/20 border border-gw-blue/30 flex items-center justify-center select-none">
            <span className="text-xs font-semibold text-gw-blue">{initials}</span>
          </div>
        </div>

        {/* Main content area */}
        <section className="md:ml-16 pt-14 md:pt-4 pb-20 md:pb-6 min-h-screen px-4 md:px-6 flex flex-col gap-4 overflow-auto">
          <Outlet />
        </section>

        {/* Mobile bottom nav */}
        <nav
          className="fixed bottom-0 left-0 right-0 z-30 flex items-center justify-around h-16 bg-gw-surface border-t border-white/[0.06] md:hidden"
          aria-label="Mobile navigation"
        >
          {BOTTOM_NAV.map(({ to, label, icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `flex flex-col items-center gap-0.5 px-3 py-1 transition-colors duration-100 ${
                  isActive ? 'text-gw-blue' : 'text-slate-500'
                }`
              }
            >
              {icon}
              <span className="text-[10px] font-medium">{label}</span>
            </NavLink>
          ))}
          <button
            type="button"
            onClick={() => setMoreOpen(true)}
            className="flex flex-col items-center gap-0.5 px-3 py-1 text-slate-500"
          >
            <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12h.01M12 12h.01M19 12h.01" />
            </svg>
            <span className="text-[10px] font-medium">More</span>
          </button>
        </nav>

        {/* "More" bottom sheet */}
        {moreOpen && (
          <div
            className="fixed inset-0 z-50 flex items-end md:hidden bg-black/60 animate-backdrop-in"
            onClick={() => setMoreOpen(false)}
          >
            <div
              className="w-full bg-gw-surface border-t border-white/[0.08] rounded-t-[14px] p-4 pb-8 animate-modal-in"
              onClick={e => e.stopPropagation()}
            >
              <div className="w-10 h-1 rounded-full bg-white/20 mx-auto mb-4" />
              <div className="grid grid-cols-2 gap-2">
                {MORE_ITEMS.map(({ to, label, icon }) => (
                  <NavLink
                    key={to}
                    to={to}
                    onClick={() => setMoreOpen(false)}
                    className={({ isActive }) =>
                      `flex items-center gap-3 rounded-[10px] px-3 py-3 transition-colors duration-100 ${
                        isActive
                          ? 'bg-gw-blue/20 border border-gw-blue/35 text-slate-100'
                          : 'bg-white/[0.03] border border-white/[0.06] text-slate-400 hover:text-slate-200'
                      }`
                    }
                  >
                    {icon}
                    <span className="text-sm font-medium">{label}</span>
                  </NavLink>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    )
  }

  // Trainer layout: icon sidebar (desktop) + bottom nav (mobile)
  if (role === 'trainer') {
    const TRAINER_BOTTOM_NAV = TRAINER_NAV_ITEMS.slice(0, 4)
    const TRAINER_MORE_ITEMS = [
      TRAINER_NAV_ITEMS[4], // Hours
    ]

    return (
      <div className="min-h-screen w-screen bg-gw-darkest">
        <TrainerLayout />

        {/* Mobile top bar */}
        <div className="fixed top-0 left-0 right-0 z-30 flex items-center justify-between h-14 bg-gw-darkest border-b border-white/[0.06] px-4 md:hidden">
          <div className="w-8 h-8 rounded-[10px] bg-gradient-to-br from-gw-blue to-gw-teal flex items-center justify-center shrink-0">
            <span className="text-white font-bold text-sm leading-none select-none">G</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-gw-blue/20 border border-gw-blue/30 flex items-center justify-center select-none">
              <span className="text-xs font-semibold text-gw-blue">{initials}</span>
            </div>
          </div>
        </div>

        {/* Main content */}
        <section className="md:ml-16 pt-14 md:pt-4 pb-20 md:pb-6 min-h-screen px-4 md:px-6 flex flex-col gap-4 overflow-auto">
          <Outlet />
        </section>

        {/* Mobile bottom nav */}
        <nav
          className="fixed bottom-0 left-0 right-0 z-30 flex items-center justify-around h-16 bg-gw-surface border-t border-white/[0.06] md:hidden"
          aria-label="Mobile navigation"
        >
          {TRAINER_BOTTOM_NAV.map(({ to, label, icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `flex flex-col items-center gap-0.5 px-3 py-1 transition-colors duration-100 ${
                  isActive ? 'text-gw-blue' : 'text-slate-500'
                }`
              }
            >
              {icon}
              <span className="text-[10px] font-medium">{label}</span>
            </NavLink>
          ))}
          <button
            type="button"
            onClick={() => setMoreOpen(true)}
            className="flex flex-col items-center gap-0.5 px-3 py-1 text-slate-500"
          >
            <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12h.01M12 12h.01M19 12h.01" />
            </svg>
            <span className="text-[10px] font-medium">More</span>
          </button>
        </nav>

        {/* More bottom sheet */}
        {moreOpen && (
          <div
            className="fixed inset-0 z-50 flex items-end md:hidden bg-black/60 animate-backdrop-in"
            onClick={() => setMoreOpen(false)}
          >
            <div
              className="w-full bg-gw-surface border-t border-white/[0.08] rounded-t-[14px] p-4 pb-8 animate-modal-in"
              onClick={e => e.stopPropagation()}
            >
              <div className="w-10 h-1 rounded-full bg-white/20 mx-auto mb-4" />
              <div className="grid grid-cols-2 gap-2">
                {TRAINER_MORE_ITEMS.map(({ to, label, icon }) => (
                  <NavLink
                    key={to}
                    to={to}
                    onClick={() => setMoreOpen(false)}
                    className={({ isActive }) =>
                      `flex items-center gap-3 rounded-[10px] px-3 py-3 transition-colors duration-100 ${
                        isActive
                          ? 'bg-gw-blue/20 border border-gw-blue/35 text-slate-100'
                          : 'bg-white/[0.03] border border-white/[0.06] text-slate-400 hover:text-slate-200'
                      }`
                    }
                  >
                    {icon}
                    <span className="text-sm font-medium">{label}</span>
                  </NavLink>
                ))}
                <button
                  type="button"
                  onClick={() => { signOut(); setMoreOpen(false) }}
                  className="flex items-center gap-3 rounded-[10px] px-3 py-3 bg-white/[0.03] border border-white/[0.06] text-slate-400 hover:text-slate-200 transition-colors duration-100"
                >
                  {navIcon('M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9')}
                  <span className="text-sm font-medium">Sign out</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    )
  }

  // Non-coordinator / non-trainer layout (trainee): minimal header
  return (
    <div className="min-h-screen bg-gw-darkest flex flex-col">
      <header className="px-6 py-4 border-b border-white/[0.08] bg-gw-surface flex items-center justify-between">
        <h1 className="text-base font-semibold text-slate-200">Gateway Training Tool</h1>
        <button
          type="button"
          onClick={signOut}
          className="rounded-md border border-rose-500/30 px-3 py-1.5 text-sm font-medium text-rose-400 hover:bg-rose-500/10"
        >
          Sign out
        </button>
      </header>
      <main className="flex-1 flex items-start justify-center px-4 py-10">
        <Outlet />
      </main>
    </div>
  )
}
