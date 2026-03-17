import { Navigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { ClassesPage } from './ClassesPage'

export function ClassesView() {
  const { role } = useAuth()

  if (role !== 'coordinator') {
    return <Navigate to="/dashboard" replace />
  }

  return <ClassesPage />
}
