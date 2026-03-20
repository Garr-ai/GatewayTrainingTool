import { Router, type Request, type Response, type NextFunction } from 'express'
import { supabase } from '../lib/supabase'
import { logAudit } from '../lib/audit'

export const reportsRouter = Router()

// GET /reports  (all reports across classes, newest first)
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

// GET /classes/:classId/reports
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

// GET /reports/:id  (with nested trainer_ids, timeline, progress)
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

// POST /classes/:classId/reports
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

// PUT /classes/:classId/reports/:id  — classId in path prevents cross-class modification (IDOR)
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

    const reportId = req.params.id

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

    // Replace all nested data
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

// DELETE /classes/:classId/reports/:id  — classId in path prevents cross-class deletion (IDOR)
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
      recordId: req.params.id,
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
