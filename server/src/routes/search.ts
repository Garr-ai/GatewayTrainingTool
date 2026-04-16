/**
 * server/src/routes/search.ts — Global search endpoint
 *
 * GET /search?q=<term>
 * Auth: any authenticated user (requireAuth applied upstream)
 * Role-aware scoping:
 *   coordinator — searches all students, trainers, and reports in the system
 *   trainer     — searches only within classes where they appear in class_trainers
 *
 * Returns at most 5 results per category. Empty categories return [].
 */

import { Router, type Request, type Response, type NextFunction } from 'express'
import { supabase } from '../lib/supabase'

export const searchRouter = Router()

searchRouter.get('/search', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const q = (req.query.q as string | undefined)?.trim() ?? ''
    if (q.length < 2) {
      res.json({ students: [], trainers: [], reports: [] })
      return
    }

    const isCoordinator = req.userRole === 'coordinator'
    const trainerEmail = req.userEmail!

    // Resolve trainer's class IDs (trainer scope only)
    let trainerClassIds: string[] = []
    if (!isCoordinator) {
      const { data: trainerRows } = await supabase
        .from('class_trainers')
        .select('class_id')
        .eq('trainer_email', trainerEmail)
      trainerClassIds = (trainerRows ?? []).map((r: { class_id: string }) => r.class_id)
      if (trainerClassIds.length === 0) {
        res.json({ students: [], trainers: [], reports: [] })
        return
      }
    }

    // Student search — match student_name in class_enrollments
    const studentQuery = supabase
      .from('class_enrollments')
      .select('id, student_name, student_email, class_id, classes!inner(name)')
      .ilike('student_name', `%${q}%`)
      .limit(5)
    if (!isCoordinator) studentQuery.in('class_id', trainerClassIds)
    const { data: studentRows } = await studentQuery

    // Trainer search — coordinator only, match trainer_name in class_trainers
    let trainerRows: Array<{ id: string; trainer_name: string; trainer_email: string }> = []
    if (isCoordinator) {
      const { data } = await supabase
        .from('class_trainers')
        .select('id, trainer_name, trainer_email')
        .ilike('trainer_name', `%${q}%`)
        .limit(5)
      // Deduplicate by email
      const seen = new Set<string>()
      for (const r of data ?? []) {
        if (!seen.has(r.trainer_email)) {
          seen.add(r.trainer_email)
          trainerRows.push(r as { id: string; trainer_name: string; trainer_email: string })
        }
      }
      trainerRows = trainerRows.slice(0, 5)
    }

    // Report search — match class name
    const reportQuery = supabase
      .from('class_daily_reports')
      .select('id, class_id, report_date, classes!inner(name)')
      .ilike('classes.name', `%${q}%`)
      .order('report_date', { ascending: false })
      .limit(5)
    if (!isCoordinator) reportQuery.in('class_id', trainerClassIds)
    const { data: reportRows } = await reportQuery

    res.json({
      students: (studentRows ?? []).map((r: Record<string, unknown>) => ({
        id: r.id,
        name: r.student_name,
        email: r.student_email,
        classId: r.class_id,
        className: (r.classes as { name: string } | null)?.name ?? '',
      })),
      trainers: trainerRows.map(r => ({
        id: r.id,
        name: r.trainer_name,
        email: r.trainer_email,
      })),
      reports: (reportRows ?? []).map((r: Record<string, unknown>) => ({
        id: r.id,
        classId: r.class_id,
        className: (r.classes as { name: string } | null)?.name ?? '',
        reportDate: r.report_date,
      })),
    })
  } catch (err) {
    next(err)
  }
})
