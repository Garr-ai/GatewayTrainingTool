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

import { useEffect, useRef, useState } from 'react'
import { api } from '../../lib/apiClient'
import type { ReportPdfArgs } from '../../lib/reportPdf'
import { ReportPreviewModal } from '../../components/ReportPreviewModal'
import type {
  ClassDailyReport,
  ClassDailyReportTimelineItem,
  ClassDailyReportTraineeProgress,
  ClassLoggedHours,
  ClassTrainer,
  ClassEnrollment,
  LoggedHoursPersonType,
  DailyRating,
} from '../../types'

interface ClassReportsSectionProps {
  classId: string              // UUID of the class
  className: string            // Display name used in empty states and PDF generation
  mode: 'reports' | 'hours'   // Which tab this component is currently rendering
}

export function ClassReportsSection({ classId, className, mode }: ClassReportsSectionProps) {
  // Shared data loaded for both tabs
  const [reports, setReports] = useState<ClassDailyReport[]>([])
  const [hours, setHours] = useState<ClassLoggedHours[]>([])
  const [trainers, setTrainers] = useState<ClassTrainer[]>([])
  // Only enrolled students are loaded (waitlist/dropped are excluded from daily progress)
  const [enrollments, setEnrollments] = useState<ClassEnrollment[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // ── Daily report form state ───────────────────────────────────────────────
  // Controls the inline report form panel (shown above the reports table)
  const [reportFormOpen, setReportFormOpen] = useState(false)
  // Null when adding a new report; set to the report being edited
  const [editingReport, setEditingReport] = useState<ClassDailyReport | null>(null)
  // All report header fields stored as strings (numeric fields converted on save)
  const [reportDate, setReportDate] = useState('')
  const [reportGroup, setReportGroup] = useState('')
  const [reportGame, setReportGame] = useState('')
  const [reportSessionLabel, setReportSessionLabel] = useState('')
  const [reportStartTime, setReportStartTime] = useState('')
  const [reportEndTime, setReportEndTime] = useState('')
  const [mgConfirmed, setMgConfirmed] = useState('')
  const [mgAttended, setMgAttended] = useState('')
  const [currentTrainees, setCurrentTrainees] = useState('')
  const [licensesReceived, setLicensesReceived] = useState('')
  // Override fields for hours totals — empty string means "use calculated value"
  const [overrideHoursToDate, setOverrideHoursToDate] = useState('')
  const [overridePaidHours, setOverridePaidHours] = useState('')
  const [overrideLiveHours, setOverrideLiveHours] = useState('')
  // IDs of trainers selected via checkboxes for the "trainers for the day" section
  const [selectedTrainerIds, setSelectedTrainerIds] = useState<string[]>([])
  // Timeline rows — the ordered list of training time blocks for the day
  const [timelineItems, setTimelineItems] = useState<ClassDailyReportTimelineItem[]>([])
  // Per-trainee progress rows — one per enrolled student
  const [progressRows, setProgressRows] = useState<ClassDailyReportTraineeProgress[]>([])
  const [reportSaving, setReportSaving] = useState(false)
  // Non-null when the coordinator clicks "View PDF" — triggers ReportPreviewModal
  const [previewArgs, setPreviewArgs] = useState<ReportPdfArgs | null>(null)
  // Tracks the source row index during a timeline drag operation
  const dragIndexRef = useRef<number | null>(null)

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

  async function loadReports() {
    const data = await api.reports.list(classId)
    setReports(data)
  }

  async function loadHours() {
    const data = await api.hours.list(classId)
    setHours(data)
  }

  async function loadTrainers() {
    const data = await api.trainers.list(classId)
    setTrainers(data)
  }

  /** Only loads students with status='enrolled' — waitlisted/dropped don't appear in reports. */
  async function loadEnrollments() {
    const data = await api.enrollments.list(classId, 'enrolled')
    setEnrollments(data)
  }

  // Load all four datasets in parallel on mount to avoid waterfall requests
  useEffect(() => {
    setLoading(true)
    setError(null)
    Promise.all([loadReports(), loadHours(), loadTrainers(), loadEnrollments()])
      .catch(err => setError((err as Error).message))
      .finally(() => setLoading(false))
  }, [classId])

  /** Resets all report form fields to their empty defaults. */
  function resetReportForm() {
    setReportDate('')
    setReportGroup('')
    setReportGame('')
    setReportSessionLabel('')
    setReportStartTime('')
    setReportEndTime('')
    setMgConfirmed('')
    setMgAttended('')
    setCurrentTrainees('')
    setLicensesReceived('')
    setOverrideHoursToDate('')
    setOverridePaidHours('')
    setOverrideLiveHours('')
    setSelectedTrainerIds([])
    setTimelineItems([])
    setProgressRows([])
  }

  /**
   * Fetches the full report details (trainer_ids, timeline, progress) for editing.
   * The list endpoint only returns the report header; nested data requires a
   * separate GET /reports/:id call.
   */
  async function loadReportDetails(reportId: string) {
    const full = await api.reports.get(reportId)
    setSelectedTrainerIds(full.trainer_ids)
    setTimelineItems(full.timeline)
    setProgressRows(full.progress)
  }

  /** Resets the form and opens it in "add new report" mode. */
  function openAddReport() {
    setEditingReport(null)
    resetReportForm()
    setReportFormOpen(true)
  }

  /**
   * Pre-fills the report form with an existing report's data and opens it in edit mode.
   * Fetches nested data (timeline, progress) via a separate API call because the
   * list endpoint does not include them.
   */
  async function openEditReport(r: ClassDailyReport) {
    setEditingReport(r)
    setReportDate(r.report_date)
    setReportGroup(r.group_label ?? '')
    setReportGame(r.game ?? '')
    setReportSessionLabel(r.session_label ?? '')
    setReportStartTime(r.class_start_time ?? '')
    setReportEndTime(r.class_end_time ?? '')
    // Convert nullable numbers to strings for controlled inputs
    setMgConfirmed(r.mg_confirmed?.toString() ?? '')
    setMgAttended(r.mg_attended?.toString() ?? '')
    setCurrentTrainees(r.current_trainees?.toString() ?? '')
    setLicensesReceived(r.licenses_received?.toString() ?? '')
    setOverrideHoursToDate(r.override_hours_to_date?.toString() ?? '')
    setOverridePaidHours(r.override_paid_hours_total?.toString() ?? '')
    setOverrideLiveHours(r.override_live_hours_total?.toString() ?? '')
    await loadReportDetails(r.id)
    setReportFormOpen(true)
  }

  /**
   * Handles both create and update for daily reports.
   * Numeric string fields are parsed with `parseIntOrNull` to convert empty
   * strings to null (API expects null, not empty string).
   * Timeline items are sent with their current array index as `position` to
   * preserve the drag-and-drop order.
   */
  async function handleSaveReport(e: React.FormEvent) {
    e.preventDefault()
    if (!reportDate) return
    setReportSaving(true)
    setError(null)

    /** Converts a form string value to a number or null. Returns null for empty/NaN. */
    const parseIntOrNull = (v: string) => {
      if (!v.trim()) return null
      const n = Number(v)
      return Number.isNaN(n) ? null : n
    }

    const body = {
      report_date: reportDate,
      group_label: reportGroup.trim() || null,
      game: reportGame.trim() || null,
      session_label: reportSessionLabel.trim() || null,
      class_start_time: reportStartTime.trim() || null,
      class_end_time: reportEndTime.trim() || null,
      mg_confirmed: parseIntOrNull(mgConfirmed),
      mg_attended: parseIntOrNull(mgAttended),
      current_trainees: parseIntOrNull(currentTrainees),
      licenses_received: parseIntOrNull(licensesReceived),
      override_hours_to_date: parseIntOrNull(overrideHoursToDate),
      override_paid_hours_total: parseIntOrNull(overridePaidHours),
      override_live_hours_total: parseIntOrNull(overrideLiveHours),
      trainer_ids: selectedTrainerIds,
      timeline: timelineItems.map(item => ({
        start_time: item.start_time,
        end_time: item.end_time,
        activity: item.activity,
        homework_handouts_tests: item.homework_handouts_tests,
        category: item.category,
      })),
      progress: progressRows.map(row => ({
        enrollment_id: row.enrollment_id,
        progress_text: row.progress_text,
        gk_rating: row.gk_rating,
        dex_rating: row.dex_rating,
        hom_rating: row.hom_rating,
        coming_back_next_day: row.coming_back_next_day ?? false,
        homework_completed: row.homework_completed ?? false,
      })),
    }

    try {
      if (editingReport) {
        await api.reports.update(classId, editingReport.id, body)
      } else {
        await api.reports.create(classId, body)
      }
      setReportFormOpen(false)
      loadReports()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setReportSaving(false)
    }
  }

  /** Deletes a daily report after confirmation. This also deletes all nested data. */
  async function handleRemoveReport(id: string) {
    if (!window.confirm('Remove this report? This cannot be undone.')) return
    try {
      await api.reports.delete(classId, id)
      loadReports()
    } catch (err) {
      setError((err as Error).message)
    }
  }

  /**
   * Fetches the full report (with nested data) and sets `previewArgs` to open
   * the ReportPreviewModal. The modal uses the trainers/enrollments already
   * in state to resolve IDs to display names.
   */
  async function handleViewPdf(r: ClassDailyReport) {
    try {
      const full = await api.reports.get(r.id)
      setPreviewArgs({ report: full, className, trainers, enrollments })
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
      } else {
        await api.hours.create(classId, payload)
      }
      setHoursFormOpen(false)
      loadHours()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setHoursSaving(false)
    }
  }

  /** Deletes a logged hours entry after navigation (no confirmation — low risk). */
  async function handleRemoveHours(id: string) {
    try {
      await api.hours.delete(classId, id)
      loadHours()
    } catch (err) {
      setError((err as Error).message)
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

  /**
   * Computes cumulative hour totals for a given report date.
   * Only includes hours logged on or before `date` (ISO date string comparison).
   * This mimics the running total that would appear in the original spreadsheet.
   * Returns zero totals if no date is selected yet.
   */
  function computedTotalsForDate(date: string) {
    if (!date) return { hoursToDate: 0, paid: 0, live: 0 }
    // String comparison works for ISO date strings (YYYY-MM-DD)
    const relevant = hours.filter(h => h.log_date <= date)
    const hoursToDate = relevant.reduce((sum, h) => sum + h.hours, 0)
    const paid = relevant.filter(h => h.paid).reduce((sum, h) => sum + h.hours, 0)
    const live = relevant.filter(h => h.live_training).reduce((sum, h) => sum + h.hours, 0)
    return { hoursToDate, paid, live }
  }

  if (loading) {
    return <p className="text-xs text-slate-500">Loading…</p>
  }

  return (
    <>
    <section className="space-y-4">
      {error && (
        <p className="rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-700" role="alert">
          {error}
        </p>
      )}

      {mode === 'reports' && (
        <div className="rounded-xl bg-white p-4 shadow-sm">
          <header className="flex items-center justify-between mb-3">
            <div>
              <h3 className="text-sm font-semibold text-slate-900">Daily reports</h3>
              <p className="mt-0.5 text-xs text-slate-500">
                Detailed daily reports by group, including schedule, homework/tests, and trainee
                progress.
              </p>
            </div>
            <button
              type="button"
              onClick={openAddReport}
              className="rounded-md bg-gw-blue px-3 py-1.5 text-xs font-medium text-white hover:bg-gw-blue-hover"
            >
              + Add daily report
            </button>
          </header>

          {reportFormOpen && (
            <div className="mb-4 rounded-lg border border-slate-200 bg-slate-50 p-3 space-y-4 text-xs">
              <form onSubmit={handleSaveReport} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <label className="block font-medium text-slate-700">
                    Date
                    <input
                      type="date"
                      value={reportDate}
                      onChange={e => setReportDate(e.target.value)}
                      className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5"
                      required
                    />
                  </label>
                  <label className="block font-medium text-slate-700">
                    Group
                    <input
                      type="text"
                      value={reportGroup}
                      onChange={e => setReportGroup(e.target.value)}
                      className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5"
                      placeholder="e.g. A"
                    />
                  </label>
                  <label className="block font-medium text-slate-700">
                    Game
                    <input
                      type="text"
                      value={reportGame}
                      onChange={e => setReportGame(e.target.value)}
                      className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5"
                      placeholder="e.g. Blackjack"
                    />
                  </label>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <label className="block font-medium text-slate-700">
                    Session
                    <input
                      type="text"
                      value={reportSessionLabel}
                      onChange={e => setReportSessionLabel(e.target.value)}
                      className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5"
                      placeholder="e.g. Day 4 PM"
                    />
                  </label>
                  <label className="block font-medium text-slate-700">
                    Class start time
                    <input
                      type="time"
                      value={reportStartTime}
                      onChange={e => setReportStartTime(e.target.value)}
                      className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5"
                    />
                  </label>
                  <label className="block font-medium text-slate-700">
                    Class end time
                    <input
                      type="time"
                      value={reportEndTime}
                      onChange={e => setReportEndTime(e.target.value)}
                      className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5"
                    />
                  </label>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <label className="block font-medium text-slate-700">
                    M&amp;G confirmed
                    <input
                      type="number"
                      min="0"
                      value={mgConfirmed}
                      onChange={e => setMgConfirmed(e.target.value)}
                      className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5"
                    />
                  </label>
                  <label className="block font-medium text-slate-700">
                    M&amp;G attended
                    <input
                      type="number"
                      min="0"
                      value={mgAttended}
                      onChange={e => setMgAttended(e.target.value)}
                      className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5"
                    />
                  </label>
                  <label className="block font-medium text-slate-700">
                    Current trainees
                    <input
                      type="number"
                      min="0"
                      value={currentTrainees}
                      onChange={e => setCurrentTrainees(e.target.value)}
                      className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5"
                    />
                  </label>
                  <label className="block font-medium text-slate-700">
                    Licenses received
                    <input
                      type="number"
                      min="0"
                      value={licensesReceived}
                      onChange={e => setLicensesReceived(e.target.value)}
                      className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5"
                    />
                  </label>
                </div>

                {/* Trainers for the day */}
                <div>
                  <p className="mb-1 text-[11px] font-semibold text-slate-700">
                    Trainers for the day
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {trainers.length === 0 ? (
                      <span className="text-[11px] text-slate-500">
                        No trainers assigned yet. Use the Trainers tab first.
                      </span>
                    ) : (
                      trainers.map(t => {
                        const checked = selectedTrainerIds.includes(t.id)
                        return (
                          <label
                            key={t.id}
                            className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-1 text-[11px] ${
                              checked
                                ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                                : 'border-slate-300 bg-white text-slate-700'
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={e => {
                                setSelectedTrainerIds(prev =>
                                  e.target.checked
                                    ? [...prev, t.id]
                                    : prev.filter(id => id !== t.id),
                                )
                              }}
                            />
                            {t.trainer_name}
                          </label>
                        )
                      })
                    )}
                  </div>
                </div>

                {/* Hours totals */}
                <div className="rounded-lg border border-slate-200 bg-white p-3">
                  <p className="text-[11px] font-semibold text-slate-700">Hours totals</p>
                  <p className="mt-0.5 text-[11px] text-slate-500">
                    Calculated from logged hours up to this report date; override fields take
                    precedence.
                  </p>
                  <div className="mt-2 grid grid-cols-1 md:grid-cols-3 gap-3">
                    {(() => {
                      const totals = computedTotalsForDate(reportDate)
                      const hoursToDateDisplay =
                        overrideHoursToDate.trim() !== ''
                          ? Number(overrideHoursToDate)
                          : totals.hoursToDate
                      const paidDisplay =
                        overridePaidHours.trim() !== '' ? Number(overridePaidHours) : totals.paid
                      const liveDisplay =
                        overrideLiveHours.trim() !== '' ? Number(overrideLiveHours) : totals.live
                      return (
                        <>
                          <div className="rounded-md border border-slate-200 p-2">
                            <div className="text-[10px] text-slate-500">
                              Training hours to date
                            </div>
                            <div className="text-sm font-semibold text-slate-900">
                              {Number.isNaN(hoursToDateDisplay)
                                ? '—'
                                : hoursToDateDisplay.toFixed(2)}
                            </div>
                            <div className="mt-1 text-[10px] text-slate-500">
                              Calculated: {totals.hoursToDate.toFixed(2)}
                            </div>
                            <label className="mt-2 block text-[10px] text-slate-600">
                              Override
                              <input
                                type="number"
                                step="0.25"
                                min="0"
                                value={overrideHoursToDate}
                                onChange={e => setOverrideHoursToDate(e.target.value)}
                                className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1"
                              />
                            </label>
                          </div>
                          <div className="rounded-md border border-slate-200 p-2">
                            <div className="text-[10px] text-slate-500">Total paid hours</div>
                            <div className="text-sm font-semibold text-slate-900">
                              {Number.isNaN(paidDisplay) ? '—' : paidDisplay.toFixed(2)}
                            </div>
                            <div className="mt-1 text-[10px] text-slate-500">
                              Calculated: {totals.paid.toFixed(2)}
                            </div>
                            <label className="mt-2 block text-[10px] text-slate-600">
                              Override
                              <input
                                type="number"
                                step="0.25"
                                min="0"
                                value={overridePaidHours}
                                onChange={e => setOverridePaidHours(e.target.value)}
                                className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1"
                              />
                            </label>
                          </div>
                          <div className="rounded-md border border-slate-200 p-2">
                            <div className="text-[10px] text-slate-500">
                              Total live training hours
                            </div>
                            <div className="text-sm font-semibold text-slate-900">
                              {Number.isNaN(liveDisplay) ? '—' : liveDisplay.toFixed(2)}
                            </div>
                            <div className="mt-1 text-[10px] text-slate-500">
                              Calculated: {totals.live.toFixed(2)}
                            </div>
                            <label className="mt-2 block text-[10px] text-slate-600">
                              Override
                              <input
                                type="number"
                                step="0.25"
                                min="0"
                                value={overrideLiveHours}
                                onChange={e => setOverrideLiveHours(e.target.value)}
                                className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1"
                              />
                            </label>
                          </div>
                        </>
                      )
                    })()}
                  </div>
                </div>

                {/* Timeline items */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-[11px] font-semibold text-slate-700">
                      Daily training timeline / trainee progress
                    </p>
                    <button
                      type="button"
                      onClick={() =>
                        setTimelineItems(prev => [
                          ...prev,
                          {
                            id: crypto.randomUUID(),
                            report_id: editingReport?.id ?? 'new',
                            start_time: '',
                            end_time: '',
                            activity: '',
                            homework_handouts_tests: '',
                            category: '',
                            position: prev.length,
                            created_at: new Date().toISOString(),
                          },
                        ])
                      }
                      className="rounded-md border border-slate-300 px-2 py-1 text-[11px] text-slate-700 hover:bg-slate-100"
                    >
                      + Add time block
                    </button>
                  </div>

                  {timelineItems.length === 0 ? (
                    <p className="text-[11px] text-slate-500">
                      No timeline rows yet. Add blocks like in the spreadsheet.
                    </p>
                  ) : (
                    <div className="overflow-auto rounded-lg border border-slate-200">
                      <table className="min-w-full text-[11px]">
                        <thead className="bg-slate-50 border-b border-slate-200">
                          <tr>
                            <th className="px-2 py-1 w-6" />
                            <th className="px-2 py-1 text-left font-medium text-slate-900">
                              Start–end
                            </th>
                            <th className="px-2 py-1 text-left font-medium text-slate-900">
                              Activity
                            </th>
                            <th className="px-2 py-1 text-left font-medium text-slate-900">
                              Homework / handouts / tests
                            </th>
                            <th className="px-2 py-1 text-left font-medium text-slate-900">
                              Category
                            </th>
                            <th className="px-2 py-1" />
                          </tr>
                        </thead>
                        <tbody>
                          {timelineItems.map((item, index) => (
                            <tr
                              key={item.id}
                              draggable
                              onDragStart={() => { dragIndexRef.current = index }}
                              onDragOver={e => e.preventDefault()}
                              onDrop={() => {
                                const from = dragIndexRef.current
                                if (from === null || from === index) return
                                setTimelineItems(prev => {
                                  const next = [...prev]
                                  const [moved] = next.splice(from, 1)
                                  next.splice(index, 0, moved)
                                  return next
                                })
                                dragIndexRef.current = null
                              }}
                              className="border-b border-slate-100 hover:bg-slate-50"
                            >
                              <td className="px-2 py-1 cursor-grab active:cursor-grabbing text-slate-400 select-none">
                                ⠿
                              </td>
                              <td className="px-2 py-1">
                                <div className="flex gap-1">
                                  <input
                                    type="time"
                                    value={item.start_time ?? ''}
                                    onChange={e =>
                                      setTimelineItems(prev =>
                                        prev.map((row, i) =>
                                          i === index
                                            ? { ...row, start_time: e.target.value }
                                            : row,
                                        ),
                                      )
                                    }
                                    className="w-20 rounded-md border border-slate-300 px-1 py-0.5"
                                  />
                                  <span className="self-center text-slate-500">–</span>
                                  <input
                                    type="time"
                                    value={item.end_time ?? ''}
                                    onChange={e =>
                                      setTimelineItems(prev =>
                                        prev.map((row, i) =>
                                          i === index ? { ...row, end_time: e.target.value } : row,
                                        ),
                                      )
                                    }
                                    className="w-20 rounded-md border border-slate-300 px-1 py-0.5"
                                  />
                                </div>
                              </td>
                              <td className="px-2 py-1">
                                <input
                                  type="text"
                                  value={item.activity ?? ''}
                                  onChange={e =>
                                    setTimelineItems(prev =>
                                      prev.map((row, i) =>
                                        i === index ? { ...row, activity: e.target.value } : row,
                                      ),
                                    )
                                  }
                                  className="w-full rounded-md border border-slate-300 px-1 py-0.5"
                                />
                              </td>
                              <td className="px-2 py-1">
                                <input
                                  type="text"
                                  value={item.homework_handouts_tests ?? ''}
                                  onChange={e =>
                                    setTimelineItems(prev =>
                                      prev.map((row, i) =>
                                        i === index
                                          ? { ...row, homework_handouts_tests: e.target.value }
                                          : row,
                                      ),
                                    )
                                  }
                                  className="w-full rounded-md border border-slate-300 px-1 py-0.5"
                                />
                              </td>
                              <td className="px-2 py-1">
                                <input
                                  type="text"
                                  value={item.category ?? ''}
                                  onChange={e =>
                                    setTimelineItems(prev =>
                                      prev.map((row, i) =>
                                        i === index ? { ...row, category: e.target.value } : row,
                                      ),
                                    )
                                  }
                                  className="w-full rounded-md border border-slate-300 px-1 py-0.5"
                                  placeholder="Lecture / Dexterity / Game simulation…"
                                />
                              </td>
                              <td className="px-2 py-1 text-right">
                                <button
                                  type="button"
                                  onClick={() =>
                                    setTimelineItems(prev => prev.filter((_, i) => i !== index))
                                  }
                                  className="rounded-md border border-slate-300 px-2 py-0.5 text-[10px] text-slate-700 hover:bg-slate-100"
                                >
                                  Remove
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                {/* Per-trainee progress */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-[11px] font-semibold text-slate-700">Per-trainee progress</p>
                    <button
                      type="button"
                      onClick={() => {
                        setProgressRows(
                          enrollments.map(enr => ({
                            id: crypto.randomUUID(),
                            report_id: editingReport?.id ?? 'new',
                            enrollment_id: enr.id,
                            progress_text:
                              progressRows.find(p => p.enrollment_id === enr.id)?.progress_text ??
                              '',
                            gk_rating:
                              progressRows.find(p => p.enrollment_id === enr.id)?.gk_rating ?? null,
                            dex_rating:
                              progressRows.find(p => p.enrollment_id === enr.id)?.dex_rating ??
                              null,
                            hom_rating:
                              progressRows.find(p => p.enrollment_id === enr.id)?.hom_rating ??
                              null,
                            coming_back_next_day:
                              progressRows.find(p => p.enrollment_id === enr.id)
                                ?.coming_back_next_day ?? true,
                            homework_completed:
                              progressRows.find(p => p.enrollment_id === enr.id)
                                ?.homework_completed ?? false,
                            created_at: new Date().toISOString(),
                          })),
                        )
                      }}
                      className="rounded-md border border-slate-300 px-2 py-1 text-[11px] text-slate-700 hover:bg-slate-100"
                    >
                      Load current trainees
                    </button>
                  </div>

                  {progressRows.length === 0 ? (
                    <p className="text-[11px] text-slate-500">
                      No progress rows yet. Click &quot;Load current trainees&quot; to start.
                    </p>
                  ) : (
                    <div className="overflow-auto rounded-lg border border-slate-200">
                      <table className="min-w-full text-[11px]">
                        <thead className="bg-slate-50 border-b border-slate-200">
                          <tr>
                            <th className="px-2 py-1 text-left font-medium text-slate-900">
                              Trainee
                            </th>
                            <th className="px-2 py-1 text-left font-medium text-slate-900">
                              Progress notes
                            </th>
                            <th className="px-2 py-1 text-left font-medium text-slate-900">
                              Ratings (GK / Dex / HoM)
                            </th>
                            <th className="px-2 py-1 text-left font-medium text-slate-900">
                              Coming back?
                            </th>
                            <th className="px-2 py-1 text-left font-medium text-slate-900">
                              HW done?
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {progressRows.map((row, index) => {
                            const enrollment = enrollments.find(e => e.id === row.enrollment_id)
                            const updateRow = (
                              patch: Partial<ClassDailyReportTraineeProgress>,
                            ) => {
                              setProgressRows(prev =>
                                prev.map((r, i) => (i === index ? { ...r, ...patch } : r)),
                              )
                            }
                            const ratingOptions: DailyRating[] = ['EE', 'ME', 'AD', 'NI']
                            return (
                              <tr key={row.id} className="border-b border-slate-100">
                                <td className="px-2 py-1 align-top text-slate-900">
                                  <div>{enrollment?.student_name ?? 'Unknown'}</div>
                                  <div className="text-[10px] text-slate-500">
                                    {enrollment?.student_email}
                                  </div>
                                </td>
                                <td className="px-2 py-1 align-top">
                                  <textarea
                                    value={row.progress_text ?? ''}
                                    onChange={e => updateRow({ progress_text: e.target.value })}
                                    rows={3}
                                    className="w-full rounded-md border border-slate-300 px-1 py-0.5"
                                  />
                                </td>
                                <td className="px-2 py-1 align-top">
                                  <div className="flex flex-col gap-1">
                                    {(['gk_rating', 'dex_rating', 'hom_rating'] as const).map(
                                      field => (
                                        <label key={field} className="flex items-center gap-1">
                                          <span className="w-8 text-slate-600">
                                            {field === 'gk_rating'
                                              ? 'GK'
                                              : field === 'dex_rating'
                                                ? 'Dex'
                                                : 'HoM'}
                                          </span>
                                          <select
                                            value={row[field] ?? ''}
                                            onChange={e =>
                                              updateRow({
                                                [field]: (e.target.value ||
                                                  null) as DailyRating | null,
                                              })
                                            }
                                            className="flex-1 rounded-md border border-slate-300 px-1 py-0.5"
                                          >
                                            <option value="">—</option>
                                            {ratingOptions.map(r => (
                                              <option key={r} value={r}>
                                                {r}
                                              </option>
                                            ))}
                                          </select>
                                        </label>
                                      ),
                                    )}
                                  </div>
                                </td>
                                <td className="px-2 py-1 align-top">
                                  <label className="inline-flex items-center gap-1.5">
                                    <input
                                      type="checkbox"
                                      checked={row.coming_back_next_day ?? true}
                                      onChange={e =>
                                        updateRow({ coming_back_next_day: e.target.checked })
                                      }
                                    />
                                    <span>Yes</span>
                                  </label>
                                </td>
                                <td className="px-2 py-1 align-top">
                                  <label className="inline-flex items-center gap-1.5">
                                    <input
                                      type="checkbox"
                                      checked={row.homework_completed ?? false}
                                      onChange={e =>
                                        updateRow({ homework_completed: e.target.checked })
                                      }
                                    />
                                    <span>Yes</span>
                                  </label>
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setReportFormOpen(false)}
                    className="rounded-md border border-slate-300 px-3 py-1.5 text-slate-700 hover:bg-slate-100"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={reportSaving}
                    className="rounded-md bg-gw-blue px-3 py-1.5 text-white hover:bg-gw-blue-hover disabled:opacity-60"
                  >
                    {reportSaving ? 'Saving…' : editingReport ? 'Save changes' : 'Add report'}
                  </button>
                </div>
              </form>
            </div>
          )}

          {reports.length === 0 ? (
            <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-center text-xs text-slate-500">
              No daily reports yet for{' '}
              <span className="font-medium text-slate-700">{className}</span>.
            </div>
          ) : (
            <div className="rounded-lg border border-slate-200 overflow-hidden">
              <table className="w-full text-xs">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium text-slate-900">Date</th>
                    <th className="px-3 py-2 text-left font-medium text-slate-900">Group</th>
                    <th className="px-3 py-2 text-left font-medium text-slate-900">Session</th>
                    <th className="px-3 py-2 text-left font-medium text-slate-900">Game</th>
                    <th className="px-3 py-2 text-right font-medium text-slate-900">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {reports.map(r => (
                    <tr key={r.id} className="border-b border-slate-100 hover:bg-slate-50">
                      <td className="px-3 py-2 text-slate-900">{r.report_date}</td>
                      <td className="px-3 py-2 text-slate-600">{r.group_label ?? '—'}</td>
                      <td className="px-3 py-2 text-slate-600">{r.session_label ?? '—'}</td>
                      <td className="px-3 py-2 text-slate-600">{r.game ?? '—'}</td>
                      <td className="px-3 py-2 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => openEditReport(r)}
                            className="rounded-md border border-slate-300 px-2 py-1 text-slate-700 hover:bg-slate-50"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => handleViewPdf(r)}
                            className="rounded-md border border-gw-blue px-2 py-1 text-gw-blue hover:bg-blue-50"
                          >
                            View PDF
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRemoveReport(r.id)}
                            className="rounded-md border border-rose-200 px-2 py-1 text-rose-600 hover:bg-rose-50"
                          >
                            Remove
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {mode === 'hours' && (
        <div className="rounded-xl bg-white p-4 shadow-sm">
          <header className="flex items-center justify-between mb-3">
            <div>
              <h3 className="text-sm font-semibold text-slate-900">Logged hours</h3>
              <p className="mt-0.5 text-xs text-slate-500">
                Track hours for trainers and students for payroll. Total: {totalHours.toFixed(1)}{' '}
                hrs
              </p>
            </div>
            <button
              type="button"
              onClick={openAddHours}
              className="rounded-md bg-gw-blue px-3 py-1.5 text-xs font-medium text-white hover:bg-gw-blue-hover"
            >
              + Log hours
            </button>
          </header>

          {hoursFormOpen && (
            <div className="mb-4 rounded-lg border border-slate-200 bg-slate-50 p-3">
              <form onSubmit={handleSaveHours} className="space-y-3 text-xs">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <label className="block font-medium text-slate-700">
                    Date
                    <input
                      type="date"
                      value={hoursDate}
                      onChange={e => setHoursDate(e.target.value)}
                      className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5"
                      required
                    />
                  </label>
                  <label className="block font-medium text-slate-700">
                    Hours
                    <input
                      type="number"
                      step="0.25"
                      min="0.25"
                      value={hoursValue}
                      onChange={e => setHoursValue(e.target.value)}
                      className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5"
                      placeholder="e.g. 4.5"
                      required
                    />
                  </label>
                </div>
                <div>
                  <label className="block font-medium text-slate-700">Person type</label>
                  <div className="mt-1 flex gap-4">
                    <label className="flex items-center gap-1.5">
                      <input
                        type="radio"
                        name="personType"
                        checked={hoursPersonType === 'trainer'}
                        onChange={() => {
                          setHoursPersonType('trainer')
                          setHoursEnrollmentId('')
                        }}
                      />
                      Trainer
                    </label>
                    <label className="flex items-center gap-1.5">
                      <input
                        type="radio"
                        name="personType"
                        checked={hoursPersonType === 'student'}
                        onChange={() => {
                          setHoursPersonType('student')
                          setHoursTrainerId('')
                        }}
                      />
                      Student
                    </label>
                  </div>
                </div>
                {hoursPersonType === 'trainer' && (
                  <div>
                    <label className="block font-medium text-slate-700">Trainer</label>
                    <select
                      value={hoursTrainerId}
                      onChange={e => setHoursTrainerId(e.target.value)}
                      className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5"
                      required
                    >
                      <option value="">— Select —</option>
                      {trainers.map(t => (
                        <option key={t.id} value={t.id}>
                          {t.trainer_name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
                {hoursPersonType === 'student' && (
                  <div>
                    <label className="block font-medium text-slate-700">Student</label>
                    <select
                      value={hoursEnrollmentId}
                      onChange={e => setHoursEnrollmentId(e.target.value)}
                      className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5"
                      required
                    >
                      <option value="">— Select —</option>
                      {enrollments.map(enr => (
                        <option key={enr.id} value={enr.id}>
                          {enr.student_name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
                <div>
                  <label className="block font-medium text-slate-700">
                    Notes
                    <input
                      type="text"
                      value={hoursNotes}
                      onChange={e => setHoursNotes(e.target.value)}
                      className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5"
                      placeholder="Optional"
                    />
                  </label>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setHoursFormOpen(false)}
                    className="rounded-md border border-slate-300 px-3 py-1.5 text-slate-700 hover:bg-slate-100"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={hoursSaving}
                    className="rounded-md bg-gw-blue px-3 py-1.5 text-white hover:bg-gw-blue-hover disabled:opacity-60"
                  >
                    {hoursSaving ? 'Saving…' : editingHours ? 'Save changes' : 'Log hours'}
                  </button>
                </div>
              </form>
            </div>
          )}

          {hours.length === 0 ? (
            <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-center text-xs text-slate-500">
              No logged hours yet for{' '}
              <span className="font-medium text-slate-700">{className}</span>.
            </div>
          ) : (
            <div className="rounded-lg border border-slate-200 overflow-hidden">
              <table className="w-full text-xs">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium text-slate-900">Date</th>
                    <th className="px-3 py-2 text-left font-medium text-slate-900">Type</th>
                    <th className="px-3 py-2 text-left font-medium text-slate-900">Person</th>
                    <th className="px-3 py-2 text-left font-medium text-slate-900">Hours</th>
                    <th className="px-3 py-2 text-right font-medium text-slate-900">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {hours.map(h => (
                    <tr
                      key={h.id}
                      className="border-b border-slate-100 hover:bg-slate-50 cursor-pointer"
                      onClick={() => openEditHours(h)}
                    >
                      <td className="px-3 py-2 text-slate-900">{h.log_date}</td>
                      <td className="px-3 py-2 text-slate-600 capitalize">{h.person_type}</td>
                      <td className="px-3 py-2 text-slate-600">{personName(h)}</td>
                      <td className="px-3 py-2 text-slate-600">{h.hours}</td>
                      <td className="px-3 py-2 text-right">
                        <button
                          type="button"
                          onClick={e => {
                            e.stopPropagation()
                            handleRemoveHours(h.id)
                          }}
                          className="rounded-md border border-slate-300 px-2 py-1 text-slate-700 hover:bg-slate-50"
                        >
                          Remove
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </section>

    {previewArgs && (
      <ReportPreviewModal args={previewArgs} onClose={() => setPreviewArgs(null)} />
    )}
    </>
  )
}
