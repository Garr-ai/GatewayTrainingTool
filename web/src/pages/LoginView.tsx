import { Navigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { LoginForm } from '../components/LoginForm'

export function LoginView() {
  const { session } = useAuth()

  if (session) {
    return <Navigate to="/dashboard" replace />
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-100 px-4">
      <LoginForm />
    </div>
  )
}
