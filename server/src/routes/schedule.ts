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

/** Columns that can be used in the sort_by query param. */
const SORTABLE_COLUMNS = new Set(['slot_date', 'start_time'])

/**
 * GET /schedule
 * Auth: coordinator
 *
 * Returns schedule slots across all classes with server-side filtering,
 * sorting, and pagination. The response includes a total count for pagination.
 *
 * Query params:
 *   province   — filter by class province (BC|AB|ON)
 *   site       — filter by class site (exact match)
 *   class_id   — filter to a single class
 *   archived   — 'true' to include archived classes, default 'false' (active only)
 *   game_type  — filter by class game_type
 *   date_from  — slots on or after this date (YYYY-MM-DD), defaults to today
 *   date_to    — slots on or before this date (YYYY-MM-DD)
 *   group_label — filter by group label
 *   search     — free-text search on class name and notes
 *   sort_by    — column to sort by (slot_date|start_time)
 *   sort_dir   — 'asc' or 'desc' (default 'asc')
 *   page       — 0-indexed page number (default 0)
 *   limit      — rows per page, 1-200 (default 50)
 */
scheduleRouter.get('/schedule', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const {
      province,
      site,
      class_id,
      archived,
      game_type,
      date_from,
      date_to,
      group_label,
      search,
      sort_by,
      sort_dir,
      page: pageStr,
      limit: limitStr,
    } = req.query as Record<string, string | undefined>

    // Pagination
    const limit = Math.min(Math.max(Number(limitStr) || 50, 1), 200)
    const page = Math.max(Number(pageStr) || 0, 0)
    const offset = page * limit

    // Sorting — whitelist columns to prevent injection
    const sortColumn = SORTABLE_COLUMNS.has(sort_by ?? '') ? sort_by! : 'slot_date'
    const ascending = sort_dir !== 'desc'

    // Build query with inner join so filters on classes.* actually exclude rows
    const query = supabase
      .from('class_schedule_slots')
      .select('*, classes!inner(id, name, site, province, game_type, archived), class_trainers(id, trainer_name, role)', { count: 'exact' })

    // --- Filters on the joined classes table ---
    if (province) query.eq('classes.province', province)
    if (site) query.eq('classes.site', site)
    if (game_type) query.eq('classes.game_type', game_type)
    // When archived is 'true', include ALL classes (active + archived).
    // When absent or 'false', restrict to active classes only.
    if (archived !== 'true') query.eq('classes.archived', false)

    // --- Filters on the schedule table ---
    if (class_id) query.eq('class_id', class_id)
    if (group_label) query.eq('group_label', group_label)

    // Date range — default date_from to today if not provided
    const today = new Date().toISOString().split('T')[0]
    query.gte('slot_date', date_from || today)
    if (date_to) query.lte('slot_date', date_to)

    // Free-text search on schedule notes
    if (search) {
      const pattern = `%${search}%`
      query.or(`notes.ilike.${pattern}`)
    }

    // Sorting and pagination
    query.order(sortColumn, { ascending })
    if (sortColumn !== 'start_time') query.order('start_time', { ascending: true })
    query.range(offset, offset + limit - 1)

    const { data, error, count } = await query
    if (error) throw error

    // If searching by class name, do client-side filter since
    // Supabase .or() doesn't reliably support ilike on joined columns
    let filtered = data ?? []
    if (search) {
      const lower = search.toLowerCase()
      filtered = filtered.filter(
        (r: Record<string, unknown>) => {
          const classes = r.classes as { name: string } | null
          const notes = r.notes as string | null
          return (
            classes?.name?.toLowerCase().includes(lower) ||
            notes?.toLowerCase().includes(lower)
          )
        },
      )
    }

    res.json({
      data: filtered,
      total: count ?? 0,
      page,
      limit,
    })
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
