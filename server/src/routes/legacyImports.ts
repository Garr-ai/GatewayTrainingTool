/**
 * server/src/routes/legacyImports.ts — Persistent legacy import batch history
 *
 * Batches are created after the client finishes importing legacy workbook rows.
 * Coordinators can review past batches and rollback created reports, hours, and
 * enrollments later instead of only during the current browser session.
 */

import { Router, type Request, type Response, type NextFunction } from 'express'
import { supabase } from '../lib/supabase'
import { logAudit } from '../lib/audit'
import { writeLimiter } from '../middleware/rateLimiter'
import { legacyImportBatchBodySchema, legacyImportReviewBodySchema, validateBody } from '../lib/validation'

export const legacyImportsRouter = Router()

type BatchRow = {
  id: string
  import_id: string
  class_id: string
  status: string
  created_report_ids: string[]
  created_hour_ids: string[]
  created_enrollment_ids: string[]
}

function normalizeName(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ').trim()
}

function nameTokens(value: string): string[] {
  return normalizeName(value).split(' ').filter(Boolean)
}

function findEnrollmentByName(rawName: string, rows: Array<{ id: string; student_name: string }>) {
  const normalized = normalizeName(rawName)
  const exact = rows.find(row => normalizeName(row.student_name) === normalized)
  if (exact) return exact

  const tokens = nameTokens(rawName)
  if (tokens.length >= 2) {
    const first = tokens[0]
    const last = tokens[tokens.length - 1]
    const firstLast = rows.find(row => {
      const rowTokens = nameTokens(row.student_name)
      return rowTokens.length >= 2 && first === rowTokens[0] && last === rowTokens[rowTokens.length - 1]
    })
    if (firstLast) return firstLast
  }

  return rows.find(row => {
    const rowName = normalizeName(row.student_name)
    return normalized.includes(rowName) || rowName.includes(normalized)
  }) ?? null
}

legacyImportsRouter.post('/classes/:classId/import-review', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = validateBody(legacyImportReviewBodySchema, req, res)
    if (!body) return

    const [reportsResult, enrollmentsResult, hoursResult] = await Promise.all([
      supabase
        .from('class_daily_reports')
        .select('id, report_date, group_label, session_label')
        .eq('class_id', req.params.classId),
      supabase
        .from('class_enrollments')
        .select('id, student_name, student_email, status')
        .eq('class_id', req.params.classId),
      supabase
        .from('class_logged_hours')
        .select('id, log_date, person_type, trainer_id, enrollment_id, hours, paid, live_training, notes')
        .eq('class_id', req.params.classId),
    ])
    if (reportsResult.error) throw reportsResult.error
    if (enrollmentsResult.error) throw enrollmentsResult.error
    if (hoursResult.error) throw hoursResult.error

    const reportKeyToId = new Map<string, string>()
    for (const row of reportsResult.data ?? []) {
      const typed = row as { id: string; report_date: string; group_label: string | null; session_label: string | null }
      reportKeyToId.set(`${typed.report_date}|${typed.group_label ?? ''}|${typed.session_label ?? ''}`, typed.id)
    }

    const reportReview = body.reports.map(report => {
      const key = `${report.report_date}|${report.group_label ?? ''}|${report.session_label ?? ''}`
      const duplicateReportId = reportKeyToId.get(key) ?? null
      return {
        sheet_name: report.sheet_name,
        key,
        duplicate_report_id: duplicateReportId,
        status: duplicateReportId ? 'duplicate' : 'new',
      }
    })

    const enrollmentRows = (enrollmentsResult.data ?? []) as Array<{ id: string; student_name: string; student_email: string; status: string }>
    const studentNames = [...new Set(body.reports.flatMap(report => [...report.student_names, ...report.progress_student_names]).map(name => name.trim()).filter(Boolean))]
    const students = studentNames.map(name => {
      const enrollment = findEnrollmentByName(name, enrollmentRows)
      return {
        name,
        enrollment_id: enrollment?.id ?? null,
        existing_name: enrollment?.student_name ?? null,
        status: enrollment ? 'existing' : 'missing',
      }
    })

    const hourKeyToId = new Map<string, string>()
    for (const row of hoursResult.data ?? []) {
      const typed = row as {
        id: string
        log_date: string
        person_type: string
        trainer_id: string | null
        enrollment_id: string | null
        hours: number
        paid: boolean
        live_training: boolean
        notes: string | null
      }
      hourKeyToId.set(`${typed.log_date}|${typed.person_type}|${typed.trainer_id ?? ''}|${typed.enrollment_id ?? ''}|${typed.hours}|${typed.paid ? 1 : 0}|${typed.live_training ? 1 : 0}|${typed.notes ?? ''}`, typed.id)
    }

    const payrollReview = body.payroll_rows.map(row => {
      const key = `${row.log_date}|trainer|${row.trainer_id}||${row.hours}|${row.paid ? 1 : 0}|${row.live_training ? 1 : 0}|${row.notes ?? ''}`
      const duplicateHourId = hourKeyToId.get(key) ?? null
      return {
        client_key: row.client_key,
        duplicate_hour_id: duplicateHourId,
        status: duplicateHourId ? 'duplicate' : 'new',
      }
    })

    res.json({
      reports: reportReview,
      payroll_rows: payrollReview,
      students: {
        total: students.length,
        existing: students.filter(student => student.status === 'existing'),
        missing: students.filter(student => student.status === 'missing'),
      },
      summary: {
        duplicate_reports: reportReview.filter(report => report.status === 'duplicate').length,
        duplicate_payroll_rows: payrollReview.filter(row => row.status === 'duplicate').length,
        missing_students: students.filter(student => student.status === 'missing').length,
      },
    })
  } catch (err) {
    next(err)
  }
})

legacyImportsRouter.get('/classes/:classId/import-batches', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { page: pageStr, limit: limitStr } = req.query as Record<string, string | undefined>
    const page = Math.max(0, Number(pageStr) || 0)
    const limit = Math.min(100, Math.max(1, Number(limitStr) || 20))
    const offset = page * limit

    const { data, error, count } = await supabase
      .from('legacy_import_batches')
      .select('*', { count: 'exact' })
      .eq('class_id', req.params.classId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)
    if (error) throw error

    res.json({ data: data ?? [], total: count ?? 0, page, limit })
  } catch (err) {
    next(err)
  }
})

legacyImportsRouter.post('/classes/:classId/import-batches', writeLimiter, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = validateBody(legacyImportBatchBodySchema, req, res)
    if (!body) return

    const row = {
      import_id: body.import_id,
      class_id: req.params.classId,
      file_name: body.file_name ?? null,
      report_count: body.report_count,
      payroll_count: body.payroll_count,
      enrollment_count: body.enrollment_count,
      progress_unmatched: body.progress_unmatched,
      created_report_ids: body.created_report_ids,
      created_hour_ids: body.created_hour_ids,
      created_enrollment_ids: body.created_enrollment_ids,
      skipped_reports: body.skipped_reports,
      skipped_payroll: body.skipped_payroll,
      excluded_sheets: body.excluded_sheets,
      warnings: body.warnings,
      summary: body.summary,
      created_by: req.userId!,
      updated_at: new Date().toISOString(),
    }

    const { data, error } = await supabase
      .from('legacy_import_batches')
      .upsert(row, { onConflict: 'import_id' })
      .select()
      .single()
    if (error) throw error

    await logAudit({
      userId: req.userId!,
      action: 'CREATE',
      tableName: 'legacy_import_batches',
      recordId: (data as { id: string }).id,
      after: data as Record<string, unknown>,
      metadata: { class_id: req.params.classId, import_id: body.import_id },
      ipAddress: req.ip,
    })

    res.status(201).json(data)
  } catch (err) {
    next(err)
  }
})

async function deleteRowsByIds(tableName: string, ids: string[], classId: string, userId: string, ipAddress: string | undefined) {
  if (ids.length === 0) return 0
  const { data: rows, error: fetchError } = await supabase
    .from(tableName)
    .select('*')
    .eq('class_id', classId)
    .in('id', ids)
  if (fetchError) throw fetchError

  const typedRows = (rows ?? []) as Array<Record<string, unknown> & { id: string }>
  for (const row of typedRows) {
    await logAudit({
      userId,
      action: 'DELETE',
      tableName,
      recordId: row.id,
      before: row,
      metadata: { class_id: classId, rollback_import_batch: true },
      ipAddress,
    })
  }

  if (typedRows.length === 0) return 0
  const { error } = await supabase
    .from(tableName)
    .delete()
    .eq('class_id', classId)
    .in('id', typedRows.map(row => row.id))
  if (error) throw error
  return typedRows.length
}

legacyImportsRouter.post('/classes/:classId/import-batches/:id/rollback', writeLimiter, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const classId = String(req.params.classId)
    const batchId = String(req.params.id)
    const { data: before, error: beforeError } = await supabase
      .from('legacy_import_batches')
      .select('*')
      .eq('id', batchId)
      .eq('class_id', classId)
      .single()
    if (beforeError || !before) {
      res.status(404).json({ error: 'Import batch not found' })
      return
    }

    const batch = before as BatchRow
    if (batch.status === 'rolled_back') {
      res.status(409).json({ error: 'Import batch already rolled back' })
      return
    }

    const deletedReports = await deleteRowsByIds('class_daily_reports', batch.created_report_ids ?? [], classId, req.userId!, req.ip)
    const deletedHours = await deleteRowsByIds('class_logged_hours', batch.created_hour_ids ?? [], classId, req.userId!, req.ip)
    const deletedEnrollments = await deleteRowsByIds('class_enrollments', batch.created_enrollment_ids ?? [], classId, req.userId!, req.ip)

    const now = new Date().toISOString()
    const { data: after, error: updateError } = await supabase
      .from('legacy_import_batches')
      .update({
        status: 'rolled_back',
        rolled_back_by: req.userId!,
        rolled_back_at: now,
        updated_at: now,
      })
      .eq('id', batchId)
      .select()
      .single()
    if (updateError) throw updateError

    await logAudit({
      userId: req.userId!,
      action: 'UPDATE',
      tableName: 'legacy_import_batches',
      recordId: batchId,
      before: before as Record<string, unknown>,
      after: after as Record<string, unknown>,
      metadata: { rollback: true, deleted_reports: deletedReports, deleted_hours: deletedHours, deleted_enrollments: deletedEnrollments },
      ipAddress: req.ip,
    })

    res.json({ batch: after, deleted_reports: deletedReports, deleted_hours: deletedHours, deleted_enrollments: deletedEnrollments })
  } catch (err) {
    next(err)
  }
})
