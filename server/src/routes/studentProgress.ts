/**
 * server/src/routes/studentProgress.ts — Student progress aggregation
 *
 * All routes require: authentication + coordinator role
 *
 * Routes:
 *   GET /students/progress?email=<email> — Full progress data for a student across all classes
 *
 * Fetches all enrollments for the given email, then in parallel fetches:
 *   - Class info for each enrollment
 *   - Daily report trainee progress rows (joined with report dates)
 *   - Daily report drill times (joined with report dates and drill metadata)
 */

import { Router, type Request, type Response, type NextFunction } from 'express'
import { supabase } from '../lib/supabase'

export const studentProgressRouter = Router()

/**
 * GET /students/progress?email=<email>
 * Auth: coordinator
 * Returns aggregated progress data for a student identified by email.
 */
studentProgressRouter.get('/students/progress', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const email = req.query.email as string | undefined
    if (!email) {
      res.status(400).json({ error: 'email query parameter is required' })
      return
    }

    // 1. Find all enrollments for this student
    const { data: enrollments, error: enrollError } = await supabase
      .from('class_enrollments')
      .select('id, class_id, student_name, student_email, status, group_label')
      .eq('student_email', email)
    if (enrollError) throw enrollError
    if (!enrollments || enrollments.length === 0) {
      res.status(404).json({ error: 'No enrollments found for this email' })
      return
    }

    const enrollmentIds = enrollments.map(e => e.id)
    const classIds = [...new Set(enrollments.map(e => e.class_id))]

    // 2. Fetch class info, progress, and drill times in parallel
    const [classesResult, progressResult, drillTimesResult] = await Promise.all([
      // Classes
      supabase
        .from('classes')
        .select('id, name, site, province, game_type, start_date, end_date')
        .in('id', classIds),
      // Progress rows joined with report dates
      supabase
        .from('class_daily_report_trainee_progress')
        .select('*, class_daily_reports!inner(report_date, session_label, group_label, class_id)')
        .in('enrollment_id', enrollmentIds)
        .order('created_at', { ascending: true }),
      // Drill times joined with report dates and drill metadata
      supabase
        .from('class_daily_report_drill_times')
        .select('*, class_daily_reports!inner(report_date, class_id), class_drills!inner(name, type, par_time_seconds, target_score)')
        .in('enrollment_id', enrollmentIds)
        .order('created_at', { ascending: true }),
    ])

    if (classesResult.error) throw classesResult.error
    if (progressResult.error) throw progressResult.error
    if (drillTimesResult.error) throw drillTimesResult.error

    // Build class lookup
    const classMap = new Map<string, { id: string; name: string }>()
    for (const c of classesResult.data ?? []) {
      classMap.set(c.id, { id: c.id, name: c.name })
    }

    // Build classes array with enrollment context
    const classes = enrollments.map(e => ({
      class_id: e.class_id,
      class_name: classMap.get(e.class_id)?.name ?? 'Unknown',
      enrollment_id: e.id,
      status: e.status,
      group_label: e.group_label,
    }))

    // Map progress rows
    const progress = (progressResult.data ?? []).map((p: Record<string, unknown>) => {
      const report = p.class_daily_reports as { report_date: string; session_label: string | null; group_label: string | null; class_id: string }
      return {
        report_date: report.report_date,
        session_label: report.session_label,
        group_label: report.group_label,
        class_name: classMap.get(report.class_id)?.name ?? 'Unknown',
        progress_text: p.progress_text as string | null,
        gk_rating: p.gk_rating as string | null,
        dex_rating: p.dex_rating as string | null,
        hom_rating: p.hom_rating as string | null,
        coming_back_next_day: p.coming_back_next_day as boolean | null,
        homework_completed: p.homework_completed as boolean,
        attendance: (p.attendance as boolean) ?? true,
      }
    })

    // Sort progress by date
    progress.sort((a: { report_date: string }, b: { report_date: string }) => a.report_date.localeCompare(b.report_date))

    // Map drill times
    const drillTimes = (drillTimesResult.data ?? []).map((d: Record<string, unknown>) => {
      const report = d.class_daily_reports as { report_date: string; class_id: string }
      const drill = d.class_drills as { name: string; type: string; par_time_seconds: number | null; target_score: number | null }
      return {
        report_date: report.report_date,
        class_name: classMap.get(report.class_id)?.name ?? 'Unknown',
        drill_name: drill.name,
        drill_type: drill.type,
        time_seconds: d.time_seconds as number | null,
        score: d.score as number | null,
        par_time_seconds: drill.par_time_seconds,
        target_score: drill.target_score,
      }
    })

    drillTimes.sort((a: { report_date: string }, b: { report_date: string }) => a.report_date.localeCompare(b.report_date))

    res.json({
      student_name: enrollments[0].student_name,
      student_email: enrollments[0].student_email,
      classes,
      progress,
      drill_times: drillTimes,
    })
  } catch (err) {
    next(err)
  }
})
