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
    <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white shadow-lg p-8 flex flex-col gap-6">
      <div className="text-center">
        <h2 className="text-lg font-semibold text-gw-dark">
          {mode === 'reset' ? 'Reset password' : 'Gateway Training Tool'}
        </h2>
        <p className="mt-1 text-sm text-slate-500">
          {mode === 'signin' && 'Sign in to your account'}
          {mode === 'signup' && 'Create a new account'}
          {mode === 'reset' && "We'll email you a reset link"}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="email" className="text-sm font-medium text-slate-900">
            Email
          </label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
            disabled={status === 'loading'}
            className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 shadow-sm outline-none placeholder:text-slate-400 focus:border-gw-blue focus:ring-1 focus:ring-gw-blue disabled:bg-slate-50 disabled:text-slate-400"
          />
        </div>

        {mode !== 'reset' && (
          <div className="flex flex-col gap-1.5">
            <label htmlFor="password" className="text-sm font-medium text-slate-900">
              Password
            </label>
            <input
              id="password"
              type="password"
              autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
              placeholder="••••••••"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              disabled={status === 'loading'}
              className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 shadow-sm outline-none placeholder:text-slate-400 focus:border-gw-blue focus:ring-1 focus:ring-gw-blue disabled:bg-slate-50 disabled:text-slate-400"
            />
          </div>
        )}

        {status === 'error' && (
          <p className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700" role="alert">
            {message}
          </p>
        )}
        {status === 'success' && (
          <p className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700" role="status">
            {message}
          </p>
        )}

        <button
          type="submit"
          className="mt-1 inline-flex w-full items-center justify-center rounded-md bg-gw-blue px-3 py-2 text-sm font-medium text-white shadow-sm hover:bg-gw-blue-hover disabled:opacity-60"
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
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <span className="h-px flex-1 bg-slate-200" />
            <span>or</span>
            <span className="h-px flex-1 bg-slate-200" />
          </div>
          <GoogleButton />
        </>
      )}

      <div className="flex flex-col items-center gap-1.5 text-xs text-gw-blue">
        {mode === 'signin' && (
          <>
            <button type="button" className="hover:underline" onClick={() => { setMode('reset'); setMessage('') }}>
              Forgot password?
            </button>
            <button type="button" className="hover:underline" onClick={() => { setMode('signup'); setMessage('') }}>
              Don't have an account? Sign up
            </button>
          </>
        )}
        {mode === 'signup' && (
          <button type="button" className="hover:underline" onClick={() => { setMode('signin'); setMessage('') }}>
            Already have an account? Sign in
          </button>
        )}
        {mode === 'reset' && (
          <button type="button" className="hover:underline" onClick={() => { setMode('signin'); setMessage('') }}>
            Back to sign in
          </button>
        )}
      </div>
    </div>
  )
}
