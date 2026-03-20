/**
 * server/src/routes/trainers.ts — Class trainer CRUD routes
 *
 * All routes require: authentication (via requireAuth in routes/index.ts)
 *                     + coordinator role (via requireCoordinator in routes/index.ts)
 *
 * Routes:
 *   GET    /classes/:classId/trainers       — List all trainers assigned to a class
 *   POST   /classes/:classId/trainers       — Assign a trainer to a class
 *   PUT    /classes/:classId/trainers/:id   — Update a trainer's name, email, or role
 *   DELETE /classes/:classId/trainers/:id   — Remove a trainer from a class
 *
 * Trainer records in `class_trainers` are snapshots: the name and email are copied
 * at assignment time (from the Supabase `profiles` table) and stored directly on
 * the record. This means trainer records remain accurate even if a user updates
 * their profile later.
 *
 * IDOR protection: the classId URL parameter is matched in all write queries
 * so coordinators cannot modify trainers belonging to a different class.
 */

import { Router, type Request, type Response, type NextFunction } from 'express'
import { supabase } from '../lib/supabase'

export const trainersRouter = Router()

/**
 * GET /classes/:classId/trainers
 * Auth: coordinator
 * Returns all trainer records for the specified class, sorted newest first.
 */
trainersRouter.get('/classes/:classId/trainers', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { data, error } = await supabase
      .from('class_trainers')
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
 * POST /classes/:classId/trainers
 * Auth: coordinator
 * Assigns a trainer to a class by creating a snapshot record with the trainer's
 * name, email, and role (e.g. "Lead Trainer", "Assistant Trainer").
 * Returns 201 with the created trainer record.
 */
trainersRouter.post('/classes/:classId/trainers', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { trainer_name, trainer_email, role } = req.body
    const { data, error } = await supabase
      .from('class_trainers')
      .insert({
        class_id: req.params.classId,
        trainer_name,
        trainer_email,
        role,
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
 * PUT /classes/:classId/trainers/:id
 * Auth: coordinator
 * Updates the trainer's snapshot fields (name, email, role). Both the trainer UUID
 * and classId are matched in the query (IDOR protection). Returns 404 if either
 * doesn't match. Supabase error code PGRST116 = "no rows found".
 */
trainersRouter.put('/classes/:classId/trainers/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { trainer_name, trainer_email, role } = req.body
    const { data, error } = await supabase
      .from('class_trainers')
      .update({ trainer_name, trainer_email, role })
      .eq('id', req.params.id)
      .eq('class_id', req.params.classId)
      .select()
      .single()
    if (error) {
      if (error.code === 'PGRST116') {
        res.status(404).json({ error: 'Trainer not found' })
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
 * DELETE /classes/:classId/trainers/:id
 * Auth: coordinator
 * Removes a trainer from a class. Pre-fetches using both id and class_id to return
 * a proper 404 (Supabase delete doesn't error on missing rows). The classId match
 * also prevents cross-class deletion (IDOR protection).
 * Returns 204 No Content on success.
 */
trainersRouter.delete('/classes/:classId/trainers/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { data: existing, error: fetchError } = await supabase
      .from('class_trainers')
      .select('id')
      .eq('id', req.params.id)
      .eq('class_id', req.params.classId)
      .single()
    if (fetchError || !existing) {
      res.status(404).json({ error: 'Trainer not found' })
      return
    }
    const { error } = await supabase.from('class_trainers').delete().eq('id', req.params.id)
    if (error) throw error
    res.status(204).send()
  } catch (err) {
    next(err)
  }
})
