import { Navigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { ClassesPage } from './ClassesPage'

export function ClassesView() {
  const { role, loading } = useAuth()

  if (loading || role === null) {
    return <div className="text-sm text-slate-500">Loading…</div>
  }

  if (role !== 'coordinator') {
    return <Navigate to="/dashboard" replace />
  }

  return <ClassesPage />
}
