/**
 * pages/DashboardView.tsx — Role-aware dashboard dispatcher
 *
 * Renders different dashboard content depending on the user's role:
 *   - Coordinators see DashboardContent (the overview with class and alert panels)
 *   - Trainers and trainees see InProgressPage (a "work in progress" placeholder)
 *
 * This component intentionally keeps branching logic separate from the actual
 * content components so each content component has a single responsibility.
 */

import { useAuth } from '../contexts/AuthContext'
import { DashboardContent } from './DashboardContent'
import { InProgressPage } from './InProgressPage'

export function DashboardView() {
  const { role, email, signOut } = useAuth()

  // Coordinators get the full management dashboard
  if (role === 'coordinator') {
    return <DashboardContent />
  }

  // Trainers and trainees see a placeholder until their views are built
  return <InProgressPage email={email} onSignOut={signOut} />
}
