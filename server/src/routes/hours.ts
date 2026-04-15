/**
 * server/src/routes/hours.ts — Logged hours CRUD routes
 *
 * All routes require: authentication (via requireAuth in routes/index.ts)
 *                     + coordinator role (via requireCoordinator in routes/index.ts)
 *
 * Routes:
 *   GET    /classes/:classId/hours         — List all logged hours for a class
 *   POST   /classes/:classId/hours         — Log hours for a trainer or enrolled student
 *   PUT    /classes/:classId/hours/:id     — Update a logged hours record
 *   DELETE /classes/:classId/hours/:id     — Permanently delete a logged hours record
 *
 * Each logged hours record refers to either a trainer (`trainer_id` set, `enrollment_id`
 * null) or an enrolled student (`enrollment_id` set, `trainer_id` null). These fields
 * are mutually exclusive — `person_type` ('trainer' | 'trainee') signals which one.
 *
 * The `paid` flag marks hours as payable (used for payroll totals). The `live_training`
 * flag distinguishes live-training hours from preparatory or administrative time.
 * The `hours` field is validated server-side (0–24) on every write because it feeds
 * into payroll calculations where bad values could cause significant errors.
 *
 * All write operations are audit-logged to the `audit_logs` table via logAudit()
 * so changes to sensitive payroll-adjacent records can be traced.
 *
 * IDOR protection: classId is matched in all write queries so coordinators cannot
 * modify hours records belonging to a different class.
 */

import { Router, type Request, type Response, type NextFunction } from 'express'
import { supabase } from '../lib/supabase'
import { logAudit } from '../lib/audit'
import { writeLimiter } from '../middleware/rateLimiter'

export const hoursRouter = Router()

/**
 * GET /classes/:classId/hours
 * Auth: coordinator
 * Returns all logged hours records for a class, sorted by log_date descending
 * then created_at descending (most recently entered first within the same day).
 */
hoursRouter.get('/classes/:classId/hours', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { data, error } = await supabase
      .from('class_logged_hours')
      .select('*')
      .eq('class_id', req.params.classId)
      .order('log_date', { ascending: false })
      .order('created_at', { ascending: false })
    if (error) throw error
    res.json(data)
  } catch (err) {
    next(err)
  }
})

/**
 * POST /classes/:classId/hours
 * Auth: coordinator
 * Logs hours for a trainer or enrolled student. The `person_type` field indicates
 * which — 'trainer' uses trainer_id, 'trainee' uses enrollment_id (mutually exclusive).
 * `hours` is validated server-side (0–24) before inserting to protect payroll accuracy.
 * The operation is audit-logged (CREATE). Returns 201 with the created record.
 */
hoursRouter.post('/classes/:classId/hours', writeLimiter, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { log_date, person_type, trainer_id, enrollment_id, hours, paid, live_training, notes } =
      req.body

    // Validate hours is a non-negative number — important for payroll accuracy
    if (hours === undefined || typeof hours !== 'number' || hours < 0 || hours > 24) {
      res.status(400).json({ error: 'hours must be a number between 0 and 24' })
      return
    }

    const { data, error } = await supabase
      .from('class_logged_hours')
      .insert({
        class_id: req.params.classId,
        log_date,
        person_type,
        trainer_id: trainer_id ?? null,
        enrollment_id: enrollment_id ?? null,
        hours,
        paid: paid ?? false,
        live_training: live_training ?? false,
        notes: notes ?? null,
      })
      .select()
      .single()
    if (error) throw error

    await logAudit({
      userId: req.userId!,
      action: 'CREATE',
      tableName: 'class_logged_hours',
      recordId: (data as { id: string }).id,
      metadata: { class_id: req.params.classId, hours, paid, person_type },
      ipAddress: req.ip,
    })

    res.status(201).json(data)
  } catch (err) {
    next(err)
  }
})

/**
 * PUT /classes/:classId/hours/:id
 * Auth: coordinator
 * Updates a logged hours record. `hours` is validated (0–24) if provided. Both the
 * record UUID and classId are matched in the query (IDOR protection). Returns 404 if
 * either doesn't match. The operation is audit-logged (UPDATE).
 * Supabase error code PGRST116 = "no rows found".
 */
hoursRouter.put('/classes/:classId/hours/:id', writeLimiter, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { log_date, person_type, trainer_id, enrollment_id, hours, paid, live_training, notes } =
      req.body

    // Validate hours is a non-negative number — important for payroll accuracy
    if (hours !== undefined && (typeof hours !== 'number' || hours < 0 || hours > 24)) {
      res.status(400).json({ error: 'hours must be a number between 0 and 24' })
      return
    }

    const { data, error } = await supabase
      .from('class_logged_hours')
      .update({
        log_date,
        person_type,
        trainer_id: trainer_id ?? null,
        enrollment_id: enrollment_id ?? null,
        hours,
        paid: paid ?? false,
        live_training: live_training ?? false,
        notes: notes ?? null,
      })
      .eq('id', req.params.id)
      .eq('class_id', req.params.classId)
      .select()
      .single()
    if (error) {
      if (error.code === 'PGRST116') {
        res.status(404).json({ error: 'Hours record not found' })
        return
      }
      throw error
    }

    await logAudit({
      userId: req.userId!,
      action: 'UPDATE',
      tableName: 'class_logged_hours',
      recordId: req.params.id as string,
      metadata: { class_id: req.params.classId, hours, paid, person_type },
      ipAddress: req.ip,
    })

    res.json(data)
  } catch (err) {
    next(err)
  }
})

/**
 * DELETE /classes/:classId/hours/:id
 * Auth: coordinator
 * Permanently deletes a logged hours record. The audit log entry is written BEFORE
 * the delete so the record ID is still valid at the time of logging. Pre-fetches
 * using both id and class_id to return a proper 404 and enforce IDOR protection.
 * Returns 204 No Content on success.
 */
hoursRouter.delete('/classes/:classId/hours/:id', writeLimiter, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { data: existing, error: fetchError } = await supabase
      .from('class_logged_hours')
      .select('id')
      .eq('id', req.params.id)
      .eq('class_id', req.params.classId)
      .single()
    if (fetchError || !existing) {
      res.status(404).json({ error: 'Hours record not found' })
      return
    }

    await logAudit({
      userId: req.userId!,
      action: 'DELETE',
      tableName: 'class_logged_hours',
      recordId: req.params.id as string,
      metadata: { class_id: req.params.classId },
      ipAddress: req.ip,
    })

    const { error } = await supabase.from('class_logged_hours').delete().eq('id', req.params.id)
    if (error) throw error
    res.status(204).send()
  } catch (err) {
    next(err)
  }
})
