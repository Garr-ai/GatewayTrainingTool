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
 * Reports have three nested tables that are stored separately:
 *   - class_daily_report_trainers         (many-to-many link to class_trainers)
 *   - class_daily_report_timeline_items   (ordered activity timeline for the session)
 *   - class_daily_report_trainee_progress (per-trainee progress ratings and notes)
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

export const reportsRouter = Router()

/**
 * GET /reports
 * Auth: coordinator
 * Returns all daily reports across all classes, joined with the parent class's
 * id, name, and site. Sorted by report_date descending. Limited to 200 results.
 * Used by the global ReportsPage to give coordinators an overview of recent reports.
 */
reportsRouter.get('/reports', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const { data, error } = await supabase
      .from('class_daily_reports')
      .select('*, classes(id, name, site)')
      .order('report_date', { ascending: false })
      .limit(200)
    if (error) throw error
    res.json(data)
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
    ])

    if (reportError) {
      if (reportError.code === 'PGRST116') {
        res.status(404).json({ error: 'Report not found' })
        return
      }
      throw reportError
    }

    res.json({
      ...report,
      trainer_ids: (trainerLinks ?? []).map((t: { trainer_id: string }) => t.trainer_id),
      timeline: timeline ?? [],
      progress: progress ?? [],
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
reportsRouter.post('/classes/:classId/reports', async (req: Request, res: Response, next: NextFunction) => {
  try {
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
      trainer_ids = [],
      timeline = [],
      progress = [],
    } = req.body

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
      await supabase.from('class_daily_report_trainee_progress').insert(
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
        })),
      )
    }

    await logAudit({
      userId: req.userId!,
      action: 'CREATE',
      tableName: 'class_daily_reports',
      recordId: reportId,
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
 *
 * The operation is audit-logged (UPDATE). Returns 404 if the report/classId
 * combination doesn't match (PGRST116 = "no rows found").
 */
reportsRouter.put('/classes/:classId/reports/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
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
      trainer_ids = [],
      timeline = [],
      progress = [],
    } = req.body

    const reportId = req.params.id as string

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

    await supabase.from('class_daily_report_trainee_progress').delete().eq('report_id', reportId)
    if (progress.length > 0) {
      await supabase.from('class_daily_report_trainee_progress').insert(
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
        })),
      )
    }

    await logAudit({
      userId: req.userId!,
      action: 'UPDATE',
      tableName: 'class_daily_reports',
      recordId: reportId,
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
reportsRouter.delete('/classes/:classId/reports/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { data: existing, error: fetchError } = await supabase
      .from('class_daily_reports')
      .select('id')
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
