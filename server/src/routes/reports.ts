/**
 * server/src/routes/reports.ts — Daily report CRUD routes
 *
 * All routes require: authentication (via requireAuth in routes/index.ts)
 *                     + coordinator role (via requireCoordinator in routes/index.ts)
 *
 * Routes:
 *   GET    /reports                              — List all reports across all classes (global view)
 *   GET    /classes/:classId/reports             — List all reports for a specific class
 *   GET    /reports/:id                          — Get a single report with all nested data
 *   POST   /classes/:classId/reports             — Create a report with trainer links, timeline, and progress
 *   PUT    /classes/:classId/reports/:id         — Replace a report and all its nested data
 *   DELETE /classes/:classId/reports/:id         — Permanently delete a report
 *
 * Reports have four nested tables that are stored separately:
 *   - class_daily_report_trainers         (many-to-many link to class_trainers)
 *   - class_daily_report_timeline_items   (ordered activity timeline for the session)
 *   - class_daily_report_trainee_progress (per-trainee progress ratings and notes)
 *   - class_daily_report_drill_times      (per-student drill/test time and score recordings)
 *
 * The GET /reports/:id route fetches all four tables in parallel (Promise.all) and
 * merges them into a single response object for the frontend.
 *
 * PUT uses a full replace strategy for nested data: all existing rows for the
 * report are deleted and re-inserted. This avoids complex diff logic and ensures
 * the saved state always matches what the user submitted.
 *
 * Write operations (POST, PUT, DELETE) are audit-logged to the `audit_logs` table
 * via logAudit() so changes to sensitive training records can be traced.
 *
 * Override fields (override_hours_to_date, override_paid_hours_total,
 * override_live_hours_total) allow coordinators to manually correct computed totals
 * when the logged hours don't reflect reality (e.g. late data entry).
 *
 * IDOR protection: classId is matched in all write queries so coordinators cannot
 * modify reports belonging to a different class.
 */

import { Router, type Request, type Response, type NextFunction } from 'express'
import { supabase } from '../lib/supabase'
import { logAudit } from '../lib/audit'
import { autoFailNotComingBack } from '../lib/autoFail'
import { writeLimiter } from '../middleware/rateLimiter'
import { reportBodySchema, validateBody } from '../lib/validation'

export const reportsRouter = Router()

/** Columns that can be used in the sort_by query param. */
const SORTABLE_COLUMNS = new Set(['report_date', 'game', 'current_trainees'])

/**
 * GET /reports
 * Auth: coordinator
 *
 * Returns daily reports across all classes with server-side filtering,
 * sorting, and pagination. The response includes a total count so the
 * frontend can render pagination controls.
 *
 * Query params:
 *   province   — filter by class province (BC|AB|ON)
 *   site       — filter by class site (exact match)
 *   class_id   — filter to a single class
 *   archived   — 'true' to include archived classes only, default 'false'
 *   game_type  — filter by class game_type
 *   date_from  — reports on or after this date (YYYY-MM-DD)
 *   date_to    — reports on or before this date (YYYY-MM-DD)
 *   search     — free-text search on game, session_label, and class name
 *   sort_by    — column to sort by (report_date|game|current_trainees)
 *   sort_dir   — 'asc' or 'desc' (default 'desc')
 *   page       — 0-indexed page number (default 0)
 *   limit      — rows per page, 1-200 (default 50)
 */
reportsRouter.get('/reports', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const {
      province,
      site,
      class_id,
      archived,
      game_type,
      date_from,
      date_to,
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
    const sortColumn = SORTABLE_COLUMNS.has(sort_by ?? '') ? sort_by! : 'report_date'
    const ascending = sort_dir === 'asc'

    // Build query with inner join so filters on classes.* actually exclude rows
    const query = supabase
      .from('class_daily_reports')
      .select('*, classes!inner(id, name, site, province, game_type, archived)', { count: 'exact' })

    // --- Filters on the joined classes table ---
    if (province) query.eq('classes.province', province)
    if (site) query.eq('classes.site', site)
    if (game_type) query.eq('classes.game_type', game_type)
    // When archived is 'true', include ALL classes (active + archived).
    // When archived is absent or 'false', restrict to active classes only.
    if (archived !== 'true') query.eq('classes.archived', false)

    // --- Filters on the reports table ---
    if (class_id) query.eq('class_id', class_id)
    if (date_from) query.gte('report_date', date_from)
    if (date_to) query.lte('report_date', date_to)
    // Free-text search on report fields + class name
    if (search) {
      const pattern = `%${search}%`
      query.or(`game.ilike.${pattern},session_label.ilike.${pattern}`)
    }

    // Sorting and pagination
    query.order(sortColumn, { ascending })
    query.range(offset, offset + limit - 1)

    const { data, error, count } = await query
    if (error) throw error

    // If searching by class name, do a secondary client-side filter since
    // Supabase .or() doesn't reliably support ilike on joined columns
    let filtered = data ?? []
    if (search) {
      const lower = search.toLowerCase()
      filtered = filtered.filter(
        (r: Record<string, unknown>) => {
          const classes = r.classes as { name: string } | null
          const game = r.game as string | null
          const session = r.session_label as string | null
          return (
            classes?.name?.toLowerCase().includes(lower) ||
            game?.toLowerCase().includes(lower) ||
            session?.toLowerCase().includes(lower)
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
 * GET /classes/:classId/reports
 * Auth: coordinator
 * Returns all daily reports for a specific class, sorted by report_date descending.
 * Does NOT include nested trainer_ids, timeline, or progress — those are fetched
 * separately via GET /reports/:id when the user opens a report for editing or viewing.
 */
reportsRouter.get('/classes/:classId/reports', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { data, error } = await supabase
      .from('class_daily_reports')
      .select('*')
      .eq('class_id', req.params.classId)
      .order('report_date', { ascending: false })
    if (error) throw error
    res.json(data)
  } catch (err) {
    next(err)
  }
})

/**
 * GET /reports/:id
 * Auth: coordinator
 * Returns a single report with all nested data merged into one response:
 *   - trainer_ids: array of trainer UUIDs (extracted from class_daily_report_trainers)
 *   - timeline: array of timeline items ordered by position then start_time
 *   - progress: array of trainee progress rows
 * All four tables are fetched in parallel with Promise.all for efficiency.
 * Returns 404 if the report does not exist (PGRST116 = "no rows found").
 */
reportsRouter.get('/reports/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id
    const [
      { data: report, error: reportError },
      { data: trainerLinks },
      { data: timeline },
      { data: progress },
      { data: drillTimes, error: drillTimesError },
    ] = await Promise.all([
      supabase.from('class_daily_reports').select('*').eq('id', id).single(),
      supabase.from('class_daily_report_trainers').select('trainer_id').eq('report_id', id),
      supabase
        .from('class_daily_report_timeline_items')
        .select('*')
        .eq('report_id', id)
        .order('position', { ascending: true })
        .order('start_time', { ascending: true }),
      supabase.from('class_daily_report_trainee_progress').select('*').eq('report_id', id),
      supabase.from('class_daily_report_drill_times').select('*').eq('report_id', id),
    ])

    if (reportError) {
      if (reportError.code === 'PGRST116') {
        res.status(404).json({ error: 'Report not found' })
        return
      }
      throw reportError
    }
    if (drillTimesError) throw drillTimesError

    res.json({
      ...report,
      trainer_ids: (trainerLinks ?? []).map((t: { trainer_id: string }) => t.trainer_id),
      timeline: timeline ?? [],
      progress: progress ?? [],
      drill_times: drillTimes ?? [],
    })
  } catch (err) {
    next(err)
  }
})

/**
 * POST /classes/:classId/reports
 * Auth: coordinator
 * Creates a new daily report with optional nested trainer links, timeline items,
 * and trainee progress rows. The main report row is inserted first to get its UUID,
 * then nested inserts use that UUID as their foreign key (report_id).
 *
 * Timeline items are assigned a `position` equal to their array index to preserve
 * drag-and-drop ordering from the frontend.
 *
 * The operation is audit-logged (CREATE) with the class_id and report_date in metadata.
 * Returns 201 with the created report record (without nested data).
 */
reportsRouter.post('/classes/:classId/reports', writeLimiter, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = validateBody(reportBodySchema, req, res)
    if (!body) return
    const {
      report_date,
      group_label,
      game,
      session_label,
      class_start_time,
      class_end_time,
      mg_confirmed,
      mg_attended,
      current_trainees,
      licenses_received,
      override_hours_to_date,
      override_paid_hours_total,
      override_live_hours_total,
      coordinator_notes,
      trainer_ids = [],
      timeline = [],
      progress = [],
      drill_times = [],
    } = body

    const { data: report, error: reportError } = await supabase
      .from('class_daily_reports')
      .insert({
        class_id: req.params.classId,
        report_date,
        group_label: group_label ?? null,
        game: game ?? null,
        session_label: session_label ?? null,
        class_start_time: class_start_time ?? null,
        class_end_time: class_end_time ?? null,
        mg_confirmed: mg_confirmed ?? null,
        mg_attended: mg_attended ?? null,
        current_trainees: current_trainees ?? null,
        licenses_received: licenses_received ?? null,
        override_hours_to_date: override_hours_to_date ?? null,
        override_paid_hours_total: override_paid_hours_total ?? null,
        override_live_hours_total: override_live_hours_total ?? null,
        coordinator_notes: coordinator_notes ?? null,
      })
      .select()
      .single()
    if (reportError) throw reportError

    const reportId = (report as { id: string }).id

    if (trainer_ids.length > 0) {
      await supabase
        .from('class_daily_report_trainers')
        .insert(trainer_ids.map((tid: string) => ({ report_id: reportId, trainer_id: tid })))
    }
    if (timeline.length > 0) {
      await supabase.from('class_daily_report_timeline_items').insert(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        timeline.map((item: any, index: number) => ({
          report_id: reportId,
          start_time: item.start_time ?? null,
          end_time: item.end_time ?? null,
          activity: item.activity ?? null,
          homework_handouts_tests: item.homework_handouts_tests ?? null,
          category: item.category ?? null,
          position: index,
        })),
      )
    }
    if (progress.length > 0) {
      const { data: progressRows, error: progressError } = await supabase.from('class_daily_report_trainee_progress').insert(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        progress.map((row: any) => ({
          report_id: reportId,
          enrollment_id: row.enrollment_id,
          progress_text: row.progress_text ?? null,
          gk_rating: row.gk_rating ?? null,
          dex_rating: row.dex_rating ?? null,
          hom_rating: row.hom_rating ?? null,
          coming_back_next_day: row.coming_back_next_day ?? false,
          homework_completed: row.homework_completed ?? false,
          attendance: row.attendance ?? true,
          late: row.late ?? false,
        })),
      )
        .select()
      if (progressError) throw progressError
      await logAudit({
        userId: req.userId!,
        action: 'CREATE',
        tableName: 'class_daily_report_trainee_progress',
        recordId: `report:${reportId}`,
        after: { rows: progressRows ?? [] },
        metadata: { class_id: req.params.classId, report_id: reportId, count: progressRows?.length ?? 0 },
        ipAddress: req.ip,
      })
    }
    if (drill_times.length > 0) {
      const { error: dtError } = await supabase.from('class_daily_report_drill_times').insert(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        drill_times.map((row: any) => ({
          report_id: reportId,
          enrollment_id: row.enrollment_id,
          drill_id: row.drill_id,
          time_seconds: row.time_seconds ?? null,
          score: row.score ?? null,
        })),
      )
      if (dtError) throw dtError
    }

    // Auto-fail students who are not coming back
    await autoFailNotComingBack(req.params.classId as string, reportId, req.userId!, req.ip)

    await logAudit({
      userId: req.userId!,
      action: 'CREATE',
      tableName: 'class_daily_reports',
      recordId: reportId,
      after: report as Record<string, unknown>,
      metadata: { class_id: req.params.classId, report_date },
      ipAddress: req.ip,
    })

    res.status(201).json(report)
  } catch (err) {
    next(err)
  }
})

/**
 * PUT /classes/:classId/reports/:id
 * Auth: coordinator
 * Updates the main report row and fully replaces all nested data using a
 * delete-then-insert strategy (not a merge/diff). This ensures the database state
 * always exactly matches the frontend form submission.
 *
 * Nested replacements happen in this order:
 *   1. Delete all trainer links → re-insert from trainer_ids array
 *   2. Delete all timeline items → re-insert with position = array index
 *   3. Delete all progress rows → re-insert from progress array
 *   4. Delete all drill time rows → re-insert from drill_times array
 *
 * The operation is audit-logged (UPDATE). Returns 404 if the report/classId
 * combination doesn't match (PGRST116 = "no rows found").
 */
reportsRouter.put('/classes/:classId/reports/:id', writeLimiter, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = validateBody(reportBodySchema, req, res)
    if (!body) return
    const {
      report_date,
      group_label,
      game,
      session_label,
      class_start_time,
      class_end_time,
      mg_confirmed,
      mg_attended,
      current_trainees,
      licenses_received,
      override_hours_to_date,
      override_paid_hours_total,
      override_live_hours_total,
      coordinator_notes,
      trainer_ids = [],
      timeline = [],
      progress = [],
      drill_times = [],
    } = body

    const reportId = req.params.id as string
    const { data: before, error: beforeError } = await supabase
      .from('class_daily_reports')
      .select('*')
      .eq('id', reportId)
      .eq('class_id', req.params.classId)
      .single()
    if (beforeError || !before) {
      res.status(404).json({ error: 'Report not found' })
      return
    }

    const { data: report, error: reportError } = await supabase
      .from('class_daily_reports')
      .update({
        report_date,
        group_label: group_label ?? null,
        game: game ?? null,
        session_label: session_label ?? null,
        class_start_time: class_start_time ?? null,
        class_end_time: class_end_time ?? null,
        mg_confirmed: mg_confirmed ?? null,
        mg_attended: mg_attended ?? null,
        current_trainees: current_trainees ?? null,
        licenses_received: licenses_received ?? null,
        override_hours_to_date: override_hours_to_date ?? null,
        override_paid_hours_total: override_paid_hours_total ?? null,
        override_live_hours_total: override_live_hours_total ?? null,
        coordinator_notes: coordinator_notes ?? null,
      })
      .eq('id', reportId)
      .eq('class_id', req.params.classId)
      .select()
      .single()
    if (reportError) {
      if (reportError.code === 'PGRST116') {
        res.status(404).json({ error: 'Report not found' })
        return
      }
      throw reportError
    }

    // Full replace: delete all existing nested rows, then re-insert from the request body
    await supabase.from('class_daily_report_trainers').delete().eq('report_id', reportId)
    if (trainer_ids.length > 0) {
      await supabase
        .from('class_daily_report_trainers')
        .insert(trainer_ids.map((tid: string) => ({ report_id: reportId, trainer_id: tid })))
    }

    await supabase.from('class_daily_report_timeline_items').delete().eq('report_id', reportId)
    if (timeline.length > 0) {
      await supabase.from('class_daily_report_timeline_items').insert(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        timeline.map((item: any, index: number) => ({
          report_id: reportId,
          start_time: item.start_time ?? null,
          end_time: item.end_time ?? null,
          activity: item.activity ?? null,
          homework_handouts_tests: item.homework_handouts_tests ?? null,
          category: item.category ?? null,
          position: index,
        })),
      )
    }

    const { data: beforeProgress, error: beforeProgressError } = await supabase
      .from('class_daily_report_trainee_progress')
      .select('*')
      .eq('report_id', reportId)
    if (beforeProgressError) throw beforeProgressError

    await supabase.from('class_daily_report_trainee_progress').delete().eq('report_id', reportId)
    let afterProgress: unknown[] = []
    if (progress.length > 0) {
      const { data: insertedProgress, error: progressError } = await supabase.from('class_daily_report_trainee_progress').insert(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        progress.map((row: any) => ({
          report_id: reportId,
          enrollment_id: row.enrollment_id,
          progress_text: row.progress_text ?? null,
          gk_rating: row.gk_rating ?? null,
          dex_rating: row.dex_rating ?? null,
          hom_rating: row.hom_rating ?? null,
          coming_back_next_day: row.coming_back_next_day ?? false,
          homework_completed: row.homework_completed ?? false,
          attendance: row.attendance ?? true,
          late: row.late ?? false,
        })),
      )
        .select()
      if (progressError) throw progressError
      afterProgress = insertedProgress ?? []
    }
    await logAudit({
      userId: req.userId!,
      action: 'UPDATE',
      tableName: 'class_daily_report_trainee_progress',
      recordId: `report:${reportId}`,
      before: { rows: beforeProgress ?? [] },
      after: { rows: afterProgress },
      metadata: { class_id: req.params.classId, report_id: reportId },
      ipAddress: req.ip,
    })

    const { error: dtDelError } = await supabase.from('class_daily_report_drill_times').delete().eq('report_id', reportId)
    if (dtDelError) throw dtDelError
    if (drill_times.length > 0) {
      const { error: dtError } = await supabase.from('class_daily_report_drill_times').insert(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        drill_times.map((row: any) => ({
          report_id: reportId,
          enrollment_id: row.enrollment_id,
          drill_id: row.drill_id,
          time_seconds: row.time_seconds ?? null,
          score: row.score ?? null,
        })),
      )
      if (dtError) throw dtError
    }

    // Auto-fail students who are not coming back
    await autoFailNotComingBack(req.params.classId as string, reportId, req.userId!, req.ip)

    await logAudit({
      userId: req.userId!,
      action: 'UPDATE',
      tableName: 'class_daily_reports',
      recordId: reportId,
      before: before as Record<string, unknown>,
      after: report as Record<string, unknown>,
      metadata: { class_id: req.params.classId, report_date },
      ipAddress: req.ip,
    })

    res.json(report)
  } catch (err) {
    next(err)
  }
})

/**
 * DELETE /classes/:classId/reports/:id
 * Auth: coordinator
 * Permanently deletes a report and all its nested data (cascaded by DB foreign keys).
 * The audit log entry is written BEFORE the delete so the record ID is still valid
 * at the time of logging. Pre-fetches using both id and class_id to return a proper
 * 404 and to enforce IDOR protection. Returns 204 No Content on success.
 */
reportsRouter.delete('/classes/:classId/reports/:id', writeLimiter, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { data: existing, error: fetchError } = await supabase
      .from('class_daily_reports')
      .select('*')
      .eq('id', req.params.id)
      .eq('class_id', req.params.classId)
      .single()
    if (fetchError || !existing) {
      res.status(404).json({ error: 'Report not found' })
      return
    }

    await logAudit({
      userId: req.userId!,
      action: 'DELETE',
      tableName: 'class_daily_reports',
      recordId: req.params.id as string,
      before: existing as Record<string, unknown>,
      metadata: { class_id: req.params.classId },
      ipAddress: req.ip,
    })

    const { error } = await supabase.from('class_daily_reports').delete().eq('id', req.params.id)
    if (error) throw error
    res.status(204).send()
  } catch (err) {
    next(err)
  }
})
