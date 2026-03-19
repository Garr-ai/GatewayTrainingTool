import { NavLink } from 'react-router-dom'

interface CoordinatorLayoutProps {
  mobileOpen: boolean
  onMobileClose: () => void
}

export function CoordinatorLayout({ mobileOpen, onMobileClose }: CoordinatorLayoutProps) {
  return (
    <>
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
          onClick={onMobileClose}
        />
      )}

      <aside
        className={`
          fixed top-0 left-0 z-50 h-full w-56 flex-shrink-0
          bg-gradient-to-b from-slate-900 to-slate-800 text-slate-100 px-4 py-5 flex flex-col gap-6
          transition-transform duration-200
          ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}
          md:relative md:translate-x-0 md:z-auto
        `}
      >
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold tracking-[0.2em] uppercase text-slate-200">
            Gateway
          </span>
          <button
            type="button"
            onClick={onMobileClose}
            className="md:hidden text-slate-400 hover:text-slate-200 p-1 -mr-1"
            aria-label="Close menu"
          >
            <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <nav className="flex flex-col gap-1" aria-label="Main navigation">
          <NavLink
            to="/dashboard"
            onClick={onMobileClose}
            className={({ isActive }) =>
              `w-full rounded-lg px-3 py-2 text-left text-sm ${isActive ? 'bg-slate-700/70' : 'hover:bg-slate-700/40'}`
            }
          >
            Dashboard
          </NavLink>
          <NavLink
            to="/classes"
            onClick={onMobileClose}
            className={({ isActive }) =>
              `w-full rounded-lg px-3 py-2 text-left text-sm ${isActive ? 'bg-slate-700/70' : 'hover:bg-slate-700/40'}`
            }
          >
            Classes
          </NavLink>
          <NavLink
            to="/settings"
            onClick={onMobileClose}
            className={({ isActive }) =>
              `w-full rounded-lg px-3 py-2 text-left text-sm ${isActive ? 'bg-slate-700/70' : 'hover:bg-slate-700/40'}`
            }
          >
            Settings
          </NavLink>
        </nav>
      </aside>
    </>
  )
}
