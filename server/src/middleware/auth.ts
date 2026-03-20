import type { Request, Response, NextFunction } from 'express'
import { supabase } from '../lib/supabase'

declare global {
  namespace Express {
    interface Request {
      userId?: string
      userRole?: string
    }
  }
}

// Roles that can access payroll and background check data.
// Add 'payroll_admin' to a user's profile.role in the DB to grant access.
// Do NOT reuse the general 'coordinator' role for financial/HR data.
const PAYROLL_ROLES = new Set(['payroll_admin'])

export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const authHeader = req.headers.authorization
  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Missing or invalid Authorization header' })
    return
  }

  const token = authHeader.slice(7)
  const { data, error } = await supabase.auth.getUser(token)

  if (error || !data.user) {
    res.status(401).json({ error: 'Invalid or expired token' })
    return
  }

  req.userId = data.user.id

  // Attach role so downstream middleware can check it without an extra DB call
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', data.user.id)
    .single()
  req.userRole = profile?.role ?? undefined

  next()
}

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
