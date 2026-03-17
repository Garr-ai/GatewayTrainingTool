import { NavLink } from 'react-router-dom'

export function CoordinatorLayout() {
  return (
    <aside className="w-56 flex-shrink-0 bg-gradient-to-b from-slate-900 to-slate-800 text-slate-100 px-4 py-5 flex flex-col gap-6">
      <div className="text-xs font-semibold tracking-[0.2em] uppercase text-slate-200">
        Gateway
      </div>
      <nav className="flex flex-col gap-1" aria-label="Main navigation">
        <NavLink
          to="/dashboard"
          className={({ isActive }) =>
            `w-full rounded-lg px-3 py-2 text-left text-sm ${isActive ? 'bg-slate-700/70' : 'hover:bg-slate-700/40'}`
          }
        >
          Dashboard
        </NavLink>
        <NavLink
          to="/classes"
          className={({ isActive }) =>
            `w-full rounded-lg px-3 py-2 text-left text-sm ${isActive ? 'bg-slate-700/70' : 'hover:bg-slate-700/40'}`
          }
        >
          Classes
        </NavLink>
        <NavLink
          to="/settings"
          className={({ isActive }) =>
            `w-full rounded-lg px-3 py-2 text-left text-sm ${isActive ? 'bg-slate-700/70' : 'hover:bg-slate-700/40'}`
          }
        >
          Settings
        </NavLink>
      </nav>
    </aside>
  )
}
