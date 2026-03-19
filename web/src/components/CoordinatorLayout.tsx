import { NavLink } from 'react-router-dom'

interface CoordinatorLayoutProps {
  mobileOpen: boolean
  onMobileClose: () => void
}

type NavItem = { to: string; label: string }

const NAV_ITEMS: NavItem[] = [
  { to: '/dashboard', label: 'Dashboard' },
  { to: '/classes', label: 'Classes' },
  { to: '/students', label: 'Students' },
  { to: '/trainers', label: 'Trainers' },
  { to: '/reports', label: 'Reports' },
  { to: '/schedule', label: 'Schedule' },
]

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
          bg-gradient-to-b from-gw-darkest to-gw-dark text-white px-4 py-5 flex flex-col gap-6
          transition-transform duration-200
          ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}
          md:relative md:translate-x-0 md:z-auto
        `}
      >
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold tracking-[0.2em] uppercase text-white/80">
            Gateway
          </span>
          <button
            type="button"
            onClick={onMobileClose}
            className="md:hidden text-white/50 hover:text-white p-1 -mr-1"
            aria-label="Close menu"
          >
            <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <nav className="flex flex-col gap-1 flex-1" aria-label="Main navigation">
          {NAV_ITEMS.map(({ to, label }) => (
            <NavLink
              key={to}
              to={to}
              onClick={onMobileClose}
              className={({ isActive }) =>
                `w-full rounded-lg px-3 py-2 text-left text-sm ${isActive ? 'bg-white/15 text-white' : 'text-white/70 hover:bg-white/8 hover:text-white'}`
              }
            >
              {label}
            </NavLink>
          ))}

          {/* Settings pinned to bottom */}
          <div className="mt-auto">
            <NavLink
              to="/settings"
              onClick={onMobileClose}
              className={({ isActive }) =>
                `w-full rounded-lg px-3 py-2 text-left text-sm ${isActive ? 'bg-white/15 text-white' : 'text-white/70 hover:bg-white/8 hover:text-white'}`
              }
            >
              Settings
            </NavLink>
          </div>
        </nav>
      </aside>
    </>
  )
}
