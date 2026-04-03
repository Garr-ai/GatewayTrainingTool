import { useState, useCallback, useRef } from 'react'
import { api } from '../../lib/apiClient'
import { useTrainerClassDetail } from '../../contexts/TrainerClassDetailContext'
import { SkeletonTable } from '../../components/Skeleton'
import { EmptyState } from '../../components/EmptyState'
import { ReportPreviewModal } from '../../components/ReportPreviewModal'
import { useToast } from '../../contexts/ToastContext'
import type { ClassDailyReport, ClassDrill, ClassEnrollment, ClassTrainer, DailyRating } from '../../types'
import type { ReportWithNested } from '../../lib/apiClient'
import type { ReportPdfArgs } from '../../lib/reportPdf'

type ReportBody = {
  report_date: string
  group_label?: string | null
  game?: string | null
  session_label?: string | null
  class_start_time?: string | null
  class_end_time?: string | null
  mg_confirmed?: number | null
  mg_attended?: number | null
  current_trainees?: number | null
  licenses_received?: number | null
  override_hours_to_date?: number | null
  override_paid_hours_total?: number | null
  override_live_hours_total?: number | null
  trainer_ids: string[]
  timeline: Array<{
    start_time: string | null
    end_time: string | null
    activity: string | null
    homework_handouts_tests: string | null
    category: string | null
  }>
  progress: Array<{
    enrollment_id: string
    progress_text: string | null
    gk_rating: DailyRating | null
    dex_rating: DailyRating | null
    hom_rating: DailyRating | null
    coming_back_next_day: boolean
    homework_completed: boolean
    attendance: boolean
  }>
  drill_times: Array<{
    enrollment_id: string
    drill_id: string
    time_seconds: number | null
    score: number | null
  }>
}

const RATINGS: DailyRating[] = ['EE', 'ME', 'AD', 'NI']
const fieldClass = 'w-full bg-gw-elevated border border-white/10 rounded-md px-2 py-1.5 text-xs text-slate-200 placeholder:text-slate-500 outline-none focus:border-gw-blue/40 focus:ring-2 focus:ring-gw-blue/15'

function emptyProgress(enrollments: ClassEnrollment[]) {
  return enrollments.filter(e => e.status === 'enrolled').map(e => ({
    enrollment_id: e.id,
    progress_text: null as string | null,
    gk_rating: null as DailyRating | null,
    dex_rating: null as DailyRating | null,
    hom_rating: null as DailyRating | null,
    coming_back_next_day: false,
    homework_completed: false,
    attendance: true,
  }))
}

function emptyDrillTimes(enrollments: ClassEnrollment[], drills: ClassDrill[]) {
  const active = drills.filter(d => d.active)
  return enrollments.filter(e => e.status === 'enrolled').flatMap(e =>
    active.map(d => ({
      enrollment_id: e.id,
      drill_id: d.id,
      time_seconds: null as number | null,
      score: null as number | null,
    }))
  )
}

export function TrainerReportsSection() {
  const { classId, classInfo, reports, enrollments, drills, loading, refreshReports, setReports } = useTrainerClassDetail()
  const { toast } = useToast()
  const [mode, setMode] = useState<'list' | 'create' | 'edit'>('list')
  const [editingReport, setEditingReport] = useState<ReportWithNested | null>(null)
  const [loadingReport, setLoadingReport] = useState(false)
  const [saving, setSaving] = useState(false)

  // PDF preview state
  const [previewArgs, setPreviewArgs] = useState<ReportPdfArgs | null>(null)
  const reportCacheRef = useRef<Record<string, ReportWithNested>>({})

  // Form state
  const [fDate, setFDate] = useState('')
  const [fGroupLabel, setFGroupLabel] = useState('')
  const [fGame, setFGame] = useState('')
  const [fSessionLabel, setFSessionLabel] = useState('')
  const [fStartTime, setFStartTime] = useState('')
  const [fEndTime, setFEndTime] = useState('')
  const [fMgConfirmed, setFMgConfirmed] = useState('')
  const [fMgAttended, setFMgAttended] = useState('')
  const [fCurrentTrainees, setFCurrentTrainees] = useState('')
  const [fLicenses, setFLicenses] = useState('')
  const [fProgress, setFProgress] = useState<ReturnType<typeof emptyProgress>>([])
  const [fDrillTimes, setFDrillTimes] = useState<ReturnType<typeof emptyDrillTimes>>([])

  const archived = classInfo?.archived ?? false
  const activeEnr = enrollments.filter(e => e.status === 'enrolled')
  const activeDrills = drills.filter(d => d.active)
  const className = classInfo?.name ?? ''

  // Build a fake trainers array for ReportPreviewModal — it expects ClassTrainer[]
  const trainersList: ClassTrainer[] = classInfo?.trainer_id
    ? [{ id: classInfo.trainer_id, class_id: classId, trainer_name: 'Trainer', trainer_email: '', role: 'primary' as const, created_at: '' }]
    : []

  function openCreate() {
    setMode('create')
    setEditingReport(null)
    setFDate(new Date().toISOString().slice(0, 10))
    setFGroupLabel('')
    setFGame(classInfo?.game_type ?? '')
    setFSessionLabel('')
    setFStartTime('')
    setFEndTime('')
    setFMgConfirmed('')
    setFMgAttended('')
    setFCurrentTrainees(String(activeEnr.length))
    setFLicenses('')
    setFProgress(emptyProgress(enrollments))
    setFDrillTimes(emptyDrillTimes(enrollments, drills))
  }

  const openEdit = useCallback(async (report: ClassDailyReport) => {
    setLoadingReport(true)
    try {
      const full = await api.selfService.classReportDetail(classId, report.id)
      reportCacheRef.current[report.id] = full
      setEditingReport(full)
      setMode('edit')
      setFDate(full.report_date)
      setFGroupLabel(full.group_label ?? '')
      setFGame(full.game ?? '')
      setFSessionLabel(full.session_label ?? '')
      setFStartTime(full.class_start_time ?? '')
      setFEndTime(full.class_end_time ?? '')
      setFMgConfirmed(full.mg_confirmed != null ? String(full.mg_confirmed) : '')
      setFMgAttended(full.mg_attended != null ? String(full.mg_attended) : '')
      setFCurrentTrainees(full.current_trainees != null ? String(full.current_trainees) : '')
      setFLicenses(full.licenses_received != null ? String(full.licenses_received) : '')

      const progressMap = new Map(full.progress.map(p => [p.enrollment_id, p]))
      setFProgress(activeEnr.map(e => {
        const existing = progressMap.get(e.id)
        return {
          enrollment_id: e.id,
          progress_text: existing?.progress_text ?? null,
          gk_rating: existing?.gk_rating ?? null,
          dex_rating: existing?.dex_rating ?? null,
          hom_rating: existing?.hom_rating ?? null,
          coming_back_next_day: existing?.coming_back_next_day ?? false,
          homework_completed: existing?.homework_completed ?? false,
          attendance: existing?.attendance ?? true,
        }
      }))

      const dtMap = new Map(full.drill_times.map(dt => [`${dt.enrollment_id}:${dt.drill_id}`, dt]))
      setFDrillTimes(activeEnr.flatMap(e =>
        activeDrills.map(d => {
          const existing = dtMap.get(`${e.id}:${d.id}`)
          return {
            enrollment_id: e.id,
            drill_id: d.id,
            time_seconds: existing?.time_seconds ?? null,
            score: existing?.score ?? null,
          }
        })
      ))
    } catch (err) {
      toast((err as Error).message, 'error')
    } finally {
      setLoadingReport(false)
    }
  }, [classId, activeEnr, activeDrills, toast])

  function buildBody(): ReportBody {
    return {
      report_date: fDate,
      group_label: fGroupLabel || null,
      game: fGame || null,
      session_label: fSessionLabel || null,
      class_start_time: fStartTime || null,
      class_end_time: fEndTime || null,
      mg_confirmed: fMgConfirmed ? Number(fMgConfirmed) : null,
      mg_attended: fMgAttended ? Number(fMgAttended) : null,
      current_trainees: fCurrentTrainees ? Number(fCurrentTrainees) : null,
      licenses_received: fLicenses ? Number(fLicenses) : null,
      override_hours_to_date: null,
      override_paid_hours_total: null,
      override_live_hours_total: null,
      trainer_ids: classInfo?.trainer_id ? [classInfo.trainer_id] : [],
      timeline: [],
      progress: fProgress,
      drill_times: fDrillTimes.filter(dt => dt.time_seconds !== null || dt.score !== null),
    }
  }

  async function handleSave() {
    setSaving(true)
    try {
      const body = buildBody()
      if (mode === 'create') {
        // Optimistic: add to list immediately
        const tempReport: ClassDailyReport = {
          id: `temp-${Date.now()}`,
          class_id: classId,
          report_date: fDate,
          group_label: fGroupLabel || null,
          game: fGame || null,
          session_label: fSessionLabel || null,
          class_start_time: fStartTime || null,
          class_end_time: fEndTime || null,
          mg_confirmed: body.mg_confirmed ?? null,
          mg_attended: body.mg_attended ?? null,
          current_trainees: body.current_trainees ?? null,
          licenses_received: body.licenses_received ?? null,
          override_hours_to_date: null,
          override_paid_hours_total: null,
          override_live_hours_total: null,
          created_at: new Date().toISOString(),
        }
        setReports(prev => [tempReport, ...prev])
        await api.selfService.createReport(classId, body)
        toast('Report saved', 'success')
        refreshReports()
      } else if (editingReport) {
        await api.selfService.updateReport(classId, editingReport.id, body)
        // Invalidate PDF cache
        delete reportCacheRef.current[editingReport.id]
        toast('Report updated', 'success')
      }
      setMode('list')
    } catch (err) {
      toast((err as Error).message, 'error')
      if (mode === 'create') refreshReports() // roll back optimistic
    } finally {
      setSaving(false)
    }
  }

  async function handleViewPdf(r: ClassDailyReport) {
    try {
      const full = reportCacheRef.current[r.id] ?? await api.selfService.classReportDetail(classId, r.id)
      reportCacheRef.current[r.id] = full
      setPreviewArgs({
        report: full,
        className,
        trainers: trainersList,
        enrollments: activeEnr,
        drills,
      })
    } catch (err) {
      toast((err as Error).message, 'error')
    }
  }

  function updateProgress(idx: number, key: string, value: unknown) {
    setFProgress(prev => prev.map((p, i) => i === idx ? { ...p, [key]: value } : p))
  }

  function updateDrillTime(enrollmentId: string, drillId: string, key: 'time_seconds' | 'score', value: string) {
    setFDrillTimes(prev => prev.map(dt =>
      dt.enrollment_id === enrollmentId && dt.drill_id === drillId
        ? { ...dt, [key]: value === '' ? null : Number(value) }
        : dt
    ))
  }

  const enrollmentMap = new Map(enrollments.map(e => [e.id, e]))

  if (mode === 'list') {
    return (
      <>
      <section className="bg-gw-surface rounded-[10px] p-4">
        <header className="flex items-center justify-between gap-2 mb-3">
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Daily Reports
              {!loading && reports.length > 0 && <span className="ml-1.5 font-normal normal-case tracking-normal text-slate-500">({reports.length})</span>}
            </h3>
          </div>
          {!archived && (
            <button type="button" onClick={openCreate} className="rounded-md bg-gradient-to-r from-gw-blue to-gw-teal text-white font-semibold px-3 py-1.5 text-xs hover:brightness-110 transition-all duration-150">
              + New report
            </button>
          )}
        </header>

        {loading ? (
          <SkeletonTable rows={4} cols={4} />
        ) : reports.length === 0 ? (
          <div className="bg-gw-elevated rounded-[10px]">
            <EmptyState title="No reports yet" description="Create the first daily report for this class." variant="neutral" />
          </div>
        ) : (
          <div className="bg-gw-elevated rounded-[10px] overflow-x-auto">
            <table className="min-w-full text-xs">
              <thead>
                <tr className="bg-white/[0.02] border-b border-white/[0.06]">
                  <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Date</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 hidden sm:table-cell">Session</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 hidden sm:table-cell">Group</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 hidden sm:table-cell">Game</th>
                  <th className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">Actions</th>
                </tr>
              </thead>
              <tbody>
                {reports.map(r => (
                  <tr key={r.id} className="border-b border-white/[0.03] hover:bg-gw-surface transition-colors duration-100">
                    <td className="px-3 py-2 text-slate-200 font-medium">{r.report_date}</td>
                    <td className="px-3 py-2 text-slate-400 hidden sm:table-cell">{r.session_label ?? '—'}</td>
                    <td className="px-3 py-2 text-slate-400 hidden sm:table-cell">{r.group_label ?? '—'}</td>
                    <td className="px-3 py-2 text-slate-400 hidden sm:table-cell">{r.game ?? '—'}</td>
                    <td className="px-3 py-2 text-right">
                      <div className="flex items-center justify-end gap-1">
                        {loadingReport ? (
                          <span className="text-slate-500 text-[10px]">Loading…</span>
                        ) : (
                          <>
                            {!archived && (
                              <button type="button" onClick={() => openEdit(r)} className="rounded px-2 py-1 text-[11px] font-medium text-gw-blue hover:bg-gw-blue/10 transition-colors">Edit</button>
                            )}
                            <button type="button" onClick={() => handleViewPdf(r)} className="rounded px-2 py-1 text-[11px] font-medium text-slate-400 hover:bg-white/5 transition-colors">View PDF</button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {previewArgs && (
        <ReportPreviewModal
          args={previewArgs}
          onClose={() => setPreviewArgs(null)}
        />
      )}
      </>
    )
  }

  // Report form (create or edit) — always editable for trainers
  return (
    <section className="bg-gw-surface rounded-[10px] p-4 flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button type="button" onClick={() => setMode('list')} className="text-slate-500 hover:text-slate-300 transition-colors">
          <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.75"><path d="M15 18l-6-6 6-6" /></svg>
        </button>
        <h3 className="text-sm font-semibold text-slate-200">
          {mode === 'create' ? 'New Report' : 'Edit Report'}
        </h3>
      </div>

      {/* Header fields */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
        <div>
          <label className="block text-xs font-medium text-slate-400 mb-1">Report date *
            <input type="date" value={fDate} onChange={e => setFDate(e.target.value)} className={fieldClass + ' mt-1'} required />
          </label>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-400 mb-1">Session label
            <input type="text" value={fSessionLabel} onChange={e => setFSessionLabel(e.target.value)} className={fieldClass + ' mt-1'} placeholder="e.g. Day 4 AM" />
          </label>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-400 mb-1">Group
            <input type="text" value={fGroupLabel} onChange={e => setFGroupLabel(e.target.value)} className={fieldClass + ' mt-1'} placeholder="e.g. A" />
          </label>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-400 mb-1">Game
            <input type="text" value={fGame} onChange={e => setFGame(e.target.value)} className={fieldClass + ' mt-1'} />
          </label>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-400 mb-1">Class start time
            <input type="time" value={fStartTime} onChange={e => setFStartTime(e.target.value)} className={fieldClass + ' mt-1'} />
          </label>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-400 mb-1">Class end time
            <input type="time" value={fEndTime} onChange={e => setFEndTime(e.target.value)} className={fieldClass + ' mt-1'} />
          </label>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-400 mb-1">M&amp;G Confirmed
            <input type="number" min={0} value={fMgConfirmed} onChange={e => setFMgConfirmed(e.target.value)} className={fieldClass + ' mt-1'} />
          </label>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-400 mb-1">M&amp;G Attended
            <input type="number" min={0} value={fMgAttended} onChange={e => setFMgAttended(e.target.value)} className={fieldClass + ' mt-1'} />
          </label>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-400 mb-1">Current trainees
            <input type="number" min={0} value={fCurrentTrainees} onChange={e => setFCurrentTrainees(e.target.value)} className={fieldClass + ' mt-1'} />
          </label>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-400 mb-1">Licenses received
            <input type="number" min={0} value={fLicenses} onChange={e => setFLicenses(e.target.value)} className={fieldClass + ' mt-1'} />
          </label>
        </div>
      </div>

      {/* Per-student progress */}
      {fProgress.length > 0 && (
        <div>
          <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">Student progress</h4>
          <div className="bg-gw-elevated rounded-[10px] overflow-x-auto">
            <table className="min-w-full text-xs">
              <thead>
                <tr className="bg-white/[0.02] border-b border-white/[0.06]">
                  <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 w-32">Student</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Present</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">GK</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Dex</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">HoM</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">HW</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Coming back</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 min-w-[140px]">Notes</th>
                </tr>
              </thead>
              <tbody>
                {fProgress.map((p, idx) => {
                  const enr = enrollmentMap.get(p.enrollment_id)
                  return (
                    <tr key={p.enrollment_id} className="border-b border-white/[0.03]">
                      <td className="px-3 py-2 text-slate-300 font-medium text-[11px]">{enr?.student_name ?? p.enrollment_id}</td>
                      <td className="px-3 py-2">
                        <input type="checkbox" checked={p.attendance} onChange={e => updateProgress(idx, 'attendance', e.target.checked)} className="accent-gw-blue" />
                      </td>
                      {(['gk_rating', 'dex_rating', 'hom_rating'] as const).map(field => (
                        <td key={field} className="px-2 py-1">
                          <select
                            value={p[field] ?? ''}
                            onChange={e => updateProgress(idx, field, e.target.value || null)}
                            className="bg-gw-surface border border-white/10 rounded px-1.5 py-1 text-[10px] text-slate-200 outline-none"
                          >
                            <option value="">—</option>
                            {RATINGS.map(r => <option key={r} value={r}>{r}</option>)}
                          </select>
                        </td>
                      ))}
                      <td className="px-3 py-2">
                        <input type="checkbox" checked={p.homework_completed} onChange={e => updateProgress(idx, 'homework_completed', e.target.checked)} className="accent-gw-blue" />
                      </td>
                      <td className="px-3 py-2">
                        <input type="checkbox" checked={p.coming_back_next_day} onChange={e => updateProgress(idx, 'coming_back_next_day', e.target.checked)} className="accent-gw-blue" />
                      </td>
                      <td className="px-2 py-1">
                        <input
                          type="text"
                          value={p.progress_text ?? ''}
                          onChange={e => updateProgress(idx, 'progress_text', e.target.value || null)}
                          className="w-full bg-gw-surface border border-white/10 rounded px-1.5 py-1 text-[10px] text-slate-200 outline-none"
                          placeholder="Notes…"
                        />
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Drill times */}
      {activeDrills.length > 0 && activeEnr.length > 0 && (
        <div>
          <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">Drill times</h4>
          {activeDrills.map(drill => (
            <div key={drill.id} className="mb-3">
              <p className="text-[11px] font-medium text-slate-300 mb-1">{drill.name} <span className="text-slate-500">({drill.type})</span></p>
              <div className="bg-gw-elevated rounded-[10px] overflow-x-auto">
                <table className="min-w-full text-xs">
                  <thead>
                    <tr className="bg-white/[0.02] border-b border-white/[0.06]">
                      <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Student</th>
                      {drill.type === 'drill' && <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Time (sec)</th>}
                      {drill.type === 'test' && <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Score</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {activeEnr.map(e => {
                      const dt = fDrillTimes.find(d => d.enrollment_id === e.id && d.drill_id === drill.id)
                      return (
                        <tr key={e.id} className="border-b border-white/[0.03]">
                          <td className="px-3 py-2 text-slate-300">{e.student_name}</td>
                          <td className="px-2 py-1">
                            <input
                              type="number"
                              min={0}
                              value={drill.type === 'drill' ? (dt?.time_seconds ?? '') : (dt?.score ?? '')}
                              onChange={ev => updateDrillTime(e.id, drill.id, drill.type === 'drill' ? 'time_seconds' : 'score', ev.target.value)}
                              className="bg-gw-surface border border-white/10 rounded px-1.5 py-1 text-[10px] text-slate-200 outline-none w-24"
                            />
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Action buttons — always editable, no finalize */}
      <div className="flex gap-2 justify-end pt-2 border-t border-white/[0.06]">
        <button type="button" onClick={() => setMode('list')} className="rounded-md bg-gw-elevated text-slate-200 border border-white/10 px-3 py-1.5 text-xs font-semibold hover:bg-gw-surface transition-colors">Cancel</button>
        <button type="button" onClick={handleSave} disabled={saving || !fDate} className="rounded-md bg-gradient-to-r from-gw-blue to-gw-teal text-white px-3 py-1.5 text-xs font-semibold hover:brightness-110 transition-all disabled:opacity-50">
          {saving ? 'Saving…' : mode === 'create' ? 'Create report' : 'Save changes'}
        </button>
      </div>
    </section>
  )
}
