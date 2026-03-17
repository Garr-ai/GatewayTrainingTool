import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import { LoginView } from './pages/LoginView'
import { ProtectedLayout } from './layouts/ProtectedLayout'
import { DashboardView } from './pages/DashboardView'
import { ClassesView } from './pages/ClassesView'
import { SettingsView } from './pages/SettingsView'
import { ClassDetailView } from './pages/ClassDetailView'
import { SupabaseStatusWidget } from './components/SupabaseStatusWidget'

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginView />} />
          <Route path="/" element={<ProtectedLayout />}>
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="dashboard" element={<DashboardView />} />
            <Route path="classes" element={<ClassesView />} />
            <Route path="classes/:className" element={<ClassDetailView />} />
            <Route path="settings" element={<SettingsView />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        <SupabaseStatusWidget />
      </BrowserRouter>
    </AuthProvider>
  )
}

export default App
