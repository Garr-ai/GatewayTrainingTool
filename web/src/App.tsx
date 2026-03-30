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
 *     /dashboard            — Role-aware dashboard (coordinator view or "in progress" placeholder)
 *     /classes              — Class management list (coordinator only)
 *     /classes/:className   — Class detail with tabbed sub-sections (coordinator only)
 *     /students             — Trainee roster (coordinator only)
 *     /trainers             — Trainer roster (coordinator only)
 *     /reports              — Cross-class daily reports list (coordinator only)
 *     /schedule             — Upcoming schedule across all classes (coordinator only)
 *     /settings             — App/account settings (coordinator only)
 *   *                       — Catch-all redirects unknown paths to /
 *
 * The `CoordinatorRoute` wrapper enforces role-based access; non-coordinators
 * are redirected to /dashboard.
 */

import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import { ToastProvider } from './contexts/ToastContext'
import { ClassesProvider } from './contexts/ClassesContext'
import { CoordinatorRoute } from './layouts/CoordinatorRoute'
import { ProtectedLayout } from './layouts/ProtectedLayout'
import { LoginView } from './pages/LoginView'
import { DashboardView } from './pages/DashboardView'
import { ClassesPage } from './pages/ClassesPage'
import { ClassDetailView } from './pages/ClassDetailView'
import { RosterPage } from './pages/RosterPage'
import { ReportsPage } from './pages/ReportsPage'
import { SchedulePage } from './pages/SchedulePage'
import { SettingsContent } from './pages/SettingsContent'
import { TrainerPayrollPage } from './pages/TrainerPayrollPage'
import { StudentPayrollPage } from './pages/StudentPayrollPage'
import { StudentProgressPage } from './pages/StudentProgressPage'

function App() {
  return (
    // AuthProvider must wrap everything so routing decisions can read auth state
    <AuthProvider>
      <ToastProvider>
      <BrowserRouter>
        <Routes>
          {/* Public — accessible without authentication */}
          <Route path="/login" element={<LoginView />} />

          {/* Protected shell — ProtectedLayout checks auth and renders the sidebar layout */}
          <Route path="/" element={<ClassesProvider><ProtectedLayout /></ClassesProvider>}>
            {/* Default redirect from / to /dashboard */}
            <Route index element={<Navigate to="/dashboard" replace />} />

            {/* Dashboard is visible to all roles but renders different content per role */}
            <Route path="dashboard" element={<DashboardView />} />

            {/* Coordinator-only pages wrapped in CoordinatorRoute guard */}
            <Route path="classes" element={<CoordinatorRoute><ClassesPage /></CoordinatorRoute>} />
            <Route path="classes/:className" element={<ClassDetailView />} />
            <Route path="students/progress/:email" element={<CoordinatorRoute><StudentProgressPage /></CoordinatorRoute>} />
            <Route path="students" element={<CoordinatorRoute><RosterPage role="trainee" title="Students" subtitle="All registered trainees" /></CoordinatorRoute>} />
            <Route path="trainers" element={<CoordinatorRoute><RosterPage role="trainer" title="Trainers" subtitle="All registered trainers" /></CoordinatorRoute>} />
            <Route path="reports" element={<CoordinatorRoute><ReportsPage /></CoordinatorRoute>} />
            <Route path="schedule" element={<CoordinatorRoute><SchedulePage /></CoordinatorRoute>} />
            <Route path="payroll/trainers" element={<CoordinatorRoute><TrainerPayrollPage /></CoordinatorRoute>} />
            <Route path="payroll/students" element={<CoordinatorRoute><StudentPayrollPage /></CoordinatorRoute>} />
            <Route path="settings" element={<CoordinatorRoute><SettingsContent /></CoordinatorRoute>} />
          </Route>

          {/* Catch-all — send unknown paths back to the root which redirects to /dashboard */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
      </ToastProvider>
    </AuthProvider>
  )
}

export default App
