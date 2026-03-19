import { Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

export function DashboardContent() {
  const { email, signOut } = useAuth()

  return (
    <>
      <header className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Dashboard</h2>
          <p className="mt-0.5 text-xs text-slate-500">Coordinator overview</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex flex-col items-end gap-1">
            <span className="text-[10px] font-semibold tracking-[0.16em] uppercase text-slate-500">Coordinator</span>
            <span className="text-xs text-slate-800">{email}</span>
            <button type="button" className="mt-1 inline-flex items-center rounded-md border border-slate-300 px-2 py-1 text-[11px] text-slate-700 hover:border-slate-400" onClick={signOut}>Sign out</button>
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
          <Link to="/classes" className="text-xs font-medium text-gw-blue hover:underline">View all</Link>
        </div>
        <p className="text-xs text-slate-500">Active class details will appear here.</p>
      </section>

      <section className="mt-2 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4">
        <p className="text-xs text-slate-500">Additional dashboard modules will be added here.</p>
      </section>
    </>
  )
}
