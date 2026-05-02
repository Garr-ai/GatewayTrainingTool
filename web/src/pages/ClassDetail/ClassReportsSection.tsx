/**
 * pages/ClassDetail/ClassReportsSection.tsx — Daily reports and logged hours tabs
 *
 * This is the most complex component in the app. It serves two tabs in ClassDetailPage
 * via the `mode` prop:
 *
 *   mode="reports" — Daily Reports tab
 *     Creates and edits daily training reports with three sections:
 *       1. Header fields (date, group, game, session, time, M&G counts, trainee count, licenses)
 *       2. Trainers for the day (checkboxes from the class trainers list)
 *       3. Hours totals (auto-calculated from logged hours, with manual override fields)
 *       4. Training timeline (drag-and-drop reorderable table of time blocks)
 *       5. Per-trainee progress (ratings, homework, coming-back flag, notes for each student)
 *     "View PDF" opens ReportPreviewModal with a formatted HTML report for print/download.
 *
 *   mode="hours" — Logged Hours tab
 *     Simple CRUD interface for logging hours against trainers or students for payroll.
 *     Hours are used by the reports tab to calculate training/paid/live totals.
 *
 * Shared state: both modes share the same loaded state (trainers, enrollments, reports,
 * and hours are all loaded in a single Promise.all on mount) so switching tabs is instant.
 *
 * Timeline drag-and-drop:
 *   Uses HTML5 drag events with `dragIndexRef` to track which row is being dragged.
 *   On drop, the array is spliced to move the row to the new position.
 *
 * Hours totals computation:
 *   `computedTotalsForDate(date)` sums all hours logged up to and including the
 *   report's date. Override fields let the coordinator manually set these values
 *   if the logged hours don't perfectly reflect reality (e.g. off-system hours).
 */

import { useEffect, useMemo, useRef, useState } from 'react'
import { api, type ReportWithNested, type ReportBody } from '../../lib/apiClient'
import type { ReportPdfArgs } from '../../lib/reportPdf'
import { parseLegacyWorkbook, type ParsedLegacyReport, type ParsedPayrollRow } from '../../lib/legacyReportImport'
import { ReportPreviewModal } from '../../components/ReportPreviewModal'
import { ReportEditForm } from '../../components/ReportEditForm'
import { useToast } from '../../contexts/ToastContext'
import { useClassDetail } from '../../contexts/ClassDetailContext'
import { ConfirmDialog } from '../../components/ConfirmDialog'
import { SkeletonTable } from '../../components/Skeleton'
import { EmptyState } from '../../components/EmptyState'
import type {
  ClassDailyReport,
  ClassLoggedHours,
  LoggedHoursPersonType,
  ClassEnrollment,
  ClassScheduleSlot,
} from '../../types'

interface ClassReportsSectionProps {
  classId: string              // UUID of the class
  className: string            // Display name used in empty states and PDF generation
  mode: 'reports' | 'hours'   // Which tab this component is currently rendering
  defaultGameType?: string | null  // Class's game type, used as default when creating new reports
  classStartDate?: string
}

interface ReportDraftState {
  initialValues: Partial<ReportBody>
  enrollmentIds: string[] | null
  sourceLabel: string
}

interface ImportBatchSummary {
  id: string
  createdReportIds: string[]
  createdHourIds: string[]
  createdEnrollmentIds: string[]
  reportCount: number
  payrollCount: number
  enrollmentCount: number
  progressUnmatched: number
}

const normalizeName = (value: string) => value.replace(/\s+/g, ' ').trim().toLowerCase()
const nameTokens = (value: string) => normalizeName(value).split(' ').filter(Boolean)

function buildEnrollmentNameMap(rows: ClassEnrollment[]) {
  const map = new Map<string, ClassEnrollment>()
  for (const enr of rows) {
    const key = normalizeName(enr.student_name)
    if (key && !map.has(key)) map.set(key, enr)
  }
  return map
}

function findEnrollmentByName(
  rawName: string,
  map: Map<string, ClassEnrollment>,
  rows: ClassEnrollment[],
): ClassEnrollment | null {
  const normalized = normalizeName(rawName)
  const exact = map.get(normalized)
  if (exact) return exact

  const tokens = nameTokens(rawName)
  if (tokens.length >= 2) {
    const first = tokens[0]
    const last = tokens[tokens.length - 1]
    for (const enr of rows) {
      const enrTokens = nameTokens(enr.student_name)
      if (enrTokens.length < 2) continue
      if (first === enrTokens[0] && last === enrTokens[enrTokens.length - 1]) return enr
    }
  }

  for (const enr of rows) {
    const enrName = normalizeName(enr.student_name)
    if (normalized.includes(enrName) || enrName.includes(normalized)) return enr
  }
  return null
}

function todayIso() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function scheduleTime(value: string) {
  return value.slice(0, 5)
}

export function ClassReportsSection({ classId, className, mode, defaultGameType, classStartDate }: ClassReportsSectionProps) {
  const { toast } = useToast()
  const [confirmState, setConfirmState] = useState<{
    title: string
    message: string
    confirmLabel: string
    confirmVariant: 'danger' | 'primary'
    onConfirm: () => void
  } | null>(null)

  // Data comes from the shared ClassDetailContext cache
  const {
    trainers, enrollments: allEnrollments, schedule, reports, hours, drills,
    loading, refreshReports, refreshHours, refreshEnrollments, setReports, setHours,
  } = useClassDetail()
  // Only enrolled students appear in daily progress (dropped/failed are excluded)
  const enrollments = useMemo(
    () => allEnrollments.filter(e => e.status === 'enrolled'),
    [allEnrollments],
  )
  const [error, setError] = useState<string | null>(null)

  // ── Daily report form state ───────────────────────────────────────────────
  // Controls the inline report form panel (shown above the reports table)
  const [reportFormOpen, setReportFormOpen] = useState(false)
  // Full report being edited (null when creating new)
  const [editingReportFull, setEditingReportFull] = useState<ReportWithNested | null>(null)
  const [reportDraft, setReportDraft] = useState<ReportDraftState | null>(null)
  const [previewArgs, setPreviewArgs] = useState<ReportPdfArgs | null>(null)
  // Cache of full report details (keyed by report ID) so editing then viewing PDF skips a re-fetch
  const reportCacheRef = useRef<Record<string, ReportWithNested>>({})

  // ── Logged hours form state ───────────────────────────────────────────────
  const [hoursFormOpen, setHoursFormOpen] = useState(false)
  const [editingHours, setEditingHours] = useState<ClassLoggedHours | null>(null)
  const [hoursDate, setHoursDate] = useState('')
  const [hoursPersonType, setHoursPersonType] = useState<LoggedHoursPersonType>('trainer')
  const [hoursTrainerId, setHoursTrainerId] = useState('')
  const [hoursEnrollmentId, setHoursEnrollmentId] = useState('')
  const [hoursValue, setHoursValue] = useState('')
  const [hoursNotes, setHoursNotes] = useState('')
  const [hoursSaving, setHoursSaving] = useState(false)
  const [importParsing, setImportParsing] = useState(false)
  const [importing, setImporting] = useState(false)
  const [legacyFileName, setLegacyFileName] = useState('')
  const [parsedLegacyReports, setParsedLegacyReports] = useState<ParsedLegacyReport[]>([])
  const [parsedPayrollRows, setParsedPayrollRows] = useState<ParsedPayrollRow[]>([])
  const [excludedLegacySheets, setExcludedLegacySheets] = useState<Array<{ sheetName: string; reason: string }>>([])
  const [payrollParseWarnings, setPayrollParseWarnings] = useState<string[]>([])
  const [selectedReportIds, setSelectedReportIds] = useState<Set<string>>(new Set())
  const [lastImportBatch, setLastImportBatch] = useState<ImportBatchSummary | null>(null)

  const today = todayIso()
  const todaysScheduleSlots = useMemo(
    () => schedule
      .filter(slot => slot.slot_date === today)
      .sort((a, b) => `${a.start_time}${a.group_label ?? ''}`.localeCompare(`${b.start_time}${b.group_label ?? ''}`)),
    [schedule, today],
  )
  const nextScheduleSlot = useMemo(
    () => schedule
      .filter(slot => slot.slot_date >= today)
      .sort((a, b) => `${a.slot_date}${a.start_time}`.localeCompare(`${b.slot_date}${b.start_time}`))[0] ?? null,
    [schedule, today],
  )
  const activeReportEnrollments = useMemo(() => {
    if (!reportDraft?.enrollmentIds) return enrollments
    const allowed = new Set(reportDraft.enrollmentIds)
    return enrollments.filter(enrollment => allowed.has(enrollment.id))
  }, [enrollments, reportDraft])
  const reportAutosaveKey = useMemo(() => {
    const source = editingReportFull ?? reportDraft?.initialValues
    const date = source?.report_date ?? 'new'
    const group = source?.group_label ?? 'all'
    const session = source?.session_label ?? editingReportFull?.id ?? reportDraft?.sourceLabel ?? 'manual'
    return `daily-report-draft:${classId}:${date}:${group}:${session}`
  }, [classId, editingReportFull, reportDraft])
  const legacyImportReview = useMemo(() => {
    const enrollmentMap = buildEnrollmentNameMap(allEnrollments)
    const parsedNames = [...new Set(
      parsedLegacyReports
        .flatMap(report => [
          ...report.studentNames,
          ...report.progressEntries.map(entry => entry.studentName),
        ])
        .map(name => name.trim())
        .filter(Boolean),
    )]
    const missingStudentNames = parsedNames.filter(name => !findEnrollmentByName(name, enrollmentMap, allEnrollments))
    const progressEntries = parsedLegacyReports.reduce((sum, report) => sum + report.progressEntries.length, 0)
    const warningCount = parsedLegacyReports.reduce((sum, report) => sum + report.warnings.length, 0) + payrollParseWarnings.length
    return {
      parsedStudentCount: parsedNames.length,
      missingStudentNames,
      progressEntries,
      warningCount,
    }
  }, [allEnrollments, parsedLegacyReports, payrollParseWarnings])

  function enrollmentsForScheduleSlot(slot: ClassScheduleSlot) {
    if (!slot.group_label) return enrollments
    const grouped = enrollments.filter(enrollment => normalizeName(enrollment.group_label ?? '') === normalizeName(slot.group_label ?? ''))
    return grouped.length > 0 ? grouped : enrollments
  }

  function reportExistsForScheduleSlot(slot: ClassScheduleSlot) {
    return reports.some(report =>
      report.report_date === slot.slot_date &&
      (report.group_label ?? '') === (slot.group_label ?? '') &&
      (report.class_start_time ?? '').slice(0, 5) === scheduleTime(slot.start_time) &&
      (report.class_end_time ?? '').slice(0, 5) === scheduleTime(slot.end_time),
    )
  }

  function buildDraftFromScheduleSlot(slot: ClassScheduleSlot): ReportDraftState {
    const draftEnrollments = enrollmentsForScheduleSlot(slot)
    const activity = slot.notes?.trim() || 'Training session'
    const groupLabel = slot.group_label?.trim() || null
    return {
      enrollmentIds: draftEnrollments.map(enrollment => enrollment.id),
      sourceLabel: `${slot.slot_date}${groupLabel ? ` · Group ${groupLabel}` : ''} · ${scheduleTime(slot.start_time)}-${scheduleTime(slot.end_time)}`,
      initialValues: {
        report_date: slot.slot_date,
        group_label: groupLabel,
        game: defaultGameType ?? null,
        session_label: slot.notes?.trim() || (groupLabel ? `Group ${groupLabel} session` : 'Scheduled session'),
        class_start_time: scheduleTime(slot.start_time),
        class_end_time: scheduleTime(slot.end_time),
        current_trainees: draftEnrollments.length,
        trainer_ids: slot.trainer_id ? [slot.trainer_id] : [],
        timeline: [{
          start_time: scheduleTime(slot.start_time),
          end_time: scheduleTime(slot.end_time),
          activity,
          homework_handouts_tests: null,
          category: 'Scheduled session',
        }],
      },
    }
  }

  function openDraftFromScheduleSlot(slot: ClassScheduleSlot) {
    setEditingReportFull(null)
    setReportDraft(buildDraftFromScheduleSlot(slot))
    setReportFormOpen(true)
  }

  /** Resets the form and opens it in "add new report" mode. */
  function openAddReport() {
    setEditingReportFull(null)
    setReportDraft(nextScheduleSlot ? buildDraftFromScheduleSlot(nextScheduleSlot) : null)
    setReportFormOpen(true)
  }

  /**
   * Fetches the full report (with nested data) for editing and opens the form.
   * Uses the cache so switching between edit and PDF preview avoids extra fetches.
   */
  async function openEditReport(r: ClassDailyReport) {
    try {
      const full = reportCacheRef.current[r.id] ?? await api.reports.get(r.id)
      reportCacheRef.current[r.id] = full
      setEditingReportFull(full)
      setReportDraft(null)
      setReportFormOpen(true)
    } catch (err) {
      setError((err as Error).message)
    }
  }

  /** Called by ReportEditForm when the user submits; handles create and update. */
  async function handleSaveFromForm(body: ReportBody) {
    setError(null)
    try {
      if (editingReportFull) {
        await api.reports.update(classId, editingReportFull.id, body)
        delete reportCacheRef.current[editingReportFull.id]
        toast('Report updated successfully.', 'success')
      } else {
        const tempReport: ClassDailyReport = {
          id: `temp-${Date.now()}`,
          class_id: classId,
          report_date: body.report_date,
          group_label: body.group_label ?? null,
          game: body.game ?? null,
          session_label: body.session_label ?? null,
          class_start_time: body.class_start_time ?? null,
          class_end_time: body.class_end_time ?? null,
          mg_confirmed: body.mg_confirmed ?? null,
          mg_attended: body.mg_attended ?? null,
          current_trainees: body.current_trainees ?? null,
          licenses_received: body.licenses_received ?? null,
          override_hours_to_date: body.override_hours_to_date ?? null,
          override_paid_hours_total: body.override_paid_hours_total ?? null,
          override_live_hours_total: body.override_live_hours_total ?? null,
          coordinator_notes: body.coordinator_notes ?? null,
          created_at: new Date().toISOString(),
        }
        setReports(prev => [tempReport, ...prev])
        await api.reports.create(classId, body)
        toast('Report created successfully.', 'success')
        refreshReports()
      }
      setReportFormOpen(false)
      setEditingReportFull(null)
      setReportDraft(null)
    } catch (err) {
      setError((err as Error).message)
      toast((err as Error).message, 'error')
      refreshReports()
      throw err
    }
  }

  /** Deletes a daily report after confirmation. This also deletes all nested data. */
  function handleRemoveReport(id: string) {
    setConfirmState({
      title: 'Delete report',
      message: 'Remove this report? This cannot be undone.',
      confirmLabel: 'Delete',
      confirmVariant: 'danger',
      onConfirm: async () => {
        setConfirmState(null)
        setReportFormOpen(false)
        setEditingReportFull(null)
        setReportDraft(null)
        setSelectedReportIds(prev => {
          const next = new Set(prev)
          next.delete(id)
          return next
        })
        const prev = reports
        setReports(r => r.filter(rep => rep.id !== id))
        toast('Report deleted successfully.', 'success')
        try {
          await api.reports.delete(classId, id)
        } catch (err) {
          toast((err as Error).message, 'error')
          setReports(prev)
        }
      },
    })
  }

  function toggleSelectReport(id: string) {
    setSelectedReportIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleSelectAllReports() {
    if (selectedReportIds.size === reports.length) {
      setSelectedReportIds(new Set())
      return
    }
    setSelectedReportIds(new Set(reports.map(r => r.id)))
  }

  function handleBulkDeleteReports() {
    if (selectedReportIds.size === 0) return
    const ids = [...selectedReportIds]
    setConfirmState({
      title: 'Bulk delete reports',
      message: `Permanently delete ${ids.length} report${ids.length !== 1 ? 's' : ''}? This cannot be undone.`,
      confirmLabel: 'Delete',
      confirmVariant: 'danger',
      onConfirm: async () => {
        setConfirmState(null)
        setSelectedReportIds(new Set())
        const prev = reports
        const idSet = new Set(ids)
        setReports(r => r.filter(rep => !idSet.has(rep.id)))

        let failed = 0
        for (const id of ids) {
          try {
            await api.reports.delete(classId, id)
          } catch {
            failed += 1
          }
        }

        if (failed > 0) {
          setReports(prev)
          await refreshReports()
          toast(`Deleted ${ids.length - failed}, failed ${failed}.`, 'error')
        } else {
          toast(`${ids.length} report${ids.length !== 1 ? 's' : ''} deleted.`, 'success')
        }
      },
    })
  }

  /**
   * Fetches the full report (with nested data) and sets `previewArgs` to open
   * the ReportPreviewModal. The modal uses the trainers/enrollments already
   * in state to resolve IDs to display names.
   */
  async function handleViewPdf(r: ClassDailyReport) {
    try {
      const full = reportCacheRef.current[r.id] ?? await api.reports.get(r.id)
      reportCacheRef.current[r.id] = full
      setPreviewArgs({ report: full, className, trainers, enrollments, drills })
    } catch (err) {
      setError((err as Error).message)
    }
  }

  /** Resets the hours form and opens it in "add new hours" mode. */
  function openAddHours() {
    setEditingHours(null)
    setHoursDate('')
    setHoursPersonType('trainer')
    setHoursTrainerId('')
    setHoursEnrollmentId('')
    setHoursValue('')
    setHoursNotes('')
    setHoursFormOpen(true)
  }

  /** Pre-fills the hours form with an existing entry's data for editing. */
  function openEditHours(h: ClassLoggedHours) {
    setEditingHours(h)
    setHoursDate(h.log_date)
    setHoursPersonType(h.person_type)
    setHoursTrainerId(h.trainer_id ?? '')
    setHoursEnrollmentId(h.enrollment_id ?? '')
    setHoursValue(String(h.hours))
    setHoursNotes(h.notes ?? '')
    setHoursFormOpen(true)
  }

  /**
   * Validates and saves a logged hours entry (create or update).
   * Validates that:
   *   - A valid positive number is entered for hours
   *   - A trainer or student is selected depending on person_type
   * trainer_id and enrollment_id are mutually exclusive based on person_type.
   */
  async function handleSaveHours(e: React.FormEvent) {
    e.preventDefault()
    if (!hoursDate || !hoursValue) return
    const numHours = Number(hoursValue)
    if (Number.isNaN(numHours) || numHours <= 0) return

    // Only set the relevant ID field based on person_type; clear the other
    const trainerId = hoursPersonType === 'trainer' ? hoursTrainerId || null : null
    const enrollmentId = hoursPersonType === 'student' ? hoursEnrollmentId || null : null
    if (hoursPersonType === 'trainer' && !trainerId) {
      setError('Select a trainer.')
      return
    }
    if (hoursPersonType === 'student' && !enrollmentId) {
      setError('Select a student.')
      return
    }

    setHoursSaving(true)
    setError(null)

    const payload = {
      log_date: hoursDate,
      person_type: hoursPersonType,
      trainer_id: trainerId,
      enrollment_id: enrollmentId,
      hours: numHours,
      notes: hoursNotes.trim() || null,
    }

    try {
      if (editingHours) {
        await api.hours.update(classId, editingHours.id, payload)
        toast('Hours updated successfully.', 'success')
        refreshHours()
      } else {
        // Optimistic: add to list immediately
        const tempEntry: ClassLoggedHours = {
          id: `temp-${Date.now()}`,
          class_id: classId,
          log_date: hoursDate,
          person_type: hoursPersonType,
          trainer_id: trainerId,
          enrollment_id: enrollmentId,
          hours: numHours,
          paid: false,
          live_training: false,
          notes: hoursNotes.trim() || null,
          created_at: new Date().toISOString(),
        }
        setHours(prev => [tempEntry, ...prev])
        await api.hours.create(classId, payload)
        toast('Hours logged successfully.', 'success')
        refreshHours()
      }
      setHoursFormOpen(false)
    } catch (err) {
      setError((err as Error).message)
      toast((err as Error).message, 'error')
      refreshHours()
    } finally {
      setHoursSaving(false)
    }
  }

  async function handleRemoveHours(id: string) {
    const prev = hours
    setHours(h => h.filter(entry => entry.id !== id))
    toast('Hours entry removed', 'success')
    try {
      await api.hours.delete(classId, id)
    } catch (err) {
      toast((err as Error).message, 'error')
      setHours(prev)
    }
  }

  /**
   * Resolves a logged hours entry to a human-readable person name.
   * Looks up trainer_id in the trainers array or enrollment_id in the
   * enrollments array depending on person_type.
   */
  function personName(h: ClassLoggedHours) {
    if (h.person_type === 'trainer' && h.trainer_id) {
      return trainers.find(t => t.id === h.trainer_id)?.trainer_name ?? '—'
    }
    if (h.person_type === 'student' && h.enrollment_id) {
      return enrollments.find(enr => enr.id === h.enrollment_id)?.student_name ?? '—'
    }
    return '—'
  }

  // Sum of all logged hours for the class, shown in the hours tab header
  const totalHours = hours.reduce((sum, h) => sum + h.hours, 0)

  useEffect(() => {
    setSelectedReportIds(prev => {
      const reportIds = new Set(reports.map(r => r.id))
      const next = new Set([...prev].filter(id => reportIds.has(id)))
      return next.size === prev.size ? prev : next
    })
  }, [reports])

  async function handleLegacyFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setImportParsing(true)
    setLegacyFileName(file.name)
    setParsedLegacyReports([])
    setParsedPayrollRows([])
    setExcludedLegacySheets([])
    setPayrollParseWarnings([])
    setLastImportBatch(null)
    try {
      const parsed = await parseLegacyWorkbook({
        file,
        trainers,
        defaultGame: defaultGameType,
        classStartDate,
      })
      setParsedLegacyReports(parsed.reports)
      setParsedPayrollRows(parsed.payrollRows)
      setExcludedLegacySheets(parsed.excludedSheets)
      setPayrollParseWarnings(parsed.payrollWarnings)
      toast(
        `Parsed ${parsed.reports.length} report sheet${parsed.reports.length === 1 ? '' : 's'}${parsed.excludedSheets.length ? `, excluded ${parsed.excludedSheets.length}` : ''}${parsed.payrollRows.length ? `, payroll rows ${parsed.payrollRows.length}` : ''}.`,
        'success',
      )
    } catch (err) {
      toast(`Import parse failed: ${(err as Error).message}`, 'error')
    } finally {
      setImportParsing(false)
      e.target.value = ''
    }
  }

  async function handleImportParsedReports() {
    if (parsedLegacyReports.length === 0 && parsedPayrollRows.length === 0) return
    setImporting(true)
    setError(null)

    const existingKeys = new Set(
      reports.map(r => `${r.report_date}|${r.group_label ?? ''}|${r.session_label ?? ''}`),
    )

    let created = 0
    let skipped = 0
    let failed = 0
    let payrollImported = 0
    let payrollSkipped = 0
    let payrollFailed = 0
    let studentProfilesCreated = 0
    let studentEnrollmentsCreated = 0
    let studentEnrollmentsSkipped = 0
    let studentEnrollmentsFailed = 0
    let progressUnmatched = 0
    const importBatchId = `legacy-${new Date().toISOString().replaceAll('-', '').replaceAll(':', '').replaceAll('.', '').replaceAll('T', '').replaceAll('Z', '').slice(0, 14)}`
    const createdReportIds: string[] = []
    const createdHourIds: string[] = []
    const createdEnrollmentIds: string[] = []

    const parsedStudentNames = [...new Set(
      parsedLegacyReports
        .flatMap(r => [
          ...r.studentNames,
          ...r.progressEntries.map(p => p.studentName),
        ])
        .map(s => s.trim())
        .filter(Boolean),
    )]
    if (parsedStudentNames.length > 0) {
      try {
        const profileResult = await api.profiles.createLegacyStudents({ students: parsedStudentNames })
        studentProfilesCreated = profileResult.data.filter(s => s.created).length

        const enrollmentKey = (studentName: string, studentEmail: string) => `${studentName.toLowerCase()}|${studentEmail.toLowerCase()}`
        const existingEnrollmentKeys = new Set(
          allEnrollments.map(e => enrollmentKey(e.student_name, e.student_email)),
        )
        for (const student of profileResult.data) {
          const key = enrollmentKey(student.full_name, student.email)
          if (existingEnrollmentKeys.has(key)) {
            studentEnrollmentsSkipped += 1
            continue
          }
          try {
            const createdEnrollment = await api.enrollments.create(classId, {
              student_name: student.full_name,
              student_email: student.email,
              status: 'enrolled',
              group_label: undefined,
            })
            existingEnrollmentKeys.add(key)
            createdEnrollmentIds.push(createdEnrollment.id)
            studentEnrollmentsCreated += 1
          } catch {
            studentEnrollmentsFailed += 1
          }
        }
      } catch {
        studentEnrollmentsFailed += parsedStudentNames.length
      }
    }

    const enrollmentsAfterImport = await api.enrollments.list(classId)
    const enrollmentByName = buildEnrollmentNameMap(enrollmentsAfterImport)

    for (const parsed of parsedLegacyReports) {
      const key = `${parsed.body.report_date}|${parsed.body.group_label ?? ''}|${parsed.body.session_label ?? ''}`
      if (existingKeys.has(key)) {
        skipped += 1
        continue
      }
      try {
        const progress = parsed.progressEntries
          .map(entry => {
            const enrollment = findEnrollmentByName(entry.studentName, enrollmentByName, enrollmentsAfterImport)
            if (!enrollment) {
              progressUnmatched += 1
              return null
            }
            return {
              enrollment_id: enrollment.id,
              progress_text: entry.progressText || null,
              gk_rating: null,
              dex_rating: null,
              hom_rating: null,
              coming_back_next_day: true,
              homework_completed: false,
              attendance: true,
              late: false,
            }
          })
          .filter(Boolean) as ReportBody['progress']

        const body: ReportBody = {
          ...parsed.body,
          current_trainees: parsed.body.current_trainees ?? (parsed.studentNames.length > 0 ? parsed.studentNames.length : null),
          progress,
        }

        const createdReport = await api.reports.create(classId, body)
        createdReportIds.push(createdReport.id)
        existingKeys.add(key)
        created += 1
      } catch {
        failed += 1
      }
    }

    const existingHourKeys = new Set(
      hours.map(h => `${h.log_date}|${h.person_type}|${h.trainer_id ?? ''}|${h.enrollment_id ?? ''}|${h.hours}|${h.paid ? 1 : 0}|${h.live_training ? 1 : 0}|${h.notes ?? ''}`),
    )
    for (const row of parsedPayrollRows) {
      const key = `${row.log_date}|${row.person_type}|${row.trainer_id}||${row.hours}|${row.paid ? 1 : 0}|${row.live_training ? 1 : 0}|${row.notes ?? ''}`
      if (existingHourKeys.has(key)) {
        payrollSkipped += 1
        continue
      }
      try {
        const createdHour = await api.hours.create(classId, row)
        createdHourIds.push(createdHour.id)
        existingHourKeys.add(key)
        payrollImported += 1
      } catch {
        payrollFailed += 1
      }
    }

    await refreshReports()
    await refreshHours()
    await refreshEnrollments()
    setLastImportBatch({
      id: importBatchId,
      createdReportIds,
      createdHourIds,
      createdEnrollmentIds,
      reportCount: created,
      payrollCount: payrollImported,
      enrollmentCount: studentEnrollmentsCreated,
      progressUnmatched,
    })
    setImporting(false)

    if (failed > 0 || payrollFailed > 0 || studentEnrollmentsFailed > 0) {
      toast(
        `Students: profiles created ${studentProfilesCreated}, enrollments imported ${studentEnrollmentsCreated}, skipped ${studentEnrollmentsSkipped}, failed ${studentEnrollmentsFailed}. Reports: imported ${created}, skipped ${skipped}, failed ${failed}, unmatched progress ${progressUnmatched}. Payroll: imported ${payrollImported}, skipped ${payrollSkipped}, failed ${payrollFailed}.`,
        'error',
      )
    } else {
      toast(
        `Students: profiles created ${studentProfilesCreated}, enrollments imported ${studentEnrollmentsCreated}${studentEnrollmentsSkipped ? ` (skipped ${studentEnrollmentsSkipped})` : ''}. Reports imported ${created}${skipped ? ` (skipped ${skipped})` : ''}${progressUnmatched ? `, unmatched progress ${progressUnmatched}` : ''}. Payroll rows imported ${payrollImported}${payrollSkipped ? ` (skipped ${payrollSkipped})` : ''}.`,
        'success',
      )
    }
  }

  function handleRollbackImportBatch(batch: ImportBatchSummary) {
    setConfirmState({
      title: 'Rollback import batch',
      message: `Delete ${batch.reportCount} report${batch.reportCount === 1 ? '' : 's'}, ${batch.payrollCount} payroll row${batch.payrollCount === 1 ? '' : 's'}, and ${batch.enrollmentCount} enrollment${batch.enrollmentCount === 1 ? '' : 's'} created by ${batch.id}?`,
      confirmLabel: 'Rollback',
      confirmVariant: 'danger',
      onConfirm: async () => {
        setConfirmState(null)
        let failed = 0
        for (const reportId of batch.createdReportIds) {
          try {
            await api.reports.delete(classId, reportId)
          } catch {
            failed += 1
          }
        }
        for (const hourId of batch.createdHourIds) {
          try {
            await api.hours.delete(classId, hourId)
          } catch {
            failed += 1
          }
        }
        for (const enrollmentId of batch.createdEnrollmentIds) {
          try {
            await api.enrollments.delete(classId, enrollmentId)
          } catch {
            failed += 1
          }
        }
        await refreshReports()
        await refreshHours()
        await refreshEnrollments()
        if (failed > 0) {
          toast(`Rollback finished with ${failed} failed delete${failed === 1 ? '' : 's'}.`, 'error')
        } else {
          toast('Import batch rolled back.', 'success')
          setLastImportBatch(null)
        }
      },
    })
  }

  if (loading) {
    return <SkeletonTable rows={4} cols={5} />
  }

  const fieldClass = 'mt-1 w-full bg-slate-100 dark:bg-gw-elevated border border-slate-200 dark:border-white/10 rounded-md px-2 py-1.5 text-xs text-slate-700 dark:text-slate-200 placeholder:text-slate-500 outline-none focus:border-gw-blue/40 focus:ring-2 focus:ring-gw-blue/15'

  return (
    <>
    <section className="space-y-4">
      {error && (
        <p className="rounded-md bg-rose-500/10 border border-rose-500/25 px-3 py-2 text-xs text-rose-400" role="alert">
          {error}
        </p>
      )}

      {mode === 'reports' && (
        <div className="bg-white dark:bg-gw-surface rounded-[10px] p-4">
          <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Daily reports</h3>
              <p className="mt-0.5 text-xs text-slate-500">
                Detailed daily reports by group, including schedule, homework/tests, and trainee progress.
              </p>
            </div>
            <div className="flex flex-wrap gap-2 self-start sm:self-auto">
              {todaysScheduleSlots.length > 0 && (
                <button
                  type="button"
                  onClick={() => openDraftFromScheduleSlot(todaysScheduleSlots.find(slot => !reportExistsForScheduleSlot(slot)) ?? todaysScheduleSlots[0])}
                  className="rounded-md bg-gw-blue/15 border border-gw-blue/30 text-gw-blue font-semibold px-3 py-1.5 text-xs hover:bg-gw-blue/20 transition-colors duration-150"
                >
                  Draft today
                </button>
              )}
              <button type="button" onClick={openAddReport} className="rounded-md bg-gradient-to-r from-gw-blue to-gw-teal text-white font-semibold px-3 py-1.5 text-xs hover:brightness-110 transition-all duration-150 flex-shrink-0">
                + Add daily report
              </button>
            </div>
          </header>

          {todaysScheduleSlots.length > 0 && (
            <section className="mb-4 rounded-[10px] border border-slate-200 dark:border-white/[0.06] bg-slate-50 dark:bg-gw-elevated p-3">
              <div className="mb-2 flex items-center justify-between gap-2">
                <div>
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Today's scheduled drafts</h4>
                  <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">Start a report with date, group, time, trainer, and trainees already filled in.</p>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {todaysScheduleSlots.map(slot => {
                  const exists = reportExistsForScheduleSlot(slot)
                  const slotEnrollments = enrollmentsForScheduleSlot(slot)
                  const trainerName = slot.trainer_id ? trainers.find(t => t.id === slot.trainer_id)?.trainer_name : null
                  return (
                    <div key={slot.id} className="rounded-md border border-slate-200 dark:border-white/10 bg-white dark:bg-gw-surface px-3 py-2">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                            {slot.group_label ? `Group ${slot.group_label}` : 'All groups'} · {scheduleTime(slot.start_time)}-{scheduleTime(slot.end_time)}
                          </p>
                          <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400 truncate">
                            {trainerName ?? 'No trainer assigned'} · {slotEnrollments.length} trainee{slotEnrollments.length === 1 ? '' : 's'}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => openDraftFromScheduleSlot(slot)}
                          className={`rounded-md border px-2.5 py-1 text-[11px] font-semibold transition-colors ${
                            exists
                              ? 'border-slate-200 dark:border-white/10 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5'
                              : 'border-gw-blue/30 bg-gw-blue/15 text-gw-blue hover:bg-gw-blue/20'
                          }`}
                        >
                          {exists ? 'Draft another' : 'Draft report'}
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            </section>
          )}

          <section className="mb-4 rounded-[10px] border border-slate-200 dark:border-white/[0.06] bg-slate-50 dark:bg-gw-elevated p-3 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <div>
                <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Import Legacy Reports</h4>
                <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">Upload an old Excel daily report workbook. Each sheet is imported as one daily report.</p>
              </div>
              <label className="inline-flex items-center rounded-md bg-white dark:bg-gw-surface text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-white/10 px-3 py-1.5 text-xs font-semibold cursor-pointer hover:bg-slate-100 dark:hover:bg-gw-elevated transition-colors">
                {importParsing ? 'Parsing…' : 'Upload .xlsx'}
                <input type="file" accept=".xlsx,.xls" className="hidden" onChange={handleLegacyFileSelected} disabled={importParsing || importing} />
              </label>
            </div>

            {legacyFileName && (
              <p className="text-[11px] text-slate-500 dark:text-slate-400">File: {legacyFileName}</p>
            )}

            {excludedLegacySheets.length > 0 && (
              <div className="rounded-md border border-slate-200 dark:border-white/10 bg-white dark:bg-gw-surface px-3 py-2 text-[11px] text-slate-500 dark:text-slate-400">
                <p className="mb-1 font-semibold text-slate-600 dark:text-slate-300">Excluded sheets</p>
                <div className="space-y-0.5">
                  {excludedLegacySheets.map(sheet => (
                    <p key={sheet.sheetName}><span className="font-medium">{sheet.sheetName}</span>: {sheet.reason}</p>
                  ))}
                </div>
              </div>
            )}

            {payrollParseWarnings.length > 0 && (
              <div className="text-[11px] text-amber-500 space-y-1">
                {payrollParseWarnings.map(w => <p key={w}>{w}</p>)}
              </div>
            )}

            {lastImportBatch && (
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 rounded-md border border-emerald-500/25 bg-emerald-500/10 px-3 py-2">
                <div className="text-[11px] text-emerald-700 dark:text-emerald-300">
                  <p className="font-semibold">Last import batch: {lastImportBatch.id}</p>
                  <p>
                    {lastImportBatch.reportCount} report{lastImportBatch.reportCount === 1 ? '' : 's'}, {lastImportBatch.payrollCount} payroll row{lastImportBatch.payrollCount === 1 ? '' : 's'}, {lastImportBatch.enrollmentCount} enrollment{lastImportBatch.enrollmentCount === 1 ? '' : 's'}
                    {lastImportBatch.progressUnmatched ? ` · ${lastImportBatch.progressUnmatched} unmatched progress` : ''}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handleRollbackImportBatch(lastImportBatch)}
                  className="self-start sm:self-auto rounded-md border border-rose-500/25 bg-rose-500/10 px-2.5 py-1 text-[11px] font-semibold text-rose-500 hover:bg-rose-500/15 transition-colors"
                >
                  Rollback batch
                </button>
              </div>
            )}

            {(parsedLegacyReports.length > 0 || parsedPayrollRows.length > 0) && (
              <>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                  <div className="rounded-md border border-slate-200 dark:border-white/10 bg-white dark:bg-gw-surface px-3 py-2">
                    <p className="text-[10px] uppercase tracking-wide text-slate-500">Reports</p>
                    <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">{parsedLegacyReports.length}</p>
                  </div>
                  <div className="rounded-md border border-slate-200 dark:border-white/10 bg-white dark:bg-gw-surface px-3 py-2">
                    <p className="text-[10px] uppercase tracking-wide text-slate-500">Students</p>
                    <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">{legacyImportReview.parsedStudentCount}</p>
                  </div>
                  <div className="rounded-md border border-slate-200 dark:border-white/10 bg-white dark:bg-gw-surface px-3 py-2">
                    <p className="text-[10px] uppercase tracking-wide text-slate-500">New enrollments</p>
                    <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">{legacyImportReview.missingStudentNames.length}</p>
                  </div>
                  <div className="rounded-md border border-slate-200 dark:border-white/10 bg-white dark:bg-gw-surface px-3 py-2">
                    <p className="text-[10px] uppercase tracking-wide text-slate-500">Progress comments</p>
                    <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">{legacyImportReview.progressEntries}</p>
                  </div>
                  <div className="rounded-md border border-slate-200 dark:border-white/10 bg-white dark:bg-gw-surface px-3 py-2">
                    <p className="text-[10px] uppercase tracking-wide text-slate-500">Warnings</p>
                    <p className={`text-sm font-semibold ${legacyImportReview.warningCount ? 'text-amber-500' : 'text-slate-800 dark:text-slate-200'}`}>{legacyImportReview.warningCount}</p>
                  </div>
                </div>
                {legacyImportReview.missingStudentNames.length > 0 && (
                  <div className="rounded-md border border-amber-500/25 bg-amber-500/10 px-3 py-2 text-[11px] text-amber-600 dark:text-amber-400">
                    <p className="font-semibold">Will create/enroll missing students</p>
                    <p className="mt-1">{legacyImportReview.missingStudentNames.slice(0, 18).join(', ')}{legacyImportReview.missingStudentNames.length > 18 ? `, +${legacyImportReview.missingStudentNames.length - 18} more` : ''}</p>
                  </div>
                )}
                {parsedLegacyReports.length > 0 && (
                  <div className="overflow-auto rounded-md border border-slate-200 dark:border-white/10 bg-white dark:bg-gw-surface">
                    <table className="min-w-full text-[11px]">
                      <thead>
                        <tr className="border-b border-slate-200 dark:border-white/[0.06]">
                          <th className="px-2 py-1 text-left uppercase tracking-wide text-slate-500">Sheet</th>
                          <th className="px-2 py-1 text-left uppercase tracking-wide text-slate-500">Date</th>
                          <th className="px-2 py-1 text-left uppercase tracking-wide text-slate-500">Session / Time</th>
                          <th className="px-2 py-1 text-left uppercase tracking-wide text-slate-500">Trainers</th>
                          <th className="px-2 py-1 text-left uppercase tracking-wide text-slate-500">Students</th>
                          <th className="px-2 py-1 text-left uppercase tracking-wide text-slate-500">Progress</th>
                          <th className="px-2 py-1 text-left uppercase tracking-wide text-slate-500">Timeline Rows</th>
                          <th className="px-2 py-1 text-left uppercase tracking-wide text-slate-500">Warnings</th>
                        </tr>
                      </thead>
                      <tbody>
                        {parsedLegacyReports.map(parsed => {
                          const enrollmentMap = buildEnrollmentNameMap(allEnrollments)
                          const parsedNames = [...new Set([
                            ...parsed.studentNames,
                            ...parsed.progressEntries.map(entry => entry.studentName),
                          ].map(name => name.trim()).filter(Boolean))]
                          const missingCount = parsedNames.filter(name => !findEnrollmentByName(name, enrollmentMap, allEnrollments)).length
                          return (
                            <tr key={parsed.sheetName} className="border-b border-slate-100 dark:border-white/[0.03]">
                              <td className="px-2 py-1 text-slate-700 dark:text-slate-200">{parsed.sheetName}</td>
                              <td className="px-2 py-1 text-slate-600 dark:text-slate-300">{parsed.body.report_date}</td>
                              <td className="px-2 py-1 text-slate-600 dark:text-slate-300">
                                {(parsed.body.session_label ?? '—')} · {(parsed.body.class_start_time ?? '—')}–{(parsed.body.class_end_time ?? '—')}
                              </td>
                              <td className="px-2 py-1 text-slate-600 dark:text-slate-300">{parsed.body.trainer_ids.length}</td>
                              <td className="px-2 py-1 text-slate-600 dark:text-slate-300">{parsed.studentNames.length}{missingCount ? ` (${missingCount} new)` : ''}</td>
                              <td className="px-2 py-1 text-slate-600 dark:text-slate-300">{parsed.progressEntries.length}</td>
                              <td className="px-2 py-1 text-slate-600 dark:text-slate-300">{parsed.body.timeline.length}</td>
                              <td className="px-2 py-1 text-amber-500">{parsed.warnings.join(' ') || '—'}</td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Payroll rows queued for Payroll section: {parsedPayrollRows.length}
                  </p>
                  <button
                    type="button"
                    onClick={handleImportParsedReports}
                    disabled={importing || importParsing}
                    className="rounded-md bg-gradient-to-r from-gw-blue to-gw-teal text-white font-semibold px-3 py-1.5 text-xs hover:brightness-110 transition-all duration-150 disabled:opacity-60"
                  >
                    {importing ? 'Importing…' : `Import ${parsedLegacyReports.length} report${parsedLegacyReports.length === 1 ? '' : 's'}${parsedPayrollRows.length ? ` + ${parsedPayrollRows.length} payroll` : ''}`}
                  </button>
                </div>
              </>
            )}
          </section>

          {reportFormOpen && (
            <>
            {reportDraft && (
              <p className="mb-2 rounded-md border border-gw-blue/25 bg-gw-blue/10 px-3 py-2 text-xs text-gw-blue">
                Draft created from schedule: {reportDraft.sourceLabel}
              </p>
            )}
            <ReportEditForm
              report={editingReportFull}
              trainers={trainers}
              enrollments={activeReportEnrollments}
              drills={drills}
              hours={hours}
              defaultGame={editingReportFull?.game ?? reportDraft?.initialValues.game ?? defaultGameType ?? ''}
              initialValues={reportDraft?.initialValues}
              autosaveKey={reportAutosaveKey}
              onSave={handleSaveFromForm}
              onCancel={() => { setReportFormOpen(false); setEditingReportFull(null); setReportDraft(null) }}
              canDelete={!!editingReportFull}
              onDelete={editingReportFull ? () => handleRemoveReport(editingReportFull.id) : undefined}
              canEditCoordinatorNotes={true}
            />
            </>
          )}

          {reports.length === 0 ? (
            <div className="bg-slate-100 dark:bg-gw-elevated rounded-[10px]">
              <EmptyState
                title="No daily reports yet"
                description={`Create a report for ${className} to start tracking training sessions.`}
                variant="neutral"
              />
            </div>
          ) : (
            <>
            {/* Mobile: card layout */}
            <div className="sm:hidden space-y-2">
              {reports.map(r => (
                <div key={r.id} className="bg-slate-100 dark:bg-gw-elevated rounded-[10px] border border-slate-200 dark:border-white/[0.06] p-3">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <label className="inline-flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                      <input
                        type="checkbox"
                        checked={selectedReportIds.has(r.id)}
                        onChange={() => toggleSelectReport(r.id)}
                        className="rounded border-white/20 bg-slate-100 dark:bg-gw-elevated text-gw-blue focus:ring-gw-blue/30 [color-scheme:dark]"
                      />
                      Select
                    </label>
                    <div className="text-xs">
                      <p className="font-medium text-slate-700 dark:text-slate-200">{r.report_date}</p>
                      <p className="text-slate-500 mt-0.5">{r.group_label ?? '—'} &middot; {r.session_label ?? '—'} &middot; {r.game ?? '—'}</p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    <button type="button" onClick={() => openEditReport(r)} className="rounded-md bg-white/[0.06] border border-slate-200 dark:border-white/10 px-2.5 py-1.5 text-xs text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/10 transition-colors">Edit</button>
                    <button type="button" onClick={() => handleViewPdf(r)} className="rounded-md bg-gw-blue/15 border border-gw-blue/35 px-2.5 py-1.5 text-xs text-gw-blue hover:bg-gw-blue/20 transition-colors">View PDF</button>
                    <button type="button" onClick={() => handleRemoveReport(r.id)} className="rounded-md bg-rose-500/10 border border-rose-500/25 px-2.5 py-1.5 text-xs text-rose-400 hover:bg-rose-500/15 transition-colors">Remove</button>
                  </div>
                </div>
              ))}
            </div>
            {/* Desktop: table layout */}
            <div className="hidden sm:block bg-slate-100 dark:bg-gw-elevated rounded-[10px] overflow-hidden">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-white/[0.02] border-b border-slate-200 dark:border-white/[0.06]">
                    <th className="w-10 px-3 py-2">
                      <input
                        type="checkbox"
                        checked={reports.length > 0 && selectedReportIds.size === reports.length}
                        onChange={toggleSelectAllReports}
                        className="rounded border-white/20 bg-slate-100 dark:bg-gw-elevated text-gw-blue focus:ring-gw-blue/30 [color-scheme:dark]"
                      />
                    </th>
                    <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Date</th>
                    <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Group</th>
                    <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Session</th>
                    <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Game</th>
                    <th className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {reports.map(r => (
                    <tr key={r.id} className="border-b border-white/[0.03] hover:bg-white dark:bg-gw-surface transition-colors duration-100">
                      <td className="w-10 px-3 py-2">
                        <input
                          type="checkbox"
                          checked={selectedReportIds.has(r.id)}
                          onChange={() => toggleSelectReport(r.id)}
                          className="rounded border-white/20 bg-slate-100 dark:bg-gw-elevated text-gw-blue focus:ring-gw-blue/30 [color-scheme:dark]"
                        />
                      </td>
                      <td className="px-3 py-2 text-slate-700 dark:text-slate-200">{r.report_date}</td>
                      <td className="px-3 py-2 text-slate-500 dark:text-slate-400">{r.group_label ?? '—'}</td>
                      <td className="px-3 py-2 text-slate-500 dark:text-slate-400">{r.session_label ?? '—'}</td>
                      <td className="px-3 py-2 text-slate-500 dark:text-slate-400">{r.game ?? '—'}</td>
                      <td className="px-3 py-2 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button type="button" onClick={() => openEditReport(r)} className="rounded-md bg-white/[0.06] border border-slate-200 dark:border-white/10 px-2 py-1 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/10 transition-colors">Edit</button>
                          <button type="button" onClick={() => handleViewPdf(r)} className="rounded-md bg-gw-blue/15 border border-gw-blue/35 px-2 py-1 text-gw-blue hover:bg-gw-blue/20 transition-colors">View PDF</button>
                          <button type="button" onClick={() => handleRemoveReport(r.id)} className="rounded-md bg-rose-500/10 border border-rose-500/25 px-2 py-1 text-rose-400 hover:bg-rose-500/15 transition-colors">Remove</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {selectedReportIds.size > 0 && (
              <div className="sticky bottom-0 mt-2 flex items-center justify-between gap-3 bg-gw-dark border border-slate-200 dark:border-white/[0.08] rounded-[10px] px-3 py-2">
                <span className="text-xs font-medium text-slate-700 dark:text-slate-300">{selectedReportIds.size} selected</span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedReportIds(new Set())}
                    className="text-xs text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 transition-colors"
                  >
                    Clear
                  </button>
                  <button
                    type="button"
                    onClick={handleBulkDeleteReports}
                    className="rounded-md bg-rose-500/15 text-rose-400 border border-rose-500/25 px-3 py-1.5 text-xs font-semibold hover:bg-rose-500/20 transition-colors"
                  >
                    Delete
                  </button>
                </div>
              </div>
            )}
            </>
          )}
        </div>
      )}

      {mode === 'hours' && (
        <div className="bg-white dark:bg-gw-surface rounded-[10px] p-4">
          <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Logged hours</h3>
              <p className="mt-0.5 text-xs text-slate-500">Track hours for trainers and students for payroll. Total: {totalHours.toFixed(1)} hrs</p>
            </div>
            <button type="button" onClick={openAddHours} className="rounded-md bg-gradient-to-r from-gw-blue to-gw-teal text-white font-semibold px-3 py-1.5 text-xs hover:brightness-110 transition-all duration-150 self-start sm:self-auto flex-shrink-0">
              + Log hours
            </button>
          </header>

          {hoursFormOpen && (
            <div className="mb-4 bg-slate-100 dark:bg-gw-elevated rounded-[10px] border border-slate-200 dark:border-white/[0.06] p-3">
              <form onSubmit={handleSaveHours} className="space-y-3 text-xs">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <label className="block text-xs font-medium text-slate-500 dark:text-slate-400">Date
                    <input type="date" value={hoursDate} onChange={e => setHoursDate(e.target.value)} className={fieldClass} required />
                  </label>
                  <label className="block text-xs font-medium text-slate-500 dark:text-slate-400">Hours
                    <input type="number" step="0.25" min="0.25" value={hoursValue} onChange={e => setHoursValue(e.target.value)} className={fieldClass} placeholder="e.g. 4.5" required />
                  </label>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Person type</label>
                  <div className="flex gap-4">
                    <label className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400 cursor-pointer">
                      <input type="radio" name="personType" checked={hoursPersonType === 'trainer'} onChange={() => { setHoursPersonType('trainer'); setHoursEnrollmentId('') }} className="accent-gw-blue" />
                      Trainer
                    </label>
                    <label className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400 cursor-pointer">
                      <input type="radio" name="personType" checked={hoursPersonType === 'student'} onChange={() => { setHoursPersonType('student'); setHoursTrainerId('') }} className="accent-gw-blue" />
                      Student
                    </label>
                  </div>
                </div>
                {hoursPersonType === 'trainer' && (
                  <div>
                    <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Trainer</label>
                    <select value={hoursTrainerId} onChange={e => setHoursTrainerId(e.target.value)} className={fieldClass} required>
                      <option value="">— Select —</option>
                      {trainers.map(t => <option key={t.id} value={t.id}>{t.trainer_name}</option>)}
                    </select>
                  </div>
                )}
                {hoursPersonType === 'student' && (
                  <div>
                    <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Student</label>
                    <select value={hoursEnrollmentId} onChange={e => setHoursEnrollmentId(e.target.value)} className={fieldClass} required>
                      <option value="">— Select —</option>
                      {enrollments.map(enr => <option key={enr.id} value={enr.id}>{enr.student_name}</option>)}
                    </select>
                  </div>
                )}
                <div>
                  <label className="block text-xs font-medium text-slate-500 dark:text-slate-400">Notes
                    <input type="text" value={hoursNotes} onChange={e => setHoursNotes(e.target.value)} className={fieldClass} placeholder="Optional" />
                  </label>
                </div>
                <div className="flex gap-2">
                  <button type="button" onClick={() => setHoursFormOpen(false)} className="rounded-md bg-white dark:bg-gw-surface text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-white/10 px-3 py-1.5 text-xs font-semibold hover:bg-slate-100 dark:bg-gw-elevated transition-colors">Cancel</button>
                  <button type="submit" disabled={hoursSaving} className="rounded-md bg-gradient-to-r from-gw-blue to-gw-teal text-white px-3 py-1.5 text-xs font-semibold hover:brightness-110 transition-all disabled:opacity-60">
                    {hoursSaving ? 'Saving…' : editingHours ? 'Save changes' : 'Log hours'}
                  </button>
                </div>
              </form>
            </div>
          )}

          {hours.length === 0 ? (
            <div className="bg-slate-100 dark:bg-gw-elevated rounded-[10px]">
              <EmptyState
                title="No logged hours yet"
                description={`Log hours for ${className} to track trainer and student time.`}
                variant="neutral"
              />
            </div>
          ) : (
            <>
            {/* Mobile: card layout */}
            <div className="sm:hidden space-y-2">
              {hours.map(h => (
                <div key={h.id} className="bg-slate-100 dark:bg-gw-elevated rounded-[10px] border border-slate-200 dark:border-white/[0.06] p-3 cursor-pointer active:bg-white dark:bg-gw-surface" onClick={() => openEditHours(h)}>
                  <div className="flex items-start justify-between gap-2 text-xs">
                    <div>
                      <p className="font-medium text-slate-700 dark:text-slate-200">{h.log_date}</p>
                      <p className="text-slate-500 mt-0.5"><span className="capitalize">{h.person_type}</span> &middot; {personName(h)} &middot; {h.hours} hrs</p>
                    </div>
                    <button type="button" onClick={e => { e.stopPropagation(); handleRemoveHours(h.id) }} className="rounded-md bg-rose-500/10 border border-rose-500/25 px-2.5 py-1.5 text-xs text-rose-400 hover:bg-rose-500/15 transition-colors flex-shrink-0">Remove</button>
                  </div>
                </div>
              ))}
            </div>
            {/* Desktop: table layout */}
            <div className="hidden sm:block bg-slate-100 dark:bg-gw-elevated rounded-[10px] overflow-hidden">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-white/[0.02] border-b border-slate-200 dark:border-white/[0.06]">
                    <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Date</th>
                    <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Type</th>
                    <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Person</th>
                    <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Hours</th>
                    <th className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {hours.map(h => (
                    <tr key={h.id} className="border-b border-white/[0.03] hover:bg-white dark:bg-gw-surface cursor-pointer transition-colors duration-100" onClick={() => openEditHours(h)}>
                      <td className="px-3 py-2 text-slate-700 dark:text-slate-200">{h.log_date}</td>
                      <td className="px-3 py-2 text-slate-500 dark:text-slate-400 capitalize">{h.person_type}</td>
                      <td className="px-3 py-2 text-slate-500 dark:text-slate-400">{personName(h)}</td>
                      <td className="px-3 py-2 text-slate-500 dark:text-slate-400">{h.hours}</td>
                      <td className="px-3 py-2 text-right">
                        <button type="button" onClick={e => { e.stopPropagation(); handleRemoveHours(h.id) }} className="rounded-md bg-rose-500/10 border border-rose-500/25 px-2 py-1 text-rose-400 hover:bg-rose-500/15 transition-colors">Remove</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            </>
          )}
        </div>
      )}
    </section>

    {previewArgs && (
      <ReportPreviewModal
        args={previewArgs}
        onClose={() => { setPreviewArgs(null) }}
      />
    )}

    <ConfirmDialog
      open={confirmState !== null}
      title={confirmState?.title ?? ''}
      message={confirmState?.message ?? ''}
      confirmLabel={confirmState?.confirmLabel}
      confirmVariant={confirmState?.confirmVariant}
      onConfirm={confirmState?.onConfirm ?? (() => {})}
      onCancel={() => setConfirmState(null)}
    />
    </>
  )
}
