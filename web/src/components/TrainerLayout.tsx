import { NavLink } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

type NavItem = { to: string; label: string; icon: React.ReactNode }

const icon = (d: string) => (
  <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
    <path d={d} />
  </svg>
)

export const TRAINER_NAV_ITEMS: NavItem[] = [
  { to: '/dashboard', label: 'Dashboard', icon: icon('M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2V9z') },
  { to: '/my-classes', label: 'My Classes', icon: icon('M4 19.5A2.5 2.5 0 016.5 17H20M4 19.5A2.5 2.5 0 004 17V5a2 2 0 012-2h14a2 2 0 012 2v12a2.5 2.5 0 01-2.5 2.5H4z') },
  { to: '/reports', label: 'Reports', icon: icon('M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8zM14 2v6h6M16 13H8M16 17H8M10 9H8') },
  { to: '/schedule', label: 'Schedule', icon: icon('M19 4H5a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2V6a2 2 0 00-2-2zM16 2v4M8 2v4M3 10h18') },
  { to: '/hours', label: 'Hours', icon: icon('M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10zM12 6v6l4 2') },
]

function NavTooltip({ label }: { label: string }) {
  return (
    <div className="pointer-events-none absolute left-full ml-2.5 top-1/2 -translate-y-1/2 z-[60] opacity-0 group-hover/tip:opacity-100 transition-opacity duration-100 whitespace-nowrap">
      <div className="bg-gw-surface border border-white/10 rounded-md px-2.5 py-1 text-xs font-medium text-slate-200 shadow-lg">
        {label}
      </div>
    </div>
  )
}

export function TrainerLayout() {
  const { signOut } = useAuth()

  return (
    <aside className="hidden md:flex fixed top-0 left-0 h-full w-16 flex-col items-center py-4 gap-2 bg-white/[0.03] border-r border-white/[0.06] z-50">
      {/* Logo mark */}
      <div className="w-10 h-10 rounded-[10px] bg-gradient-to-br from-gw-blue to-gw-teal flex items-center justify-center shrink-0 mb-2">
        <span className="text-white font-bold text-base leading-none select-none">G</span>
      </div>

      {/* Nav items */}
      <nav className="flex flex-col items-center gap-1 flex-1 w-full px-3" aria-label="Trainer navigation">
        {TRAINER_NAV_ITEMS.map(({ to, label, icon: navIcon }) => (
          <div key={to} className="relative group/tip w-full flex justify-center">
            <NavLink
              to={to}
              className={({ isActive }) =>
                `w-10 h-10 rounded-[10px] flex items-center justify-center transition-colors duration-100 ${
                  isActive
                    ? 'bg-gw-blue/20 border border-gw-blue/35 text-gw-blue'
                    : 'text-slate-500 hover:bg-white/5 hover:text-slate-300'
                }`
              }
              aria-label={label}
            >
              {navIcon}
            </NavLink>
            <NavTooltip label={label} />
          </div>
        ))}
      </nav>

      {/* Sign out */}
      <div className="relative group/tip w-full flex justify-center px-3">
        <button
          type="button"
          onClick={signOut}
          className="w-10 h-10 rounded-[10px] flex items-center justify-center text-slate-500 hover:bg-white/5 hover:text-slate-300 transition-colors duration-100"
          aria-label="Sign out"
        >
          {icon('M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9')}
        </button>
        <NavTooltip label="Sign out" />
      </div>
    </aside>
  )
}
