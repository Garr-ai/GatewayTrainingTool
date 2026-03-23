/**
 * components/CoordinatorLayout.tsx — Sidebar navigation for coordinators
 *
 * Renders the left-hand navigation sidebar used in the coordinator shell.
 * On desktop (md+) the sidebar is always visible. On mobile, it slides in
 * from the left when `mobileOpen` is true, controlled by ProtectedLayout.
 *
 * A semi-transparent overlay is rendered behind the sidebar on mobile so
 * users can tap outside to close it.
 *
 * NavLink from React Router applies the `isActive` class automatically
 * when the current URL matches the `to` prop, giving visual feedback on
 * which section the user is in.
 *
 * Settings is pinned to the bottom of the nav via `mt-auto` so it stays
 * visually separated from the main navigation items.
 */

import { NavLink } from 'react-router-dom'

interface CoordinatorLayoutProps {
  mobileOpen: boolean       // Whether the slide-in drawer is visible (mobile only)
  onMobileClose: () => void // Callback to close the drawer (passed to overlay and close button)
}

type NavItem = { to: string; label: string; icon: React.ReactNode }

const icon = (d: string) => (
  <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
    <path d={d} />
  </svg>
)

/** Primary navigation items shown in the sidebar for coordinators. */
const NAV_ITEMS: NavItem[] = [
  { to: '/dashboard', label: 'Dashboard', icon: icon('M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2V9z') },
  { to: '/classes', label: 'Classes', icon: icon('M4 19.5A2.5 2.5 0 016.5 17H20M4 19.5A2.5 2.5 0 004 17V5a2 2 0 012-2h14a2 2 0 012 2v12a2.5 2.5 0 01-2.5 2.5H4z') },
  { to: '/students', label: 'Students', icon: icon('M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4-4v2M9 11a4 4 0 100-8 4 4 0 000 8zM23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75') },
  { to: '/trainers', label: 'Trainers', icon: icon('M16 21v-2a4 4 0 00-4-4H5a4 4 0 00-4-4v2M8.5 11a4 4 0 100-8 4 4 0 000 8zM20 8v6M23 11h-6') },
  { to: '/reports', label: 'Reports', icon: icon('M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8zM14 2v6h6M16 13H8M16 17H8M10 9H8') },
  { to: '/schedule', label: 'Schedule', icon: icon('M19 4H5a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2V6a2 2 0 00-2-2zM16 2v4M8 2v4M3 10h18') },
]

const settingsIcon = icon('M12 15a3 3 0 100-6 3 3 0 000 6zM19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 01-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z')

export function CoordinatorLayout({ mobileOpen, onMobileClose }: CoordinatorLayoutProps) {
  return (
    <>
      {/* Semi-transparent backdrop — closes drawer when tapped on mobile */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
          onClick={onMobileClose}
        />
      )}

      {/*
        Sidebar aside element.
        On mobile: fixed position, slides in/out via translate-x.
        On desktop (md+): relative position, always visible (translate-x-0).
      */}
      <aside
        className={`
          fixed top-0 left-0 z-50 h-full w-56 flex-shrink-0
          bg-gradient-to-b from-gw-darkest to-gw-dark text-white px-4 py-5 flex flex-col gap-6
          transition-transform duration-200
          ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}
          md:relative md:translate-x-0 md:z-auto
        `}
      >
        {/* Wordmark + close button (close button only shown on mobile) */}
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
          {/* Render each nav item; NavLink handles active state styling automatically */}
          {NAV_ITEMS.map(({ to, label, icon: navIcon }) => (
            <NavLink
              key={to}
              to={to}
              onClick={onMobileClose}  // Close drawer when navigating on mobile
              className={({ isActive }) =>
                `w-full rounded-lg px-3 py-2 text-left text-sm flex items-center gap-2.5 ${isActive ? 'bg-white/15 text-white' : 'text-white/70 hover:bg-white/8 hover:text-white'}`
              }
            >
              {navIcon}
              {label}
            </NavLink>
          ))}

          {/* Settings pinned to bottom — visually separated from the main nav items */}
          <div className="mt-auto">
            <NavLink
              to="/settings"
              onClick={onMobileClose}
              className={({ isActive }) =>
                `w-full rounded-lg px-3 py-2 text-left text-sm flex items-center gap-2.5 ${isActive ? 'bg-white/15 text-white' : 'text-white/70 hover:bg-white/8 hover:text-white'}`
              }
            >
              {settingsIcon}
              Settings
            </NavLink>
          </div>
        </nav>
      </aside>
    </>
  )
}
