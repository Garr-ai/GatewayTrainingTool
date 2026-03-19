import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { CoordinatorLayout } from '../components/CoordinatorLayout'

export function ProtectedLayout() {
  const { session, role, loading } = useAuth()

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
        <CoordinatorLayout />
        <section className="flex-1 bg-slate-100 px-6 py-5 flex flex-col gap-4 min-h-screen overflow-auto">
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
