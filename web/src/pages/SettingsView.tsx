import { Navigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { SettingsContent } from './SettingsContent'

export function SettingsView() {
  const { role } = useAuth()

  if (role !== 'coordinator') {
    return <Navigate to="/dashboard" replace />
  }

  return <SettingsContent />
}
