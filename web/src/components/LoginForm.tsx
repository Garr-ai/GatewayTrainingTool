import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { GoogleButton } from './GoogleLoginForm'

type AuthMode = 'signin' | 'signup' | 'reset'

export function LoginForm() {
  const [mode, setMode] = useState<AuthMode>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [message, setMessage] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setStatus('loading')
    setMessage('')

    if (mode === 'signin') {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) {
        setStatus('error')
        setMessage(error.message)
      } else {
        setStatus('success')
        setMessage('Signed in successfully.')
      }
    } else if (mode === 'signup') {
      const { error } = await supabase.auth.signUp({ email, password })
      if (error) {
        setStatus('error')
        setMessage(error.message)
      } else {
        setStatus('success')
        setMessage('Account created. Check your email to confirm your account.')
      }
    } else if (mode === 'reset') {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      })
      if (error) {
        setStatus('error')
        setMessage(error.message)
      } else {
        setStatus('success')
        setMessage('Password reset email sent. Check your inbox.')
      }
    }
  }

  return (
    <div className="login-card">
      <div className="login-card__header">
        <h2>{mode === 'reset' ? 'Reset password' : 'Gateway Training Tool'}</h2>
        <p className="login-card__subtitle">
          {mode === 'signin' && 'Sign in to your account'}
          {mode === 'signup' && 'Create a new account'}
          {mode === 'reset' && "We'll email you a reset link"}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="login-card__form" noValidate>
        <div className="form-field">
          <label htmlFor="email">Email</label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
            disabled={status === 'loading'}
          />
        </div>

        {mode !== 'reset' && (
          <div className="form-field">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
              placeholder="••••••••"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              disabled={status === 'loading'}
            />
          </div>
        )}

        {status === 'error' && (
          <p className="form-message form-message--error" role="alert">
            {message}
          </p>
        )}
        {status === 'success' && (
          <p className="form-message form-message--success" role="status">
            {message}
          </p>
        )}

        <button
          type="submit"
          className="btn-submit"
          disabled={status === 'loading'}
        >
          {status === 'loading'
            ? 'Please wait…'
            : mode === 'signin'
              ? 'Sign in'
              : mode === 'signup'
                ? 'Create account'
                : 'Send reset email'}
        </button>
      </form>

      {mode !== 'reset' && (
        <>
          <div className="divider"><span>or</span></div>
          <GoogleButton />
        </>
      )}

      <div className="login-card__footer">
        {mode === 'signin' && (
          <>
            <button type="button" className="link-btn" onClick={() => { setMode('reset'); setMessage('') }}>
              Forgot password?
            </button>
            <button type="button" className="link-btn" onClick={() => { setMode('signup'); setMessage('') }}>
              Don't have an account? Sign up
            </button>
          </>
        )}
        {mode === 'signup' && (
          <button type="button" className="link-btn" onClick={() => { setMode('signin'); setMessage('') }}>
            Already have an account? Sign in
          </button>
        )}
        {mode === 'reset' && (
          <button type="button" className="link-btn" onClick={() => { setMode('signin'); setMessage('') }}>
            Back to sign in
          </button>
        )}
      </div>
    </div>
  )
}
