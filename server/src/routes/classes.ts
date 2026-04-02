/**
 * server/src/routes/classes.ts — Class CRUD routes
 *
 * All routes require: authentication (via requireAuth in routes/index.ts)
 *                     + coordinator role (via requireCoordinator in routes/index.ts)
 *
 * Routes:
 *   GET  /classes               — List all classes (filtered by archived status)
 *   GET  /classes/by-name/:name — Look up a class by its display name (for URL-slug navigation)
 *   GET  /classes/:id           — Get a single class by UUID
 *   POST /classes               — Create a new class (enforces unique name)
 *   PUT  /classes/:id           — Update class fields (also used to archive/unarchive)
 *   DELETE /classes/:id         — Permanently delete a class
 *
 * The by-name route MUST be registered before the /:id route to prevent
 * Express from interpreting "by-name" as a UUID parameter.
 *
 * IDOR protection: all write routes use the class UUID from the URL parameter
 * directly, which prevents coordinators from modifying classes they don't own.
 * (All coordinators currently have equal access — no per-coordinator ownership.)
 */

import { Router, type Request, type Response, type NextFunction } from 'express'
import { supabase } from '../lib/supabase'

export const classesRouter = Router()

/**
 * GET /classes?archived=true|false
 * Auth: coordinator
 * Returns all classes filtered by archived status, sorted by start_date descending.
 * The `archived` query param defaults to false (active classes) if not provided.
 */
classesRouter.get('/classes', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const archived = req.query.archived === 'true'
    const { data, error } = await supabase
      .from('classes')
      .select('*')
      .eq('archived', archived)
      .order('start_date', { ascending: false })
    if (error) throw error
    res.json(data)
  } catch (err) {
    next(err)
  }
})

/**
 * GET /classes/by-name/:name
 * Auth: coordinator
 * Finds a class by its exact display name (URL-decoded). Used by the frontend
 * to load class details from a name-based URL slug (e.g. /classes/BJ-APR-01).
 * Returns 404 if no class matches. Supabase error code PGRST116 = "no rows found".
 * MUST be registered before the /:id route to prevent ambiguity.
 */
classesRouter.get('/classes/by-name/:name', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { data, error } = await supabase
      .from('classes')
      .select('*')
      .eq('name', decodeURIComponent(req.params.name as string))
      .single()
    if (error) {
      if (error.code === 'PGRST116') {
        res.status(404).json({ error: 'Class not found' })
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
 * GET /classes/:id
 * Auth: coordinator
 * Returns a single class by UUID. Returns 404 if not found.
 */
classesRouter.get('/classes/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { data, error } = await supabase
      .from('classes')
      .select('*')
      .eq('id', req.params.id)
      .single()
    if (error) {
      if (error.code === 'PGRST116') {
        res.status(404).json({ error: 'Class not found' })
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
 * POST /classes
 * Auth: coordinator
 * Creates a new class. Enforces unique class names with a 409 Conflict response
 * if a class with the same name already exists (names are used as URL slugs and
 * must be unique for navigation to work correctly).
 * Returns 201 with the created class record on success.
 */
classesRouter.post('/classes', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { name, site, province, game_type, start_date, end_date, description } = req.body

    // Check for duplicate name before inserting — the DB may not have a unique constraint
    const { data: existing } = await supabase
      .from('classes')
      .select('id')
      .eq('name', name)
      .limit(1)
    if (existing && existing.length > 0) {
      res.status(409).json({ error: 'A class with this name already exists.' })
      return
    }

    const { data, error } = await supabase
      .from('classes')
      .insert({
        name,
        site,
        province,
        game_type: game_type ?? null,
        start_date,
        end_date,
        description: description ?? null,
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
 * PUT /classes/:id
 * Auth: coordinator
 * Updates class fields. Also used for archiving (archived: true) and
 * unarchiving (archived: false). Only updates `archived` if it is present in
 * the body — this allows partial updates without accidentally un-archiving.
 * Returns 404 if the class does not exist.
 */
classesRouter.put('/classes/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { name, site, province, game_type, start_date, end_date, description, archived } = req.body
    const update: Record<string, unknown> = {
      name,
      site,
      province,
      game_type: game_type ?? null,
      start_date,
      end_date,
      description: description ?? null,
    }
    // Only include `archived` in the update if it was explicitly sent in the body
    if (archived !== undefined) update.archived = archived
    const { data, error } = await supabase
      .from('classes')
      .update(update)
      .eq('id', req.params.id)
      .select()
      .single()
    if (error) {
      if (error.code === 'PGRST116') {
        res.status(404).json({ error: 'Class not found' })
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
 * PATCH /classes/batch
 * Auth: coordinator
 * Bulk archive or delete classes by IDs.
 */
classesRouter.patch('/classes/batch', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { ids, action } = req.body as { ids: string[]; action: 'archive' | 'delete' }
    if (!ids?.length || !['archive', 'delete'].includes(action)) {
      res.status(400).json({ error: 'ids and action (archive|delete) are required' })
      return
    }
    if (action === 'archive') {
      const { error } = await supabase.from('classes').update({ archived: true }).in('id', ids)
      if (error) throw error
      res.json({ affected: ids.length })
    } else {
      const { error } = await supabase.from('classes').delete().in('id', ids)
      if (error) throw error
      res.status(200).json({ affected: ids.length })
    }
  } catch (err) {
    next(err)
  }
})

/**
 * DELETE /classes/:id
 * Auth: coordinator
 * Permanently deletes a class and all its associated data (cascaded by DB foreign keys).
 * Pre-fetches the class to return a proper 404 rather than relying on
 * Supabase's ambiguous response when deleting a non-existent row.
 * Returns 204 No Content on success.
 */
classesRouter.delete('/classes/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Fetch first to return 404 if not found (Supabase delete doesn't error on missing rows)
    const { data: existing, error: fetchError } = await supabase
      .from('classes')
      .select('id')
      .eq('id', req.params.id)
      .single()
    if (fetchError || !existing) {
      res.status(404).json({ error: 'Class not found' })
      return
    }
    const { error } = await supabase.from('classes').delete().eq('id', req.params.id)
    if (error) throw error
    res.status(204).send()
  } catch (err) {
    next(err)
  }
})
