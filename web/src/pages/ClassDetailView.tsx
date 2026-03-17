import { Navigate, useParams } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { ClassDetailPage } from './ClassDetailPage'

export function ClassDetailView() {
  const { role } = useAuth()
  const { className } = useParams()

  if (role !== 'coordinator') {
    return <Navigate to="/dashboard" replace />
  }

  if (!className) {
    return <Navigate to="/classes" replace />
  }

  const decodedSlug = className
  const reconstructedName = decodedSlug.replace(/-/g, ' ')

  return <ClassDetailPage className={reconstructedName} />
}

