/**
 * server/src/routes/drills.ts — Drill CRUD routes
 *
 * All routes require: authentication (via requireAuth in routes/index.ts)
 *                     + coordinator role (via requireCoordinator in routes/index.ts)
 *
 * Routes:
 *   GET    /classes/:classId/drills         — List all drills for a class
 *   POST   /classes/:classId/drills         — Create a new drill for a class
 *   PUT    /classes/:classId/drills/:id     — Update a drill's fields or active status
 *   DELETE /classes/:classId/drills/:id     — Permanently delete a drill
 *
 * IDOR protection: the classId URL parameter is included in all write queries
 * (both .eq('id', ...) AND .eq('class_id', ...)), so a coordinator cannot
 * modify or delete a drill belonging to a different class by guessing its UUID.
 */

import { Router, type Request, type Response, type NextFunction } from 'express'
import { supabase } from '../lib/supabase'

export const drillsRouter = Router()

/**
 * GET /classes/:classId/drills
 * Auth: coordinator
 * Returns all drills for the specified class, sorted newest first.
 */
drillsRouter.get('/classes/:classId/drills', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { data, error } = await supabase
      .from('class_drills')
      .select('*')
      .eq('class_id', req.params.classId)
      .order('created_at', { ascending: false })
    if (error) throw error
    res.json(data)
  } catch (err) {
    next(err)
  }
})

/**
 * POST /classes/:classId/drills
 * Auth: coordinator
 * Creates a new drill for the class. `par_time_seconds` and `target_score` are optional
 * numeric fields (null if not provided). New drills start as active: true.
 * Returns 201 with the created drill record.
 */
drillsRouter.post('/classes/:classId/drills', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { name, type, par_time_seconds, target_score } = req.body
    const { data, error } = await supabase
      .from('class_drills')
      .insert({
        class_id: req.params.classId,
        name,
        type,
        par_time_seconds: par_time_seconds ?? null,
        target_score: target_score ?? null,
        active: true,
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
 * PUT /classes/:classId/drills/:id
 * Auth: coordinator
 * Updates a drill's fields. The `active` field can be used to deactivate a drill
 * without deleting it (so historical report data referencing the drill still resolves).
 * The classId is matched in the query (IDOR protection) — returns 404 if either the
 * drill ID or classId don't match. Supabase error code PGRST116 = "no rows found".
 */
drillsRouter.put('/classes/:classId/drills/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { name, type, par_time_seconds, target_score, active } = req.body
    const { data, error } = await supabase
      .from('class_drills')
      .update({ name, type, par_time_seconds, target_score, active })
      .eq('id', req.params.id)
      .eq('class_id', req.params.classId)
      .select()
      .single()
    if (error) {
      if (error.code === 'PGRST116') {
        res.status(404).json({ error: 'Drill not found' })
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
 * DELETE /classes/:classId/drills/:id
 * Auth: coordinator
 * Permanently deletes a drill. Pre-fetches using both id and class_id to return a
 * proper 404 (Supabase delete doesn't error on missing rows). The classId match
 * also prevents cross-class deletion (IDOR protection).
 * Returns 204 No Content on success.
 */
drillsRouter.delete('/classes/:classId/drills/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { data: existing, error: fetchError } = await supabase
      .from('class_drills')
      .select('id')
      .eq('id', req.params.id)
      .eq('class_id', req.params.classId)
      .single()
    if (fetchError || !existing) {
      res.status(404).json({ error: 'Drill not found' })
      return
    }
    const { error } = await supabase.from('class_drills').delete().eq('id', req.params.id)
    if (error) throw error
    res.status(204).send()
  } catch (err) {
    next(err)
  }
})
