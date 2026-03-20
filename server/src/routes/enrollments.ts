/**
 * server/src/routes/enrollments.ts — Student enrollment CRUD routes
 *
 * All routes require: authentication (via requireAuth in routes/index.ts)
 *                     + coordinator role (via requireCoordinator in routes/index.ts)
 *
 * Routes:
 *   GET    /classes/:classId/enrollments            — List enrollments (optionally filtered by status)
 *   POST   /classes/:classId/enrollments            — Enroll a student in a class
 *   PUT    /classes/:classId/enrollments/:id        — Update enrollment status or group label
 *   DELETE /classes/:classId/enrollments/:id        — Remove an enrollment from a class
 *
 * Enrollment statuses: 'enrolled' | 'waitlisted' | 'withdrawn' | 'completed'
 * The GET route accepts an optional `?status=` query param to filter by status.
 * For example, GET /classes/:classId/enrollments?status=enrolled returns only
 * active enrollees (used when building the progress table in reports).
 *
 * IDOR protection: the classId URL parameter is matched in all write queries
 * so coordinators cannot modify enrollments belonging to a different class.
 */

import { Router, type Request, type Response, type NextFunction } from 'express'
import { supabase } from '../lib/supabase'

export const enrollmentsRouter = Router()

/**
 * GET /classes/:classId/enrollments?status=<status>
 * Auth: coordinator
 * Returns all enrollments for the specified class, sorted newest first.
 * Optional `?status=` query param filters by enrollment status
 * (e.g. `?status=enrolled` returns only active enrollees).
 * If no status param is given, all enrollments regardless of status are returned.
 */
enrollmentsRouter.get('/classes/:classId/enrollments', async (req: Request, res: Response, next: NextFunction) => {
  try {
    let query = supabase
      .from('class_enrollments')
      .select('*')
      .eq('class_id', req.params.classId)
      .order('created_at', { ascending: false })

    if (req.query.status) {
      query = query.eq('status', req.query.status as string)
    }

    const { data, error } = await query
    if (error) throw error
    res.json(data)
  } catch (err) {
    next(err)
  }
})

/**
 * POST /classes/:classId/enrollments
 * Auth: coordinator
 * Enrolls a student in a class. `group_label` is optional and used to assign
 * a student to a specific training group (e.g. "Group A").
 * Returns 201 with the created enrollment record.
 */
enrollmentsRouter.post('/classes/:classId/enrollments', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { student_name, student_email, status, group_label } = req.body
    const { data, error } = await supabase
      .from('class_enrollments')
      .insert({
        class_id: req.params.classId,
        student_name,
        student_email,
        status,
        group_label: group_label ?? null,
      })
      .select()
      .single()
    if (error) throw error
    res.status(201).json(data)
  } catch (err) {
    next(err)
  }
})

/**
 * PUT /classes/:classId/enrollments/:id
 * Auth: coordinator
 * Updates enrollment status (e.g. 'enrolled' → 'withdrawn') or the group label.
 * Note: student_name and student_email are snapshot fields set on creation and
 * are intentionally not updatable here — the snapshot captures who enrolled.
 * Both enrollment UUID and classId are matched in the query (IDOR protection).
 * Returns 404 if either doesn't match. Supabase error code PGRST116 = "no rows found".
 */
enrollmentsRouter.put('/classes/:classId/enrollments/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { status, group_label } = req.body
    const { data, error } = await supabase
      .from('class_enrollments')
      .update({ status, group_label: group_label ?? null })
      .eq('id', req.params.id)
      .eq('class_id', req.params.classId)
      .select()
      .single()
    if (error) {
      if (error.code === 'PGRST116') {
        res.status(404).json({ error: 'Enrollment not found' })
        return
      }
      throw error
    }
    res.json(data)
  } catch (err) {
    next(err)
  }
})

/**
 * DELETE /classes/:classId/enrollments/:id
 * Auth: coordinator
 * Permanently removes an enrollment. Pre-fetches using both id and class_id to
 * return a proper 404 (Supabase delete doesn't error on missing rows). The
 * classId match also prevents cross-class deletion (IDOR protection).
 * Returns 204 No Content on success.
 */
enrollmentsRouter.delete('/classes/:classId/enrollments/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { data: existing, error: fetchError } = await supabase
      .from('class_enrollments')
      .select('id')
      .eq('id', req.params.id)
      .eq('class_id', req.params.classId)
      .single()
    if (fetchError || !existing) {
      res.status(404).json({ error: 'Enrollment not found' })
      return
    }
    const { error } = await supabase.from('class_enrollments').delete().eq('id', req.params.id)
    if (error) throw error
    res.status(204).send()
  } catch (err) {
    next(err)
  }
})
