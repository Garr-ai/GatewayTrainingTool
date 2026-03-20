/**
 * lib/supabase.ts — Frontend Supabase client (anon key)
 *
 * Exports a single shared Supabase client for use throughout the frontend.
 * This client uses the PUBLIC anon key (not the service role key) so all
 * Row-Level Security (RLS) policies in Supabase are enforced normally.
 *
 * Used by:
 *   - AuthContext.tsx  — to manage sign-in/sign-out and session subscriptions
 *   - LoginForm.tsx    — to perform email/password and OAuth sign-in
 *
 * API requests (non-auth data) are NOT made through this client — they go
 * through the Express backend via apiClient.ts, which carries the user's JWT
 * in an Authorization header.
 *
 * Required environment variables (set in web/.env):
 *   VITE_SUPABASE_URL          — the Supabase project URL
 *   VITE_SUPABASE_ANON_KEY     — the Supabase project's public anon key
 */

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// Warn loudly in development if env vars are missing; the app will still boot
// but auth calls will fail with network errors.
if (!supabaseUrl || !supabaseAnonKey) {
  // eslint-disable-next-line no-console
  console.warn(
    'Supabase env vars are missing. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in web/.env'
  )
}

export const supabase = createClient(supabaseUrl ?? '', supabaseAnonKey ?? '')
