/**
 * App.tsx — Root application component
 *
 * Defines the entire client-side routing tree using React Router v6.
 * All routes are wrapped with `AuthProvider` so every descendant can
 * access the current session, role, and sign-out function via `useAuth()`.
 *
 * Route structure:
 *   /login                  — Public login page (redirects to /dashboard if already signed in)
 *   /                       — Protected shell (redirects unauthenticated users to /login)
 *     /dashboard            — Role-aware dashboard (coordinator, trainer, or trainee view)
 *     /classes              — Class management list (coordinator only)
 *     /classes/:className   — Class detail with tabbed sub-sections (coordinator only)
 *     /students             — Trainee roster (coordinator only)
 *     /trainers             — Trainer roster (coordinator only)
 *     /reports              — Cross-class daily reports (coordinator or trainer, role-aware)
 *     /schedule             — Upcoming schedule across all classes (coordinator or trainer, role-aware)
 *     /settings             — App/account settings (coordinator only)
 *     /my-classes           — Trainer's assigned classes list (trainer only)
 *     /my-classes/:classId  — Tabbed class detail page (trainer only)
 *     /hours                — Personal hours overview (trainer only)
 *   *                       — Catch-all redirects unknown paths to /
 *
 * `CoordinatorRoute` enforces coordinator-only access (redirects to /dashboard).
 * `TrainerRoute` enforces trainer-only access (redirects to /dashboard).
 * `RoleAwareRoute` renders different content for coordinator vs trainer on shared paths.
 */

import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { useAuth } from './contexts/AuthContext'
import { AuthProvider } from './contexts/AuthContext'
import { ToastProvider } from './contexts/ToastContext'
import { ClassesProvider } from './contexts/ClassesContext'
import { CoordinatorRoute } from './layouts/CoordinatorRoute'
import { TrainerRoute } from './layouts/TrainerRoute'
import { ConditionalTrainerProvider } from './contexts/TrainerContext'
import { ProtectedLayout } from './layouts/ProtectedLayout'
import { LoginView } from './pages/LoginView'
import { DashboardView } from './pages/DashboardView'
import { ClassesPage } from './pages/ClassesPage'
import { ClassDetailView } from './pages/ClassDetailView'
import { RosterPage } from './pages/RosterPage'
import { ReportsPage } from './pages/ReportsPage'
import { SchedulePage } from './pages/SchedulePage'
import { SettingsContent } from './pages/SettingsContent'
import { StudentProgressPage } from './pages/StudentProgressPage'
import { MyClassesPage } from './pages/MyClassesPage'
import { TrainerClassDetailPage } from './pages/TrainerClassDetailPage'
import { TrainerReportsPage } from './pages/TrainerReportsPage'
import { TrainerSchedulePage } from './pages/TrainerSchedulePage'
import { TrainerHoursPage } from './pages/TrainerHoursPage'
import { StudentRoute } from './layouts/StudentRoute'
import { StudentClassDetailPage } from './pages/StudentClassDetailPage'

/** Renders role-specific content for shared paths (/reports, /schedule). */
function RoleAwareRoute({ coordinator, trainer }: { coordinator: React.ReactNode; trainer: React.ReactNode }) {
  const { role } = useAuth()
  if (role === 'coordinator') return <>{coordinator}</>
  if (role === 'trainer') return <>{trainer}</>
  return <Navigate to="/dashboard" replace />
}

function App() {
  return (
    <AuthProvider>
      <ToastProvider>
      <BrowserRouter>
        <Routes>
          {/* Public — accessible without authentication */}
          <Route path="/login" element={<LoginView />} />

          {/* Protected shell */}
          <Route path="/" element={<ClassesProvider><ConditionalTrainerProvider><ProtectedLayout /></ConditionalTrainerProvider></ClassesProvider>}>
            <Route index element={<Navigate to="/dashboard" replace />} />

            {/* Role-aware dashboard */}
            <Route path="dashboard" element={<DashboardView />} />

            {/* Coordinator-only routes */}
            <Route path="classes" element={<CoordinatorRoute><ClassesPage /></CoordinatorRoute>} />
            <Route path="classes/:className" element={<ClassDetailView />} />
            <Route path="students/progress/:email" element={<CoordinatorRoute><StudentProgressPage /></CoordinatorRoute>} />
            <Route path="students" element={<CoordinatorRoute><RosterPage role="trainee" title="Students" subtitle="All registered trainees" /></CoordinatorRoute>} />
            <Route path="trainers" element={<CoordinatorRoute><RosterPage role="trainer" title="Trainers" subtitle="All registered trainers" /></CoordinatorRoute>} />
            <Route path="settings" element={<CoordinatorRoute><SettingsContent /></CoordinatorRoute>} />

            {/* Shared paths — role-aware (coordinator vs trainer) */}
            <Route path="reports" element={
              <RoleAwareRoute
                coordinator={<CoordinatorRoute><ReportsPage /></CoordinatorRoute>}
                trainer={<TrainerRoute><TrainerReportsPage /></TrainerRoute>}
              />
            } />
            <Route path="schedule" element={
              <RoleAwareRoute
                coordinator={<CoordinatorRoute><SchedulePage /></CoordinatorRoute>}
                trainer={<TrainerRoute><TrainerSchedulePage /></TrainerRoute>}
              />
            } />

            {/* Trainer-only routes */}
            <Route path="my-classes" element={<TrainerRoute><MyClassesPage /></TrainerRoute>} />
            <Route path="my-classes/:classId" element={<TrainerRoute><TrainerClassDetailPage /></TrainerRoute>} />
            <Route path="hours" element={<TrainerRoute><TrainerHoursPage /></TrainerRoute>} />

            {/* Student-only routes */}
            <Route path="my-class/:classId" element={<StudentRoute><StudentClassDetailPage /></StudentRoute>} />
          </Route>

          {/* Catch-all */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
      </ToastProvider>
    </AuthProvider>
  )
}

export default App
