import { Router, Request, Response, NextFunction } from 'express'
import { supabase } from '../lib/supabase'

export const dashboardRouter = Router()

// GET /api/dashboard/hours-summary
dashboardRouter.get('/dashboard/hours-summary', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const now = new Date()
    const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
    const { data, error } = await supabase
      .from('class_logged_hours')
      .select('hours, trainer_id')
      .eq('person_type', 'trainer')
      .gte('log_date', monthStart)

    if (error) throw error
    const rows = data ?? []
    const totalHours = rows.reduce((sum, r) => sum + (r.hours ?? 0), 0)
    const trainerIds = new Set(rows.map(r => r.trainer_id).filter(Boolean))
    res.json({
      total_hours: Math.round(totalHours * 100) / 100,
      trainer_count: trainerIds.size,
    })
  } catch (err) {
    next(err)
  }
})

// GET /api/dashboard/enrollment-summary
dashboardRouter.get('/dashboard/enrollment-summary', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { data: classes } = await supabase
      .from('classes')
      .select('id')
      .eq('archived', false)
    const classIds = (classes ?? []).map(c => c.id)
    if (classIds.length === 0) {
      res.json({ enrolled: 0, waitlist: 0 })
      return
    }

    const { data, error } = await supabase
      .from('class_enrollments')
      .select('status')
      .in('class_id', classIds)
      .in('status', ['enrolled', 'waitlist'])

    if (error) throw error
    const rows = data ?? []
    const enrolled = rows.filter(r => r.status === 'enrolled').length
    const waitlist = rows.filter(r => r.status === 'waitlist').length
    res.json({ enrolled, waitlist })
  } catch (err) {
    next(err)
  }
})

// GET /api/dashboard/attendance-rate
dashboardRouter.get('/dashboard/attendance-rate', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const now = new Date()
    const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`

    const { data: reports } = await supabase
      .from('class_daily_reports')
      .select('id')
      .gte('report_date', monthStart)
    const reportIds = (reports ?? []).map(r => r.id)
    if (reportIds.length === 0) {
      res.json({ rate: null })
      return
    }

    const { data: progress, error } = await supabase
      .from('class_daily_report_trainee_progress')
      .select('attendance')
      .in('report_id', reportIds)

    if (error) throw error
    const rows = progress ?? []
    if (rows.length === 0) {
      res.json({ rate: null })
      return
    }
    const attended = rows.filter(r => r.attendance === true).length
    const rate = Math.round((attended / rows.length) * 100)
    res.json({ rate })
  } catch (err) {
    next(err)
  }
})

// GET /api/dashboard/unreported-sessions
dashboardRouter.get('/dashboard/unreported-sessions', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const today = new Date().toISOString().split('T')[0]

    const { data: slots, error: slotsError } = await supabase
      .from('class_schedule_slots')
      .select('class_id, classes!inner(name)')
      .eq('slot_date', today)

    if (slotsError) throw slotsError

    const { data: reports, error: reportsError } = await supabase
      .from('class_daily_reports')
      .select('class_id')
      .eq('report_date', today)

    if (reportsError) throw reportsError

    const reportedClassIds = new Set((reports ?? []).map(r => r.class_id))
    const slotRows = slots ?? []

    const unreported = new Map<string, string>()
    for (const slot of slotRows) {
      if (!reportedClassIds.has(slot.class_id)) {
        const cls = slot.classes as unknown as { name: string }
        unreported.set(slot.class_id, cls.name)
      }
    }

    res.json({
      classes: [...unreported.entries()].map(([class_id, class_name]) => ({
        class_id,
        class_name,
        session_date: today,
      })),
    })
  } catch (err) {
    next(err)
  }
})

// GET /api/dashboard/activity?limit=N
dashboardRouter.get('/dashboard/activity', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const limit = Math.min(Math.max(Number(req.query.limit) || 10, 1), 50)

    const [
      { data: recentReports },
      { data: recentEnrollments },
      { data: recentSlots },
      { data: recentClasses },
    ] = await Promise.all([
      supabase
        .from('class_daily_reports')
        .select('id, report_date, created_at, class_id, classes!inner(name)')
        .order('created_at', { ascending: false })
        .limit(limit),
      supabase
        .from('class_enrollments')
        .select('id, student_name, status, created_at, class_id, classes!inner(name)')
        .order('created_at', { ascending: false })
        .limit(limit),
      supabase
        .from('class_schedule_slots')
        .select('id, slot_date, created_at, class_id, classes!inner(name)')
        .order('created_at', { ascending: false })
        .limit(limit),
      supabase
        .from('classes')
        .select('id, name, archived, created_at, updated_at')
        .order('updated_at', { ascending: false })
        .limit(limit),
    ])

    type ActivityItem = { type: string; description: string; timestamp: string; link_to: string }
    const items: ActivityItem[] = []

    for (const r of recentReports ?? []) {
      const cls = r.classes as unknown as { name: string }
      items.push({
        type: 'report',
        description: `Report filed for ${cls.name} (${r.report_date})`,
        timestamp: r.created_at,
        link_to: `/classes/${cls.name.trim().replace(/\s+/g, '-')}`,
      })
    }
    for (const e of recentEnrollments ?? []) {
      const cls = e.classes as unknown as { name: string }
      items.push({
        type: 'enrollment',
        description: `${e.student_name} ${e.status} in ${cls.name}`,
        timestamp: e.created_at,
        link_to: `/classes/${cls.name.trim().replace(/\s+/g, '-')}`,
      })
    }
    for (const s of recentSlots ?? []) {
      const cls = s.classes as unknown as { name: string }
      items.push({
        type: 'schedule',
        description: `Schedule slot added for ${cls.name} on ${s.slot_date}`,
        timestamp: s.created_at,
        link_to: `/classes/${cls.name.trim().replace(/\s+/g, '-')}`,
      })
    }
    for (const c of recentClasses ?? []) {
      items.push({
        type: 'class',
        description: c.archived ? `${c.name} archived` : `${c.name} created`,
        timestamp: c.updated_at ?? c.created_at,
        link_to: `/classes/${c.name.trim().replace(/\s+/g, '-')}`,
      })
    }

    items.sort((a, b) => b.timestamp.localeCompare(a.timestamp))
    res.json({ items: items.slice(0, limit) })
  } catch (err) {
    next(err)
  }
})
