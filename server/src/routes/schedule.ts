/**
 * server/src/routes/schedule.ts — Class schedule slot CRUD routes
 *
 * All routes require: authentication (via requireAuth in routes/index.ts)
 *                     + coordinator role (via requireCoordinator in routes/index.ts)
 *
 * Routes:
 *   GET    /schedule                              — List upcoming slots across ALL classes (global view)
 *   GET    /classes/:classId/schedule             — List all slots for a specific class
 *   POST   /classes/:classId/schedule             — Add a new schedule slot to a class
 *   PUT    /classes/:classId/schedule/:id         — Update a schedule slot
 *   DELETE /classes/:classId/schedule/:id         — Delete a schedule slot
 *
 * The global GET /schedule route is used by the dashboard to show upcoming training
 * sessions across all classes in one place. It includes a joined `classes` object
 * (id, name, site) for display purposes and is limited to the next 200 upcoming slots.
 *
 * Schedule slots can optionally reference a trainer (trainer_id) and a group label
 * to filter which group of trainees the slot applies to.
 *
 * IDOR protection: the classId URL parameter is matched in all write queries
 * so coordinators cannot modify slots belonging to a different class.
 */

import { Router, type Request, type Response, type NextFunction } from 'express'
import { supabase } from '../lib/supabase'

export const scheduleRouter = Router()

/**
 * GET /schedule
 * Auth: coordinator
 * Returns upcoming schedule slots across all classes, joined with the parent class's
 * id, name, and site for display in a global calendar or dashboard.
 * Filtered to slots on or after today to exclude past sessions.
 * Sorted by date ascending then start_time ascending. Limited to 200 results.
 */
scheduleRouter.get('/schedule', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    // Compute today's date as an ISO string (YYYY-MM-DD) for the .gte() filter
    const today = new Date().toISOString().split('T')[0]
    const { data, error } = await supabase
      .from('class_schedule_slots')
      .select('*, classes(id, name, site)')
      .gte('slot_date', today)
      .order('slot_date', { ascending: true })
      .order('start_time', { ascending: true })
      .limit(200)
    if (error) throw error
    res.json(data)
  } catch (err) {
    next(err)
  }
})

/**
 * GET /classes/:classId/schedule
 * Auth: coordinator
 * Returns all schedule slots for a specific class (past and future), sorted by
 * date and start_time ascending. Used to display the full schedule in ClassScheduleSection.
 */
scheduleRouter.get('/classes/:classId/schedule', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { data, error } = await supabase
      .from('class_schedule_slots')
      .select('*')
      .eq('class_id', req.params.classId)
      .order('slot_date', { ascending: true })
      .order('start_time', { ascending: true })
    if (error) throw error
    res.json(data)
  } catch (err) {
    next(err)
  }
})

/**
 * POST /classes/:classId/schedule
 * Auth: coordinator
 * Creates a new schedule slot for the class. `trainer_id`, `notes`, and
 * `group_label` are optional. Returns 201 with the created slot record.
 */
scheduleRouter.post('/classes/:classId/schedule', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { slot_date, start_time, end_time, notes, trainer_id, group_label } = req.body
    const { data, error } = await supabase
      .from('class_schedule_slots')
      .insert({
        class_id: req.params.classId,
        slot_date,
        start_time,
        end_time,
        notes: notes ?? null,
        trainer_id: trainer_id ?? null,
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
 * PUT /classes/:classId/schedule/:id
 * Auth: coordinator
 * Updates a schedule slot's fields. Both the slot UUID and classId are matched in
 * the query (IDOR protection). Returns 404 if either doesn't match.
 * Supabase error code PGRST116 = "no rows found".
 */
scheduleRouter.put('/classes/:classId/schedule/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { slot_date, start_time, end_time, notes, trainer_id, group_label } = req.body
    const { data, error } = await supabase
      .from('class_schedule_slots')
      .update({
        slot_date,
        start_time,
        end_time,
        notes: notes ?? null,
        trainer_id: trainer_id ?? null,
        group_label: group_label ?? null,
      })
      .eq('id', req.params.id)
      .eq('class_id', req.params.classId)
      .select()
      .single()
    if (error) {
      if (error.code === 'PGRST116') {
        res.status(404).json({ error: 'Schedule slot not found' })
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
 * DELETE /classes/:classId/schedule/:id
 * Auth: coordinator
 * Permanently deletes a schedule slot. Pre-fetches using both id and class_id to
 * return a proper 404 (Supabase delete doesn't error on missing rows). The
 * classId match also prevents cross-class deletion (IDOR protection).
 * Returns 204 No Content on success.
 */
scheduleRouter.delete('/classes/:classId/schedule/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { data: existing, error: fetchError } = await supabase
      .from('class_schedule_slots')
      .select('id')
      .eq('id', req.params.id)
      .eq('class_id', req.params.classId)
      .single()
    if (fetchError || !existing) {
      res.status(404).json({ error: 'Schedule slot not found' })
      return
    }
    const { error } = await supabase.from('class_schedule_slots').delete().eq('id', req.params.id)
    if (error) throw error
    res.status(204).send()
  } catch (err) {
    next(err)
  }
})
