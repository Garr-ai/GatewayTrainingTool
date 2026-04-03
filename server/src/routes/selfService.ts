/**
 * server/src/routes/selfService.ts — Self-service endpoints for trainers and trainees
 *
 * These routes are mounted BEFORE requireCoordinator so trainers and trainees
 * can access their own data. They identify the caller by req.userEmail (set by
 * requireAuth from the JWT), not by a coordinator-supplied ID.
 *
 * Routes:
 *   GET /me/my-classes         — Classes this trainer is assigned to, with richer metadata
 *   GET /me/trainer-dashboard  — Backwards-compat alias for /me/my-classes
 *   GET /me/trainee-progress   — Progress and drill times for this trainee across all classes
 */

import { Router, type Request, type Response, type NextFunction } from 'express'
import { supabase } from '../lib/supabase'

export const selfServiceRouter = Router()

/**
 * Validates that the given email belongs to a trainer assigned to the given class.
 * Returns the class_trainers row on success.
 * Throws a 403-style error if the trainer is not assigned.
 */
async function validateTrainerAccess(email: string, classId: string) {
  const { data, error } = await supabase
    .from('class_trainers')
    .select('id, class_id, trainer_name, trainer_email, role')
    .eq('trainer_email', email)
    .eq('class_id', classId)
    .single()
  if (error || !data) {
    const err = new Error('You are not assigned to this class') as Error & { status: number }
    err.status = 403
    throw err
  }
  return data as { id: string; class_id: string; trainer_name: string; trainer_email: string; role: string }
}

/**
 * GET /me/my-classes
 * Auth: any authenticated user (trainers use this)
 *
 * Returns all classes the trainer is assigned to with metadata, enrollment counts,
 * upcoming schedule slots, draft report count, and recent hours.
 */
const myClassesHandler = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const email = req.userEmail
    if (!email) {
      res.status(401).json({ error: 'No email associated with this account' })
      return
    }

    const { data: trainerRows, error: trainerError } = await supabase
      .from('class_trainers')
      .select('id, class_id, trainer_name, role')
      .eq('trainer_email', email)
    if (trainerError) throw trainerError
    if (!trainerRows || trainerRows.length === 0) {
      res.json({ trainer_name: null, trainer_email: email, classes: [] })
      return
    }

    const classIds = [...new Set(trainerRows.map((t: { class_id: string }) => t.class_id))]
    const trainerIds = trainerRows.map((t: { id: string }) => t.id)
    const today = new Date().toISOString().slice(0, 10)

    const [classesResult, enrollCountResult, scheduleResult, draftCountResult, hoursResult] = await Promise.all([
      supabase
        .from('classes')
        .select('id, name, site, province, game_type, start_date, end_date, archived')
        .in('id', classIds),
      supabase
        .from('class_enrollments')
        .select('class_id')
        .in('class_id', classIds)
        .eq('status', 'enrolled'),
      supabase
        .from('class_schedule_slots')
        .select('id, class_id, slot_date, start_time, end_time, group_label, notes')
        .in('class_id', classIds)
        .gte('slot_date', today)
        .order('slot_date', { ascending: true })
        .order('start_time', { ascending: true })
        .limit(50),
      // draft_report_count is class-wide (all trainers' drafts) — shows how many reports need attention
      supabase
        .from('class_daily_reports')
        .select('class_id')
        .in('class_id', classIds)
        .eq('status', 'draft'),
      supabase
        .from('class_logged_hours')
        .select('class_id, hours')
        .in('class_id', classIds)
        .eq('person_type', 'trainer')
        .in('trainer_id', trainerIds),
    ])

    if (classesResult.error) throw classesResult.error
    if (enrollCountResult.error) throw enrollCountResult.error
    if (scheduleResult.error) throw scheduleResult.error
    if (draftCountResult.error) throw draftCountResult.error
    if (hoursResult.error) throw hoursResult.error

    const enrollCountMap = new Map<string, number>()
    for (const row of enrollCountResult.data ?? []) {
      const r = row as { class_id: string }
      enrollCountMap.set(r.class_id, (enrollCountMap.get(r.class_id) ?? 0) + 1)
    }

    const slotsMap = new Map<string, typeof scheduleResult.data>()
    for (const slot of scheduleResult.data ?? []) {
      const s = slot as { class_id: string }
      const existing = slotsMap.get(s.class_id) ?? []
      if (existing.length < 3) slotsMap.set(s.class_id, [...existing, slot])
    }

    const draftCountMap = new Map<string, number>()
    for (const row of draftCountResult.data ?? []) {
      const r = row as { class_id: string }
      draftCountMap.set(r.class_id, (draftCountMap.get(r.class_id) ?? 0) + 1)
    }

    const hoursMap = new Map<string, number>()
    for (const row of hoursResult.data ?? []) {
      const r = row as { class_id: string; hours: number }
      hoursMap.set(r.class_id, (hoursMap.get(r.class_id) ?? 0) + (r.hours ?? 0))
    }

    const classMap = new Map<string, (typeof classesResult.data)[0]>()
    for (const c of classesResult.data ?? []) classMap.set(c.id, c)

    const classes = trainerRows.map((t: { id: string; class_id: string; trainer_name: string; role: string }) => {
      const cls = classMap.get(t.class_id)
      return {
        class_id: t.class_id,
        trainer_id: t.id,
        class_name: cls?.name ?? 'Unknown',
        site: cls?.site ?? '',
        province: cls?.province ?? '',
        game_type: cls?.game_type ?? null,
        start_date: cls?.start_date ?? null,
        end_date: cls?.end_date ?? null,
        archived: cls?.archived ?? false,
        trainer_role: t.role,
        enrolled_count: enrollCountMap.get(t.class_id) ?? 0,
        draft_report_count: draftCountMap.get(t.class_id) ?? 0,
        total_hours: hoursMap.get(t.class_id) ?? 0,
        upcoming_slots: slotsMap.get(t.class_id) ?? [],
      }
    })

    res.json({
      trainer_name: trainerRows[0].trainer_name,
      trainer_email: email,
      classes,
    })
  } catch (err) {
    next(err)
  }
}

selfServiceRouter.get('/me/my-classes', myClassesHandler)

// Backwards compatibility alias
selfServiceRouter.get('/me/trainer-dashboard', myClassesHandler)

/**
 * GET /me/trainee-progress
 * Auth: any authenticated user (trainees use this)
 *
 * Returns the same shape as GET /students/progress?email=... but
 * automatically scoped to the calling user's email. Trainees do not
 * need to know their own email to make this call — it comes from the JWT.
 */
selfServiceRouter.get('/me/trainee-progress', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const email = req.userEmail
    if (!email) {
      res.status(401).json({ error: 'No email associated with this account' })
      return
    }

    // Find all enrollments for this student
    const { data: enrollments, error: enrollError } = await supabase
      .from('class_enrollments')
      .select('id, class_id, student_name, student_email, status, group_label')
      .eq('student_email', email)
    if (enrollError) throw enrollError
    if (!enrollments || enrollments.length === 0) {
      res.json({ student_name: null, student_email: email, classes: [], progress: [], drill_times: [] })
      return
    }

    const enrollmentIds = enrollments.map((e: { id: string }) => e.id)
    const classIds = [...new Set(enrollments.map((e: { class_id: string }) => e.class_id))]
    const today = new Date().toISOString().slice(0, 10)

    const [classesResult, progressResult, drillTimesResult, scheduleResult] = await Promise.all([
      supabase
        .from('classes')
        .select('id, name, site, province, game_type, start_date, end_date')
        .in('id', classIds),
      supabase
        .from('class_daily_report_trainee_progress')
        .select('*, class_daily_reports!inner(report_date, session_label, group_label, class_id)')
        .in('enrollment_id', enrollmentIds)
        .order('created_at', { ascending: true }),
      supabase
        .from('class_daily_report_drill_times')
        .select('*, class_daily_reports!inner(report_date, class_id), class_drills!inner(name, type, par_time_seconds, target_score)')
        .in('enrollment_id', enrollmentIds)
        .order('created_at', { ascending: true }),
      supabase
        .from('class_schedule_slots')
        .select('id, class_id, slot_date, start_time, end_time, group_label, notes')
        .in('class_id', classIds)
        .gte('slot_date', today)
        .order('slot_date', { ascending: true })
        .order('start_time', { ascending: true })
        .limit(20),
    ])

    if (classesResult.error) throw classesResult.error
    if (progressResult.error) throw progressResult.error
    if (drillTimesResult.error) throw drillTimesResult.error
    if (scheduleResult.error) throw scheduleResult.error

    const classMap = new Map<string, { id: string; name: string; site: string; province: string; game_type: string | null; start_date: string; end_date: string }>()
    for (const c of classesResult.data ?? []) {
      classMap.set(c.id, c)
    }

    // Build upcoming slots map
    const slotsMap = new Map<string, typeof scheduleResult.data>()
    for (const slot of scheduleResult.data ?? []) {
      const s = slot as { class_id: string }
      const existing = slotsMap.get(s.class_id) ?? []
      if (existing.length < 3) slotsMap.set(s.class_id, [...existing, slot])
    }

    const classes = enrollments.map((e: { id: string; class_id: string; status: string; group_label: string | null; student_name: string; student_email: string }) => {
      const cls = classMap.get(e.class_id)
      return {
        class_id: e.class_id,
        class_name: cls?.name ?? 'Unknown',
        site: cls?.site ?? '',
        province: cls?.province ?? '',
        game_type: cls?.game_type ?? null,
        start_date: cls?.start_date ?? null,
        end_date: cls?.end_date ?? null,
        enrollment_id: e.id,
        status: e.status,
        group_label: e.group_label,
        upcoming_slots: slotsMap.get(e.class_id) ?? [],
      }
    })

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
    progress.sort((a: { report_date: string }, b: { report_date: string }) => a.report_date.localeCompare(b.report_date))

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
      student_email: email,
      classes,
      progress,
      drill_times: drillTimes,
    })
  } catch (err) {
    next(err)
  }
})

/**
 * GET /me/my-classes/:classId
 * Auth: trainer assigned to class
 *
 * Returns class metadata, trainer's role, enrolled students, and drills.
 */
selfServiceRouter.get('/me/my-classes/:classId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const classId = req.params.classId as string
    const trainerRow = await validateTrainerAccess(req.userEmail!, classId)

    const [classResult, enrollResult, drillsResult] = await Promise.all([
      supabase.from('classes').select('*').eq('id', classId).single(),
      supabase.from('class_enrollments').select('*').eq('class_id', classId).order('student_name', { ascending: true }),
      supabase.from('class_drills').select('*').eq('class_id', classId).order('created_at', { ascending: false }),
    ])

    if (classResult.error) throw classResult.error
    if (enrollResult.error) throw enrollResult.error
    if (drillsResult.error) throw drillsResult.error

    res.json({
      ...classResult.data,
      trainer_role: trainerRow.role,
      trainer_id: trainerRow.id,
      enrollments: enrollResult.data ?? [],
      drills: drillsResult.data ?? [],
    })
  } catch (err) {
    if ((err as Error & { status?: number }).status === 403) {
      res.status(403).json({ error: (err as Error).message })
      return
    }
    next(err)
  }
})

/**
 * GET /me/my-classes/:classId/reports
 * Auth: trainer assigned to class
 * Returns all daily reports for this class, sorted by date desc.
 */
selfServiceRouter.get('/me/my-classes/:classId/reports', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const classId = req.params.classId as string
    await validateTrainerAccess(req.userEmail!, classId)

    const { data, error } = await supabase
      .from('class_daily_reports')
      .select('*')
      .eq('class_id', classId)
      .order('report_date', { ascending: false })
    if (error) throw error
    res.json(data)
  } catch (err) {
    if ((err as Error & { status?: number }).status === 403) {
      res.status(403).json({ error: (err as Error).message })
      return
    }
    next(err)
  }
})

/**
 * GET /me/my-classes/:classId/reports/:reportId
 * Auth: trainer assigned to class
 * Returns full report with nested trainer_ids, timeline, progress, drill_times.
 */
selfServiceRouter.get('/me/my-classes/:classId/reports/:reportId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const classId = req.params.classId as string
    await validateTrainerAccess(req.userEmail!, classId)

    const reportId = req.params.reportId as string
    const [
      { data: report, error: reportError },
      { data: trainerLinks },
      { data: timeline },
      { data: progress },
      { data: drillTimes, error: drillTimesError },
    ] = await Promise.all([
      supabase.from('class_daily_reports').select('*').eq('id', reportId).eq('class_id', classId).single(),
      supabase.from('class_daily_report_trainers').select('trainer_id').eq('report_id', reportId),
      supabase
        .from('class_daily_report_timeline_items')
        .select('*')
        .eq('report_id', reportId)
        .order('position', { ascending: true })
        .order('start_time', { ascending: true }),
      supabase.from('class_daily_report_trainee_progress').select('*').eq('report_id', reportId),
      supabase.from('class_daily_report_drill_times').select('*').eq('report_id', reportId),
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
    if ((err as Error & { status?: number }).status === 403) {
      res.status(403).json({ error: (err as Error).message })
      return
    }
    next(err)
  }
})

selfServiceRouter.get('/me/my-classes/:classId/schedule', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const classId = req.params.classId as string
    await validateTrainerAccess(req.userEmail!, classId)

    const { data, error } = await supabase
      .from('class_schedule_slots')
      .select('*')
      .eq('class_id', classId)
      .order('slot_date', { ascending: true })
      .order('start_time', { ascending: true })
    if (error) throw error
    res.json(data)
  } catch (err) {
    if ((err as Error & { status?: number }).status === 403) {
      res.status(403).json({ error: (err as Error).message })
      return
    }
    next(err)
  }
})

/**
 * GET /me/my-classes/:classId/hours
 * Auth: trainer assigned to class
 * Returns: trainer's own hours + all student hours. Does NOT include other trainers' hours.
 */
selfServiceRouter.get('/me/my-classes/:classId/hours', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const classId = req.params.classId as string
    const trainerRow = await validateTrainerAccess(req.userEmail!, classId)

    // Fetch trainer's own hours and all student hours in parallel
    const [trainerHoursResult, studentHoursResult] = await Promise.all([
      supabase
        .from('class_logged_hours')
        .select('*')
        .eq('class_id', classId)
        .eq('person_type', 'trainer')
        .eq('trainer_id', trainerRow.id)
        .order('log_date', { ascending: false }),
      supabase
        .from('class_logged_hours')
        .select('*')
        .eq('class_id', classId)
        .eq('person_type', 'student')
        .order('log_date', { ascending: false }),
    ])

    if (trainerHoursResult.error) throw trainerHoursResult.error
    if (studentHoursResult.error) throw studentHoursResult.error

    res.json({
      trainer_hours: trainerHoursResult.data ?? [],
      student_hours: studentHoursResult.data ?? [],
    })
  } catch (err) {
    if ((err as Error & { status?: number }).status === 403) {
      res.status(403).json({ error: (err as Error).message })
      return
    }
    next(err)
  }
})

selfServiceRouter.get('/me/my-classes/:classId/students/:enrollmentId/progress', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const classId = req.params.classId as string
    await validateTrainerAccess(req.userEmail!, classId)

    const enrollmentId = req.params.enrollmentId as string

    // Verify enrollment belongs to this class
    const { data: enrollment, error: enrollError } = await supabase
      .from('class_enrollments')
      .select('*')
      .eq('id', enrollmentId)
      .eq('class_id', classId)
      .single()
    if (enrollError || !enrollment) {
      res.status(404).json({ error: 'Student not found in this class' })
      return
    }

    const [progressResult, drillTimesResult] = await Promise.all([
      supabase
        .from('class_daily_report_trainee_progress')
        .select('*, class_daily_reports!inner(report_date, session_label, group_label)')
        .eq('enrollment_id', enrollmentId)
        .order('created_at', { ascending: true }),
      supabase
        .from('class_daily_report_drill_times')
        .select('*, class_daily_reports!inner(report_date), class_drills!inner(name, type, par_time_seconds, target_score)')
        .eq('enrollment_id', enrollmentId)
        .order('created_at', { ascending: true }),
    ])

    if (progressResult.error) throw progressResult.error
    if (drillTimesResult.error) throw drillTimesResult.error

    res.json({
      enrollment,
      progress: progressResult.data ?? [],
      drill_times: drillTimesResult.data ?? [],
    })
  } catch (err) {
    if ((err as Error & { status?: number }).status === 403) {
      res.status(403).json({ error: (err as Error).message })
      return
    }
    next(err)
  }
})
