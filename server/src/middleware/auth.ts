/**
 * server/src/middleware/auth.ts — Authentication and authorisation middleware
 *
 * Provides three Express middleware functions that protect API routes:
 *
 *   requireAuth
 *     Validates the Bearer JWT from the Authorization header using Supabase's
 *     `auth.getUser()`. On success, attaches `req.userId` and `req.userRole`
 *     for downstream use. Returns 401 for missing/invalid tokens.
 *     Also performs a DB lookup to attach the user's role, so downstream
 *     middleware doesn't need an additional DB call.
 *
 *   requireCoordinator
 *     Checks that `req.userRole === 'coordinator'`. Must be called AFTER
 *     requireAuth (which sets req.userRole). Returns 403 for all other roles.
 *     Used to gate all class management routes.
 *
 *   requirePayrollAdmin
 *     A separate, stricter gate for future payroll/HR routes.
 *     The 'payroll_admin' role is distinct from 'coordinator' so sensitive
 *     financial data can be gated independently of general coordination access.
 *
 * Module augmentation:
 *   The `declare global` block extends Express's Request type to include
 *   `userId` and `userRole` properties, which TypeScript would otherwise
 *   reject as unknown properties on `req`.
 */

import type { Request, Response, NextFunction } from 'express'
import { supabase } from '../lib/supabase'

// Extend Express Request type to include our custom auth properties
declare global {
  namespace Express {
    interface Request {
      userId?: string    // Set by requireAuth — the Supabase user's UUID
      userRole?: string  // Set by requireAuth — the user's role from the profiles table
      userEmail?: string // Set by requireAuth — the Supabase user's email address
    }
  }
}

// Roles that can access payroll and background check data.
// Add 'payroll_admin' to a user's profile.role in the DB to grant access.
// Do NOT reuse the general 'coordinator' role for financial/HR data.
const PAYROLL_ROLES = new Set(['payroll_admin'])

/**
 * Validates the Bearer JWT in the Authorization header.
 * On success: attaches req.userId (UUID) and req.userRole (from profiles table).
 * On failure: responds with 401 and stops the middleware chain.
 *
 * This middleware makes two DB calls per request:
 *   1. supabase.auth.getUser(token)  — validates the JWT
 *   2. profiles.select('role')       — fetches the role (not in the JWT claims)
 */
export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const authHeader = req.headers.authorization
  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Missing or invalid Authorization header' })
    return
  }

  // Strip the "Bearer " prefix to get the raw JWT
  const token = authHeader.slice(7)
  const { data, error } = await supabase.auth.getUser(token)

  if (error || !data.user) {
    res.status(401).json({ error: 'Invalid or expired token' })
    return
  }

  req.userId = data.user.id
  req.userEmail = data.user.email

  // Attach role so downstream middleware (requireCoordinator) doesn't need
  // to make another DB call — one round-trip here covers all downstream checks
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', data.user.id)
    .single()
  req.userRole = profile?.role ?? undefined

  next()
}

/**
 * Guards routes to coordinator-only access.
 * Must be called after requireAuth (which sets req.userRole).
 * Returns 403 for trainers, trainees, and unauthenticated requests.
 */
export function requireCoordinator(req: Request, res: Response, next: NextFunction): void {
  if (req.userRole !== 'coordinator') {
    res.status(403).json({ error: 'Coordinator access required' })
    return
  }
  next()
}

/**
 * Gate for payroll and background check endpoints.
 * Apply this INSTEAD OF (not in addition to) requireCoordinator on sensitive financial/HR routes.
 *
 * Example:
 *   router.get('/payroll', requireAuth, requirePayrollAdmin, payrollHandler)
 *
 * To grant access: set profile.role = 'payroll_admin' in Supabase for the user.
 */
export function requirePayrollAdmin(req: Request, res: Response, next: NextFunction): void {
  if (!PAYROLL_ROLES.has(req.userRole ?? '')) {
    res.status(403).json({ error: 'Payroll admin access required' })
    return
  }
  next()
}
