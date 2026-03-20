/**
 * layouts/CoordinatorRoute.tsx — Role-based route guard for coordinators
 *
 * Wraps child route elements that should only be accessible to users with
 * the 'coordinator' role. Any other authenticated user (trainer, trainee)
 * is silently redirected to /dashboard.
 *
 * Usage in App.tsx:
 *   <Route path="classes" element={<CoordinatorRoute><ClassesPage /></CoordinatorRoute>} />
 *
 * This guard is a client-side convenience only. All sensitive data operations
 * are also gated by `requireCoordinator` middleware on the backend API.
 */

import { Navigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

interface Props {
  children: React.ReactNode
}

export function CoordinatorRoute({ children }: Props) {
  const { role, loading } = useAuth()

  // Show a loading placeholder while auth resolves to avoid a premature redirect
  if (loading || role === null) return <div className="text-sm text-slate-500">Loading…</div>

  // Non-coordinators are redirected to the dashboard — they have no access here
  if (role !== 'coordinator') return <Navigate to="/dashboard" replace />

  return <>{children}</>
}
