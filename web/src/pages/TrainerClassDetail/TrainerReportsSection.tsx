import { useState, useCallback, useRef } from 'react'
import { api, type ReportBody, type ReportWithNested } from '../../lib/apiClient'
import { useTrainerClassDetail } from '../../contexts/TrainerClassDetailContext'
import { SkeletonTable } from '../../components/Skeleton'
import { EmptyState } from '../../components/EmptyState'
import { ReportPreviewModal } from '../../components/ReportPreviewModal'
import { ReportEditForm } from '../../components/ReportEditForm'
import { useToast } from '../../contexts/ToastContext'
import type { ClassDailyReport } from '../../types'
import type { ReportPdfArgs } from '../../lib/reportPdf'

export function TrainerReportsSection() {
  const {
    classId, classInfo, trainers, reports, enrollments, drills,
    trainerHours, studentHours, loading, refreshReports, setReports,
  } = useTrainerClassDetail()
  const { toast } = useToast()
  const [mode, setMode] = useState<'list' | 'create' | 'edit'>('list')
  const [editingReport, setEditingReport] = useState<ReportWithNested | null>(null)
  const [loadingReport, setLoadingReport] = useState(false)

  // PDF preview state
  const [previewArgs, setPreviewArgs] = useState<ReportPdfArgs | null>(null)
  const reportCacheRef = useRef<Record<string, ReportWithNested>>({})

  const archived = classInfo?.archived ?? false
  const activeEnr = enrollments.filter(e => e.status === 'enrolled')
  const className = classInfo?.name ?? ''

  function openCreate() {
    setEditingReport(null)
    setMode('create')
  }

  const openEdit = useCallback(async (report: ClassDailyReport) => {
    setLoadingReport(true)
    try {
      const full = reportCacheRef.current[report.id] ?? await api.selfService.classReportDetail(classId, report.id)
      reportCacheRef.current[report.id] = full
      setEditingReport(full)
      setMode('edit')
    } catch (err) {
      toast((err as Error).message, 'error')
    } finally {
      setLoadingReport(false)
    }
  }, [classId, toast])

  async function handleSaveFromForm(body: ReportBody) {
    try {
      if (mode === 'create') {
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
          created_at: new Date().toISOString(),
        }
        setReports(prev => [tempReport, ...prev])
        await api.selfService.createReport(classId, body)
        toast('Report saved', 'success')
        refreshReports()
      } else if (editingReport) {
        await api.selfService.updateReport(classId, editingReport.id, body)
        delete reportCacheRef.current[editingReport.id]
        toast('Report updated', 'success')
      }
      setMode('list')
      setEditingReport(null)
    } catch (err) {
      toast((err as Error).message, 'error')
      refreshReports()
      throw err
    }
  }

  async function handleViewPdf(r: ClassDailyReport) {
    try {
      const full = reportCacheRef.current[r.id] ?? await api.selfService.classReportDetail(classId, r.id)
      reportCacheRef.current[r.id] = full
      setPreviewArgs({
        report: full,
        className,
        trainers,
        enrollments: activeEnr,
        drills,
      })
    } catch (err) {
      toast((err as Error).message, 'error')
    }
  }

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

  // Form mode (create or edit)
  return (
    <section className="bg-gw-surface rounded-[10px] p-4 flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <button type="button" onClick={() => { setMode('list'); setEditingReport(null) }} className="text-slate-500 hover:text-slate-300 transition-colors">
          <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.75"><path d="M15 18l-6-6 6-6" /></svg>
        </button>
        <h3 className="text-sm font-semibold text-slate-200">
          {mode === 'create' ? 'New Report' : 'Edit Report'}
        </h3>
      </div>

      <ReportEditForm
        report={editingReport}
        trainers={trainers}
        enrollments={activeEnr}
        drills={drills}
        hours={[...trainerHours, ...studentHours]}
        defaultGame={classInfo?.game_type ?? ''}
        onSave={handleSaveFromForm}
        onCancel={() => { setMode('list'); setEditingReport(null) }}
        canDelete={false}
      />
    </section>
  )
}
