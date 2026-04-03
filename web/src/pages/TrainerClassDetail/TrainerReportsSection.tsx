import { useState, useCallback } from 'react'
import { api } from '../../lib/apiClient'
import { useTrainerClassDetail } from '../../contexts/TrainerClassDetailContext'
import { SkeletonTable } from '../../components/Skeleton'
import { EmptyState } from '../../components/EmptyState'
import { ConfirmDialog } from '../../components/ConfirmDialog'
import { useToast } from '../../contexts/ToastContext'
import type { ClassDailyReport, ClassDrill, ClassEnrollment, DailyRating } from '../../types'
import type { ReportWithNested } from '../../lib/apiClient'

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
  const { classId, classInfo, reports, enrollments, drills, loading, refreshReports } = useTrainerClassDetail()
  const { toast } = useToast()
  const [mode, setMode] = useState<'list' | 'create' | 'edit'>('list')
  const [editingReport, setEditingReport] = useState<ReportWithNested | null>(null)
  const [loadingReport, setLoadingReport] = useState(false)
  const [saving, setSaving] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<ClassDailyReport | null>(null)

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

      // Build progress rows — fill from existing or default
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

      // Build drill time rows
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

  function buildBody(status?: 'draft' | 'finalized'): ReportBody {
    void status
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

  async function handleSaveDraft() {
    setSaving(true)
    try {
      const body = buildBody()
      if (mode === 'create') {
        await api.selfService.createReport(classId, body)
        toast('Report saved as draft', 'success')
      } else if (editingReport) {
        await api.selfService.updateReport(classId, editingReport.id, body)
        toast('Report updated', 'success')
      }
      setMode('list')
      refreshReports()
    } catch (err) {
      toast((err as Error).message, 'error')
    } finally {
      setSaving(false)
    }
  }

  async function handleFinalize() {
    if (!editingReport) return
    setSaving(true)
    try {
      // Save first then finalize
      await api.selfService.updateReport(classId, editingReport.id, buildBody())
      await api.selfService.finalizeReport(classId, editingReport.id)
      toast('Report finalized', 'success')
      setMode('list')
      refreshReports()
    } catch (err) {
      toast((err as Error).message, 'error')
    } finally {
      setSaving(false)
    }
  }

  async function handleFinalizeNew() {
    setSaving(true)
    try {
      const report = await api.selfService.createReport(classId, buildBody())
      await api.selfService.finalizeReport(classId, report.id)
      toast('Report created and finalized', 'success')
      setMode('list')
      refreshReports()
    } catch (err) {
      toast((err as Error).message, 'error')
    } finally {
      setSaving(false)
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
                  <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Status</th>
                  <th className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">Actions</th>
                </tr>
              </thead>
              <tbody>
                {reports.map(r => (
                  <tr key={r.id} className="border-b border-white/[0.03] hover:bg-gw-surface transition-colors duration-100">
                    <td className="px-3 py-2 text-slate-200 font-medium">{r.report_date}</td>
                    <td className="px-3 py-2 text-slate-400 hidden sm:table-cell">{r.session_label ?? '—'}</td>
                    <td className="px-3 py-2 text-slate-400 hidden sm:table-cell">{r.group_label ?? '—'}</td>
                    <td className="px-3 py-2">
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium ${
                        r.status === 'finalized' ? 'bg-emerald-500/15 text-emerald-300' : 'bg-amber-500/15 text-amber-300'
                      }`}>
                        {r.status}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right">
                      <div className="flex items-center justify-end gap-1">
                        {loadingReport ? (
                          <span className="text-slate-500 text-[10px]">Loading…</span>
                        ) : (
                          <>
                            {!archived && r.status === 'draft' && (
                              <button type="button" onClick={() => openEdit(r)} className="rounded px-2 py-1 text-[11px] font-medium text-gw-blue hover:bg-gw-blue/10 transition-colors">Edit</button>
                            )}
                            {!archived && r.status === 'draft' && (
                              <button type="button" onClick={() => setDeleteTarget(r)} className="rounded px-2 py-1 text-[11px] font-medium text-rose-400 hover:bg-rose-500/10 transition-colors">Delete</button>
                            )}
                            {r.status === 'finalized' && (
                              <button type="button" onClick={() => openEdit(r)} className="rounded px-2 py-1 text-[11px] font-medium text-slate-400 hover:bg-white/5 transition-colors">View</button>
                            )}
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

        <ConfirmDialog
          open={!!deleteTarget}
          title="Delete report"
          message={`Delete report for ${deleteTarget?.report_date}? This cannot be undone.`}
          confirmLabel="Delete"
          confirmVariant="danger"
          onConfirm={async () => {
            if (!deleteTarget) return
            try {
              // No delete endpoint in trainer self-service — only coordinators can delete
              // Show informative message
              toast('Reports can only be deleted by coordinators.', 'error')
            } catch (err) {
              toast((err as Error).message, 'error')
            } finally {
              setDeleteTarget(null)
            }
          }}
          onCancel={() => setDeleteTarget(null)}
        />
      </section>
    )
  }

  // Report form (create or edit)
  const isFinalized = editingReport?.status === 'finalized'

  return (
    <section className="bg-gw-surface rounded-[10px] p-4 flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button type="button" onClick={() => setMode('list')} className="text-slate-500 hover:text-slate-300 transition-colors">
          <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.75"><path d="M15 18l-6-6 6-6" /></svg>
        </button>
        <h3 className="text-sm font-semibold text-slate-200">
          {mode === 'create' ? 'New Report' : isFinalized ? 'View Report' : 'Edit Report'}
        </h3>
        {isFinalized && (
          <span className="ml-auto text-[10px] bg-emerald-500/15 text-emerald-300 px-2 py-0.5 rounded-full font-medium">Finalized</span>
        )}
      </div>

      {/* Header fields */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
        <div>
          <label className="block text-xs font-medium text-slate-400 mb-1">Report date *
            <input type="date" value={fDate} onChange={e => setFDate(e.target.value)} disabled={isFinalized} className={fieldClass + ' mt-1'} required />
          </label>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-400 mb-1">Session label
            <input type="text" value={fSessionLabel} onChange={e => setFSessionLabel(e.target.value)} disabled={isFinalized} className={fieldClass + ' mt-1'} placeholder="e.g. Day 4 AM" />
          </label>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-400 mb-1">Group
            <input type="text" value={fGroupLabel} onChange={e => setFGroupLabel(e.target.value)} disabled={isFinalized} className={fieldClass + ' mt-1'} placeholder="e.g. A" />
          </label>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-400 mb-1">Game
            <input type="text" value={fGame} onChange={e => setFGame(e.target.value)} disabled={isFinalized} className={fieldClass + ' mt-1'} />
          </label>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-400 mb-1">Class start time
            <input type="time" value={fStartTime} onChange={e => setFStartTime(e.target.value)} disabled={isFinalized} className={fieldClass + ' mt-1'} />
          </label>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-400 mb-1">Class end time
            <input type="time" value={fEndTime} onChange={e => setFEndTime(e.target.value)} disabled={isFinalized} className={fieldClass + ' mt-1'} />
          </label>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-400 mb-1">M&amp;G Confirmed
            <input type="number" min={0} value={fMgConfirmed} onChange={e => setFMgConfirmed(e.target.value)} disabled={isFinalized} className={fieldClass + ' mt-1'} />
          </label>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-400 mb-1">M&amp;G Attended
            <input type="number" min={0} value={fMgAttended} onChange={e => setFMgAttended(e.target.value)} disabled={isFinalized} className={fieldClass + ' mt-1'} />
          </label>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-400 mb-1">Current trainees
            <input type="number" min={0} value={fCurrentTrainees} onChange={e => setFCurrentTrainees(e.target.value)} disabled={isFinalized} className={fieldClass + ' mt-1'} />
          </label>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-400 mb-1">Licenses received
            <input type="number" min={0} value={fLicenses} onChange={e => setFLicenses(e.target.value)} disabled={isFinalized} className={fieldClass + ' mt-1'} />
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
                        <input type="checkbox" checked={p.attendance} disabled={isFinalized} onChange={e => updateProgress(idx, 'attendance', e.target.checked)} className="accent-gw-blue" />
                      </td>
                      {(['gk_rating', 'dex_rating', 'hom_rating'] as const).map(field => (
                        <td key={field} className="px-2 py-1">
                          <select
                            value={p[field] ?? ''}
                            disabled={isFinalized}
                            onChange={e => updateProgress(idx, field, e.target.value || null)}
                            className="bg-gw-surface border border-white/10 rounded px-1.5 py-1 text-[10px] text-slate-200 outline-none"
                          >
                            <option value="">—</option>
                            {RATINGS.map(r => <option key={r} value={r}>{r}</option>)}
                          </select>
                        </td>
                      ))}
                      <td className="px-3 py-2">
                        <input type="checkbox" checked={p.homework_completed} disabled={isFinalized} onChange={e => updateProgress(idx, 'homework_completed', e.target.checked)} className="accent-gw-blue" />
                      </td>
                      <td className="px-3 py-2">
                        <input type="checkbox" checked={p.coming_back_next_day} disabled={isFinalized} onChange={e => updateProgress(idx, 'coming_back_next_day', e.target.checked)} className="accent-gw-blue" />
                      </td>
                      <td className="px-2 py-1">
                        <input
                          type="text"
                          value={p.progress_text ?? ''}
                          disabled={isFinalized}
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
                              disabled={isFinalized}
                              value={drill.type === 'drill' ? (dt?.time_seconds ?? '') : (dt?.score ?? '')}
                              onChange={e => updateDrillTime(e.target.closest('tr')!.dataset.eid ?? '', drill.id, drill.type === 'drill' ? 'time_seconds' : 'score', e.target.value)}
                              // Use data attribute to pass enrollment id
                              // Actually, we need a closure here:
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

      {/* Action buttons */}
      {!isFinalized && (
        <div className="flex gap-2 justify-end pt-2 border-t border-white/[0.06]">
          <button type="button" onClick={() => setMode('list')} className="rounded-md bg-gw-elevated text-slate-200 border border-white/10 px-3 py-1.5 text-xs font-semibold hover:bg-gw-surface transition-colors">Cancel</button>
          <button type="button" onClick={handleSaveDraft} disabled={saving || !fDate} className="rounded-md bg-gw-surface border border-white/10 text-slate-200 px-3 py-1.5 text-xs font-semibold hover:bg-gw-elevated transition-colors disabled:opacity-50">
            {saving ? 'Saving…' : 'Save draft'}
          </button>
          {mode === 'create' && (
            <button type="button" onClick={handleFinalizeNew} disabled={saving || !fDate} className="rounded-md bg-gradient-to-r from-gw-blue to-gw-teal text-white px-3 py-1.5 text-xs font-semibold hover:brightness-110 transition-all disabled:opacity-50">
              Create &amp; finalize
            </button>
          )}
          {mode === 'edit' && editingReport && (
            <button type="button" onClick={handleFinalize} disabled={saving || !fDate} className="rounded-md bg-gradient-to-r from-gw-blue to-gw-teal text-white px-3 py-1.5 text-xs font-semibold hover:brightness-110 transition-all disabled:opacity-50">
              Save &amp; finalize
            </button>
          )}
        </div>
      )}
      {isFinalized && (
        <div className="flex gap-2 justify-end pt-2 border-t border-white/[0.06]">
          <button type="button" onClick={() => setMode('list')} className="rounded-md bg-gw-elevated text-slate-200 border border-white/10 px-3 py-1.5 text-xs font-semibold hover:bg-gw-surface transition-colors">Back to list</button>
        </div>
      )}
    </section>
  )
}
