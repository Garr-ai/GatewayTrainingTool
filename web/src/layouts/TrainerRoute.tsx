import { Navigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

export function TrainerRoute({ children }: { children: React.ReactNode }) {
  const { role } = useAuth()
  if (role !== 'trainer') return <Navigate to="/dashboard" replace />
  return <>{children}</>
}
