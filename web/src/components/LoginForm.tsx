/**
 * components/LoginForm.tsx — Email/password authentication form
 *
 * A single component that handles three authentication modes, toggled by
 * the mode state:
 *   - 'signin'  — Standard email + password login
 *   - 'signup'  — New account creation (collects first/last name and phone)
 *   - 'reset'   — Password reset email request (password field is hidden)
 *
 * All Supabase auth calls are made directly from the frontend (not via the
 * Express backend) since Supabase's auth service is separate from the API.
 *
 * On sign-in success, the AuthContext's `onAuthStateChange` listener in
 * AuthContext.tsx picks up the new session automatically — no redirect
 * code is needed here.
 *
 * The Google OAuth button is imported from GoogleLoginForm.tsx and shown
 * for the 'signin' and 'signup' modes, but hidden in 'reset' mode.
 */

import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { GoogleButton } from './GoogleLoginForm'
import { buildAuthRedirectUrl } from '../lib/authRedirect'
import { api } from '../lib/apiClient'

/** The three authentication states this form can be in. */
type AuthMode = 'signin' | 'signup' | 'reset'

/** Formats phone input as (XXX) XXX-XXXX */
function formatPhone(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 10)
  if (digits.length <= 3) return digits
  if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`
}

export function LoginForm() {
  // Which form is currently displayed
  const [mode, setMode] = useState<AuthMode>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [phone, setPhone] = useState('')
  // Tracks the in-flight and result states to control button labels and messaging
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [message, setMessage] = useState('')

  /**
   * Handles form submission for all three modes.
   * Calls the appropriate Supabase auth method and updates status/message.
   * On sign-in success, the session is picked up by AuthContext automatically.
   */
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
      // Validate name fields
      if (!firstName.trim() || !lastName.trim()) {
        setStatus('error')
        setMessage('First name and last name are required.')
        return
      }

      const { error } = await supabase.auth.signUp({ email, password })
      if (error) {
        setStatus('error')
        setMessage(error.message)
      } else {
        // Try to save profile data immediately (may fail if profile isn't created yet)
        try {
          await api.profiles.update({
            first_name: firstName.trim(),
            last_name: lastName.trim(),
            phone: phone.replace(/\D/g, '').length >= 10 ? phone : undefined,
          })
        } catch {
          // Profile may not exist yet — data will be collected on role selection page
        }
        setStatus('success')
        setMessage('Account created. Check your email to confirm your account.')
      }
    } else if (mode === 'reset') {
      // redirectTo is the URL Supabase includes in the reset email link
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: buildAuthRedirectUrl('/reset-password'),
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
        {/* Name fields — signup only */}
        {mode === 'signup' && (
          <div className="flex gap-3">
            <div className="flex flex-col gap-1.5 flex-1">
              <label htmlFor="firstName" className="text-sm font-medium text-slate-900">
                First Name <span className="text-rose-500">*</span>
              </label>
              <input
                id="firstName"
                type="text"
                value={firstName}
                onChange={e => setFirstName(e.target.value)}
                placeholder="John"
                required
                disabled={status === 'loading'}
                className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 shadow-sm outline-none placeholder:text-slate-400 focus:border-gw-blue focus:ring-1 focus:ring-gw-blue disabled:bg-slate-50 disabled:text-slate-400"
              />
            </div>
            <div className="flex flex-col gap-1.5 flex-1">
              <label htmlFor="lastName" className="text-sm font-medium text-slate-900">
                Last Name <span className="text-rose-500">*</span>
              </label>
              <input
                id="lastName"
                type="text"
                value={lastName}
                onChange={e => setLastName(e.target.value)}
                placeholder="Doe"
                required
                disabled={status === 'loading'}
                className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 shadow-sm outline-none placeholder:text-slate-400 focus:border-gw-blue focus:ring-1 focus:ring-gw-blue disabled:bg-slate-50 disabled:text-slate-400"
              />
            </div>
          </div>
        )}

        {/* Phone — signup only */}
        {mode === 'signup' && (
          <div className="flex flex-col gap-1.5">
            <label htmlFor="phone" className="text-sm font-medium text-slate-900">
              Phone <span className="text-slate-400 text-xs font-normal">(optional)</span>
            </label>
            <input
              id="phone"
              type="tel"
              value={phone}
              onChange={e => setPhone(formatPhone(e.target.value))}
              placeholder="(604) 555-1234"
              disabled={status === 'loading'}
              className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 shadow-sm outline-none placeholder:text-slate-400 focus:border-gw-blue focus:ring-1 focus:ring-gw-blue disabled:bg-slate-50 disabled:text-slate-400"
            />
          </div>
        )}

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
