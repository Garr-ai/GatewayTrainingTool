/**
 * server/src/routes/feedback.ts — Coordinator feedback inbox
 *
 * POST /me/feedback remains in selfService.ts so all authenticated users can
 * submit feedback. These coordinator-only routes provide inbox triage.
 */

import { Router, type Request, type Response, type NextFunction } from 'express'
import { supabase } from '../lib/supabase'
import { logAudit } from '../lib/audit'
import { writeLimiter } from '../middleware/rateLimiter'
import { feedbackStatusBodySchema, validateBody } from '../lib/validation'

export const feedbackRouter = Router()

const VALID_FEEDBACK_STATUS = new Set(['new', 'reviewing', 'resolved', 'archived'])
const VALID_FEEDBACK_CATEGORY = new Set(['bug', 'feature', 'general'])

feedbackRouter.get('/feedback', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { status, category, search, page: pageStr, limit: limitStr } = req.query as Record<string, string | undefined>

    if (status && !VALID_FEEDBACK_STATUS.has(status)) {
      res.status(400).json({ error: 'Invalid feedback status' })
      return
    }
    if (category && !VALID_FEEDBACK_CATEGORY.has(category)) {
      res.status(400).json({ error: 'Invalid feedback category' })
      return
    }

    const page = Math.max(0, Number(pageStr) || 0)
    const limit = Math.min(200, Math.max(1, Number(limitStr) || 25))
    const offset = page * limit

    let query = supabase
      .from('app_feedback')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (status) query = query.eq('status', status)
    if (category) query = query.eq('category', category)
    if (search) {
      const safeSearch = search.replace(/[(),"'\\]/g, '').slice(0, 100)
      query = query.or(`message.ilike.%${safeSearch}%,user_email.ilike.%${safeSearch}%,page.ilike.%${safeSearch}%`)
    }

    const { data, error, count } = await query
    if (error) throw error

    res.json({ data: data ?? [], total: count ?? 0, page, limit })
  } catch (err) {
    next(err)
  }
})

feedbackRouter.put('/feedback/:id/status', writeLimiter, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = validateBody(feedbackStatusBodySchema, req, res)
    if (!body) return
    const feedbackId = String(req.params.id)

    const { data: before, error: beforeError } = await supabase
      .from('app_feedback')
      .select('*')
      .eq('id', feedbackId)
      .single()
    if (beforeError || !before) {
      res.status(404).json({ error: 'Feedback not found' })
      return
    }

    const now = new Date().toISOString()
    const { data, error } = await supabase
      .from('app_feedback')
      .update({
        status: body.status,
        reviewed_by: req.userId!,
        reviewed_at: now,
        updated_at: now,
      })
      .eq('id', feedbackId)
      .select()
      .single()
    if (error) throw error

    await logAudit({
      userId: req.userId!,
      action: 'UPDATE',
      tableName: 'app_feedback',
      recordId: feedbackId,
      before: before as Record<string, unknown>,
      after: data as Record<string, unknown>,
      metadata: { status: body.status },
      ipAddress: req.ip,
    })

    res.json(data)
  } catch (err) {
    next(err)
  }
})
