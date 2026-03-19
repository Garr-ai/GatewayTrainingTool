import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
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

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginView />} />
          <Route path="/" element={<ProtectedLayout />}>
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="dashboard" element={<DashboardView />} />
            <Route path="classes" element={<CoordinatorRoute><ClassesPage /></CoordinatorRoute>} />
            <Route path="classes/:className" element={<ClassDetailView />} />
            <Route path="students" element={<CoordinatorRoute><RosterPage role="trainee" title="Students" subtitle="All registered trainees" /></CoordinatorRoute>} />
            <Route path="trainers" element={<CoordinatorRoute><RosterPage role="trainer" title="Trainers" subtitle="All registered trainers" /></CoordinatorRoute>} />
            <Route path="reports" element={<CoordinatorRoute><ReportsPage /></CoordinatorRoute>} />
            <Route path="schedule" element={<CoordinatorRoute><SchedulePage /></CoordinatorRoute>} />
            <Route path="settings" element={<CoordinatorRoute><SettingsContent /></CoordinatorRoute>} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}

export default App
