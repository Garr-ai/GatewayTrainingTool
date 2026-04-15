/**
 * server/src/routes/payroll.ts — Payroll hour aggregation routes
 *
 * All routes require: authentication + coordinator role
 *
 * Routes:
 *   GET /payroll/trainers         — Aggregated hours per trainer (filterable, paginated)
 *   GET /payroll/students         — Aggregated hours per student (filterable, paginated)
 *   GET /payroll/trainers/csv     — Same data as CSV download
 *   GET /payroll/students/csv     — Same data as CSV download
 *
 * These endpoints aggregate data from `class_logged_hours`, joining through
 * `class_trainers` / `class_enrollments` for names and `classes` for
 * province/site filtering. Aggregation is done in-memory (consistent with
 * existing Supabase query patterns in this codebase).
 */

import { Router, type Request, type Response, type NextFunction } from 'express'
import { supabase } from '../lib/supabase'

export const payrollRouter = Router()

// ─── Shared types ───────────────────────────────────────────────────────────

interface PayrollRow {
  person_id: string
  person_name: string
  person_email: string
  total_hours: number
  paid_hours: number
  live_hours: number
  class_count: number
}

interface HoursRecord {
  trainer_id: string | null
  enrollment_id: string | null
  class_id: string
  hours: number
  paid: boolean
  live_training: boolean
  classes: { province: string; site: string } | null
}

// ─── Shared helpers ─────────────────────────────────────────────────────────

/** Matches YYYY-MM-DD exactly */
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

function parseFilters(query: Record<string, string | undefined>) {
  const date_from = query.date_from && DATE_RE.test(query.date_from) ? query.date_from : undefined
  const date_to   = query.date_to   && DATE_RE.test(query.date_to)   ? query.date_to   : undefined
  return {
    date_from,
    date_to,
    province: query.province,
    site: query.site,
    class_id: query.class_id,
    page: Math.max(0, parseInt(query.page ?? '0', 10) || 0),
    limit: Math.min(200, Math.max(1, parseInt(query.limit ?? '50', 10) || 50)),
  }
}

/**
 * Fetches and aggregates hours for a given person_type.
 * Returns the full grouped array (caller handles pagination).
 */
async function aggregateHours(
  personType: 'trainer' | 'student',
  filters: ReturnType<typeof parseFilters>,
): Promise<PayrollRow[]> {
  // 1. Build query on class_logged_hours with inner join on classes for filtering
  let query = supabase
    .from('class_logged_hours')
    .select('trainer_id, enrollment_id, class_id, hours, paid, live_training, classes!inner(province, site)')
    .eq('person_type', personType)

  if (filters.class_id) query = query.eq('class_id', filters.class_id)
  if (filters.date_from) query = query.gte('log_date', filters.date_from)
  if (filters.date_to) query = query.lte('log_date', filters.date_to)
  if (filters.province) query = query.eq('classes.province', filters.province)
  if (filters.site) query = query.eq('classes.site', filters.site)

  const { data: hours, error } = await query
  if (error) throw error
  if (!hours || hours.length === 0) return []

  const records = hours as unknown as HoursRecord[]

  // 2. Group by person ID
  const idField = personType === 'trainer' ? 'trainer_id' : 'enrollment_id'
  const grouped = new Map<string, { total: number; paid: number; live: number; classIds: Set<string> }>()

  for (const r of records) {
    const pid = r[idField]
    if (!pid) continue
    let entry = grouped.get(pid)
    if (!entry) {
      entry = { total: 0, paid: 0, live: 0, classIds: new Set() }
      grouped.set(pid, entry)
    }
    entry.total += r.hours
    if (r.paid) entry.paid += r.hours
    if (r.live_training) entry.live += r.hours
    entry.classIds.add(r.class_id)
  }

  // 3. Resolve names from class_trainers or class_enrollments
  const personIds = [...grouped.keys()]
  const nameMap = new Map<string, { name: string; email: string }>()

  if (personType === 'trainer') {
    const { data: trainers } = await supabase
      .from('class_trainers')
      .select('id, trainer_name, trainer_email')
      .in('id', personIds)
    for (const t of trainers ?? []) {
      nameMap.set(t.id, { name: t.trainer_name, email: t.trainer_email })
    }
  } else {
    const { data: enrollments } = await supabase
      .from('class_enrollments')
      .select('id, student_name, student_email')
      .in('id', personIds)
    for (const e of enrollments ?? []) {
      nameMap.set(e.id, { name: e.student_name, email: e.student_email })
    }
  }

  // 4. Build result array
  const rows: PayrollRow[] = []
  for (const [pid, agg] of grouped) {
    const person = nameMap.get(pid)
    rows.push({
      person_id: pid,
      person_name: person?.name ?? 'Unknown',
      person_email: person?.email ?? '',
      total_hours: Math.round(agg.total * 100) / 100,
      paid_hours: Math.round(agg.paid * 100) / 100,
      live_hours: Math.round(agg.live * 100) / 100,
      class_count: agg.classIds.size,
    })
  }

  // Sort by name ascending
  rows.sort((a, b) => a.person_name.localeCompare(b.person_name))
  return rows
}

function toCsv(rows: PayrollRow[], personLabel: string): string {
  const header = `${personLabel} Name,Email,Total Hours,Paid Hours,Live Training Hours,Classes\n`
  const body = rows
    .map(r => `"${r.person_name}","${r.person_email}",${r.total_hours},${r.paid_hours},${r.live_hours},${r.class_count}`)
    .join('\n')
  return header + body
}

// ─── Routes ─────────────────────────────────────────────────────────────────

/**
 * GET /payroll/trainers
 * Aggregated hours per trainer, with filtering and pagination.
 */
payrollRouter.get('/payroll/trainers', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const filters = parseFilters(req.query as Record<string, string | undefined>)
    const allRows = await aggregateHours('trainer', filters)
    const start = filters.page * filters.limit
    const pageRows = allRows.slice(start, start + filters.limit)
    res.json({ data: pageRows, total: allRows.length, page: filters.page, limit: filters.limit })
  } catch (err) {
    next(err)
  }
})

/**
 * GET /payroll/students
 * Aggregated hours per student, with filtering and pagination.
 */
payrollRouter.get('/payroll/students', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const filters = parseFilters(req.query as Record<string, string | undefined>)
    const allRows = await aggregateHours('student', filters)
    const start = filters.page * filters.limit
    const pageRows = allRows.slice(start, start + filters.limit)
    res.json({ data: pageRows, total: allRows.length, page: filters.page, limit: filters.limit })
  } catch (err) {
    next(err)
  }
})

/**
 * GET /payroll/trainers/csv
 * Download trainer hours as CSV file.
 */
payrollRouter.get('/payroll/trainers/csv', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const filters = parseFilters(req.query as Record<string, string | undefined>)
    const allRows = await aggregateHours('trainer', filters)
    const csv = toCsv(allRows, 'Trainer')
    const dateRange = [filters.date_from, filters.date_to].filter(Boolean).join('_to_') || 'all'
    res.setHeader('Content-Type', 'text/csv')
    res.setHeader('Content-Disposition', `attachment; filename="trainer-payroll-${dateRange}.csv"`)
    res.send(csv)
  } catch (err) {
    next(err)
  }
})

/**
 * GET /payroll/students/csv
 * Download student hours as CSV file.
 */
payrollRouter.get('/payroll/students/csv', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const filters = parseFilters(req.query as Record<string, string | undefined>)
    const allRows = await aggregateHours('student', filters)
    const csv = toCsv(allRows, 'Student')
    const dateRange = [filters.date_from, filters.date_to].filter(Boolean).join('_to_') || 'all'
    res.setHeader('Content-Type', 'text/csv')
    res.setHeader('Content-Disposition', `attachment; filename="student-payroll-${dateRange}.csv"`)
    res.send(csv)
  } catch (err) {
    next(err)
  }
})
