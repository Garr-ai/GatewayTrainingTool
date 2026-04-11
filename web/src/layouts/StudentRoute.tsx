import { Navigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

export function StudentRoute({ children }: { children: React.ReactNode }) {
  const { role } = useAuth()
  if (role !== 'trainee') return <Navigate to="/dashboard" replace />
  return <>{children}</>
}
