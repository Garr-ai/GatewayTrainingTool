/**
 * server/src/routes/roleRequests.ts — Coordinator-only role request management
 *
 * Mounted AFTER requireCoordinator in routes/index.ts. Coordinators use these
 * endpoints to list, approve, and reject role change requests from users who
 * selected "Trainer" or "Coordinator" during registration.
 *
 * Routes:
 *   GET    /role-requests                 — List role requests (filterable by status)
 *   PUT    /role-requests/:id/approve     — Approve a request and update the user's role
 *   PUT    /role-requests/:id/reject      — Reject a request
 */

import { Router, type Request, type Response, type NextFunction } from 'express'
import { supabase } from '../lib/supabase'
import { logAudit } from '../lib/audit'

export const roleRequestsRouter = Router()

/**
 * GET /role-requests?status=pending&page=0&limit=25
 * Auth: coordinator
 * Returns paginated role requests with user profile info joined.
 */
roleRequestsRouter.get('/role-requests', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { status, page: pageStr, limit: limitStr } = req.query as Record<string, string | undefined>

    const page = Math.max(0, Number(pageStr) || 0)
    const limit = Math.min(200, Math.max(1, Number(limitStr) || 25))
    const offset = page * limit

    let query = supabase
      .from('role_requests')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (status) {
      query = query.eq('status', status)
    }

    const { data, error, count } = await query
    if (error) throw error

    // Fetch profile data for the returned users.
    // The role_requests FK points to auth.users (not profiles), so PostgREST
    // cannot traverse the join directly — we do a separate lookup instead.
    const userIds = (data ?? []).map((r: Record<string, unknown>) => r.user_id as string)
    const profileMap: Record<string, { full_name: string | null; email: string }> = {}
    if (userIds.length > 0) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name, email')
        .in('id', userIds)
      for (const p of profiles ?? []) {
        const prof = p as { id: string; full_name: string | null; email: string }
        profileMap[prof.id] = { full_name: prof.full_name, email: prof.email }
      }
    }

    const rows = (data ?? []).map((row: Record<string, unknown>) => {
      const profile = profileMap[row.user_id as string]
      return {
        id: row.id,
        user_id: row.user_id,
        requested_role: row.requested_role,
        status: row.status,
        reviewed_by: row.reviewed_by,
        created_at: row.created_at,
        updated_at: row.updated_at,
        user_name: profile?.full_name ?? null,
        user_email: profile?.email ?? '',
      }
    })

    res.json({ data: rows, total: count ?? 0, page, limit })
  } catch (err) {
    next(err)
  }
})

/**
 * PUT /role-requests/:id/approve
 * Auth: coordinator
 * Approves a pending role request: updates the request status and changes
 * the user's profile role to the requested role.
 */
roleRequestsRouter.put('/role-requests/:id/approve', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const requestId = req.params.id as string

    // Fetch the request
    const { data: roleRequest, error: fetchError } = await supabase
      .from('role_requests')
      .select('*')
      .eq('id', requestId)
      .eq('status', 'pending')
      .single()

    if (fetchError || !roleRequest) {
      res.status(404).json({ error: 'Pending role request not found.' })
      return
    }

    const rr = roleRequest as { id: string; user_id: string; requested_role: string }

    // Update request status
    const { error: updateError } = await supabase
      .from('role_requests')
      .update({ status: 'approved', reviewed_by: req.userId!, updated_at: new Date().toISOString() })
      .eq('id', requestId)
    if (updateError) throw updateError

    // Update the user's profile role
    const { error: profileError } = await supabase
      .from('profiles')
      .update({ role: rr.requested_role })
      .eq('id', rr.user_id)
    if (profileError) throw profileError

    await logAudit({
      userId: req.userId!,
      action: 'UPDATE',
      tableName: 'role_requests',
      recordId: requestId,
      metadata: { action: 'approve', requested_role: rr.requested_role, target_user: rr.user_id },
      ipAddress: req.ip as string,
    })

    res.json({ id: requestId, status: 'approved', requested_role: rr.requested_role })
  } catch (err) {
    next(err)
  }
})

/**
 * PUT /role-requests/:id/reject
 * Auth: coordinator
 * Rejects a pending role request. The user stays as a trainee.
 */
roleRequestsRouter.put('/role-requests/:id/reject', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const requestId = req.params.id as string

    const { data: roleRequest, error: fetchError } = await supabase
      .from('role_requests')
      .select('id, user_id, requested_role')
      .eq('id', requestId)
      .eq('status', 'pending')
      .single()

    if (fetchError || !roleRequest) {
      res.status(404).json({ error: 'Pending role request not found.' })
      return
    }

    const rr = roleRequest as { id: string; user_id: string; requested_role: string }

    const { error: updateError } = await supabase
      .from('role_requests')
      .update({ status: 'rejected', reviewed_by: req.userId!, updated_at: new Date().toISOString() })
      .eq('id', requestId)
    if (updateError) throw updateError

    await logAudit({
      userId: req.userId!,
      action: 'UPDATE',
      tableName: 'role_requests',
      recordId: requestId,
      metadata: { action: 'reject', requested_role: rr.requested_role, target_user: rr.user_id },
      ipAddress: req.ip as string,
    })

    res.json({ id: requestId, status: 'rejected', requested_role: rr.requested_role })
  } catch (err) {
    next(err)
  }
})
