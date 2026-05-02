/**
 * server/src/routes/search.ts — Global search endpoint
 *
 * GET /search?q=<term>
 * Auth: any authenticated user (requireAuth applied upstream)
 * Role-aware scoping:
 *   coordinator — searches all classes, students, trainers, and reports
 *   trainer     — searches only within classes where they appear in class_trainers
 *
 * Returns at most 5 ranked results per category. Empty categories return [].
 */

import { Router, type Request, type Response, type NextFunction } from 'express'
import { supabase } from '../lib/supabase'

export const searchRouter = Router()

const EMPTY_RESULTS = { classes: [], students: [], trainers: [], reports: [] }

function normalize(value: unknown): string {
  return String(value ?? '').toLowerCase().replace(/\s+/g, ' ').trim()
}

function rankText(query: string, fields: unknown[], baseScore = 0): number {
  const q = normalize(query)
  if (!q) return 0

  let score = 0
  for (const field of fields) {
    const value = normalize(field)
    if (!value) continue
    if (value === q) score = Math.max(score, 100)
    else if (value.startsWith(q)) score = Math.max(score, 85)
    else if (value.includes(q)) score = Math.max(score, 60)
  }

  return score > 0 ? score + baseScore : 0
}

function limitRanked<T>(rows: T[], scoreRow: (row: T) => number, labelRow: (row: T) => string): Array<T & { score: number }> {
  return rows
    .map(row => ({ ...row, score: scoreRow(row) }))
    .filter(row => row.score > 0)
    .sort((a, b) => b.score - a.score || labelRow(a).localeCompare(labelRow(b)))
    .slice(0, 5)
}

function relatedClass(input: unknown): Record<string, unknown> {
  if (Array.isArray(input)) return (input[0] as Record<string, unknown> | undefined) ?? {}
  return (input as Record<string, unknown> | null) ?? {}
}

searchRouter.get('/search', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const q = (req.query.q as string | undefined)?.trim() ?? ''
    if (q.length < 2) {
      res.json(EMPTY_RESULTS)
      return
    }

    const isCoordinator = req.userRole === 'coordinator'
    const trainerEmail = req.userEmail!

    let trainerClassIds: string[] = []
    if (!isCoordinator) {
      const { data: trainerRows, error: trainerError } = await supabase
        .from('class_trainers')
        .select('class_id')
        .eq('trainer_email', trainerEmail)
      if (trainerError) throw trainerError
      trainerClassIds = (trainerRows ?? []).map((r: { class_id: string }) => r.class_id)
      if (trainerClassIds.length === 0) {
        res.json(EMPTY_RESULTS)
        return
      }
    }

    let classesQuery = supabase
      .from('classes')
      .select('id, name, site, province, game_type, start_date, end_date, archived')
      .order('start_date', { ascending: false })
      .limit(500)
    if (!isCoordinator) classesQuery = classesQuery.in('id', trainerClassIds)
    const { data: classRows, error: classError } = await classesQuery
    if (classError) throw classError

    let studentQuery = supabase
      .from('class_enrollments')
      .select('id, student_name, student_email, class_id, group_label, classes!inner(name, game_type, start_date, end_date)')
      .order('student_name', { ascending: true })
      .limit(1000)
    if (!isCoordinator) studentQuery = studentQuery.in('class_id', trainerClassIds)
    const { data: studentRowsRaw, error: studentError } = await studentQuery
    if (studentError) throw studentError
    const studentRows = studentRowsRaw ?? []

    let trainerRows: Array<Record<string, unknown>> = []
    let trainerQuery = supabase
      .from('class_trainers')
      .select('id, trainer_name, trainer_email, class_id, classes!inner(name, game_type, start_date, end_date)')
      .order('trainer_name', { ascending: true })
      .limit(1000)
    if (!isCoordinator) trainerQuery = trainerQuery.in('class_id', trainerClassIds)
    const { data: trainerRowsRaw, error: trainerRowsError } = await trainerQuery
    if (trainerRowsError) throw trainerRowsError
    const seenTrainerEmails = new Set<string>()
    for (const row of trainerRowsRaw ?? []) {
      const typed = row as Record<string, unknown>
      const email = normalize(typed.trainer_email)
      if (email && seenTrainerEmails.has(email)) continue
      if (email) seenTrainerEmails.add(email)
      trainerRows.push(typed)
    }

    const matchingStudentClassIds = new Set(
      studentRows
        .filter(row => {
          const typed = row as Record<string, unknown>
          const classRow = relatedClass(typed.classes)
          return rankText(q, [
            typed.student_name,
            typed.student_email,
            typed.group_label,
            classRow.name,
            classRow.game_type,
            classRow.start_date,
            classRow.end_date,
          ]) > 0
        })
        .map(row => (row as Record<string, unknown>).class_id as string),
    )

    let reportQuery = supabase
      .from('class_daily_reports')
      .select('id, class_id, report_date, group_label, game, session_label, class_start_time, class_end_time, classes!inner(name, site, province, game_type, start_date, end_date)')
      .order('report_date', { ascending: false })
      .limit(1000)
    if (!isCoordinator) reportQuery = reportQuery.in('class_id', trainerClassIds)
    const { data: reportRowsRaw, error: reportError } = await reportQuery
    if (reportError) throw reportError
    const reportRows = reportRowsRaw ?? []

    const classes = limitRanked(
      (classRows ?? []) as Array<Record<string, unknown>>,
      row => rankText(q, [
        row.name,
        row.site,
        row.province,
        row.game_type,
        row.start_date,
        row.end_date,
      ], 20),
      row => String(row.name ?? ''),
    ).map(row => ({
      type: 'class' as const,
      id: row.id,
      name: row.name,
      site: row.site,
      province: row.province,
      gameType: row.game_type,
      startDate: row.start_date,
      endDate: row.end_date,
      archived: row.archived,
      score: row.score,
    }))

    const students = limitRanked(
      studentRows as Array<Record<string, unknown>>,
      row => {
        const classRow = relatedClass(row.classes)
        return rankText(q, [
          row.student_name,
          row.student_email,
          row.group_label,
          classRow.name,
          classRow.game_type,
          classRow.start_date,
          classRow.end_date,
        ])
      },
      row => String(row.student_name ?? ''),
    ).map(row => ({
      type: 'student' as const,
      id: row.id,
      name: row.student_name,
      email: row.student_email,
      classId: row.class_id,
      className: relatedClass(row.classes).name ?? '',
      groupLabel: row.group_label,
      score: row.score,
    }))

    const trainers = limitRanked(
      trainerRows,
      row => {
        const classRow = relatedClass(row.classes)
        return rankText(q, [
          row.trainer_name,
          row.trainer_email,
          classRow.name,
          classRow.game_type,
          classRow.start_date,
          classRow.end_date,
        ])
      },
      row => String(row.trainer_name ?? ''),
    ).map(row => ({
      type: 'trainer' as const,
      id: row.id,
      name: row.trainer_name,
      email: row.trainer_email,
      classId: row.class_id,
      className: relatedClass(row.classes).name ?? '',
      score: row.score,
    }))

    const reports = limitRanked(
      reportRows as Array<Record<string, unknown>>,
      row => {
        const classRow = relatedClass(row.classes)
        const classStudentBoost = matchingStudentClassIds.has(row.class_id as string) ? 15 : 0
        const fieldScore = rankText(q, [
          row.report_date,
          row.group_label,
          row.game,
          row.session_label,
          row.class_start_time,
          row.class_end_time,
          classRow.name,
          classRow.site,
          classRow.province,
          classRow.game_type,
          classRow.start_date,
          classRow.end_date,
        ])
        return fieldScore > 0 ? fieldScore + classStudentBoost : classStudentBoost
      },
      row => `${row.report_date ?? ''} ${relatedClass(row.classes).name ?? ''}`,
    ).map(row => ({
      type: 'report' as const,
      id: row.id,
      classId: row.class_id,
      className: relatedClass(row.classes).name ?? '',
      reportDate: row.report_date,
      groupLabel: row.group_label,
      game: row.game,
      sessionLabel: row.session_label,
      classStartTime: row.class_start_time,
      classEndTime: row.class_end_time,
      score: row.score,
    }))

    res.json({ classes, students, trainers, reports })
  } catch (err) {
    next(err)
  }
})
