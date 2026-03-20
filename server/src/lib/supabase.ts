/**
 * server/src/lib/supabase.ts — Backend Supabase client (service role key)
 *
 * Exports a single shared Supabase client for use by all route handlers.
 * This client uses the SERVICE ROLE KEY, which bypasses Row-Level Security (RLS)
 * and has unrestricted read/write access to all tables.
 *
 * IMPORTANT SECURITY NOTES:
 *   - Never expose this key to the browser or commit it to source control.
 *   - Access control is enforced by the Express middleware (requireAuth,
 *     requireCoordinator) in the route layer, NOT by Supabase RLS policies.
 *   - `persistSession: false` disables local session storage since this is a
 *     stateless server process — sessions are validated per-request via JWT.
 *
 * The server throws immediately on startup if the required env vars are missing
 * so misconfiguration is caught early rather than failing silently at runtime.
 *
 * Required environment variables (server/.env):
 *   SUPABASE_URL              — The Supabase project URL
 *   SUPABASE_SERVICE_ROLE_KEY — The service role key (keep secret)
 */

import { createClient } from '@supabase/supabase-js'
import 'dotenv/config'

const url = process.env.SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

// Fail fast on startup if the required env vars are missing
if (!url || !serviceKey) {
  throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in api/.env')
}

export const supabase = createClient(url, serviceKey, {
  // Disable session persistence — the server is stateless; each request provides its own JWT
  auth: { persistSession: false },
})
