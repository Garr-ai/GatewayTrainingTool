import { useAuth } from '../contexts/AuthContext'
import { DashboardContent } from './DashboardContent'
import { InProgressPage } from './InProgressPage'

export function DashboardView() {
  const { role, email, signOut } = useAuth()

  if (role === 'coordinator') {
    return <DashboardContent />
  }

  return <InProgressPage email={email} onSignOut={signOut} />
}
