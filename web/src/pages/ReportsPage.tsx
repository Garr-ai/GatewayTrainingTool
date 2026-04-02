import { useState } from 'react'
import { useReportsQuery } from '../hooks/useReportsQuery'
import { useClasses } from '../contexts/ClassesContext'
import { ReportsFilterBar } from '../components/ReportsFilterBar'
import { ReportsTable } from '../components/ReportsTable'
import { Pagination } from '../components/Pagination'
import { ReportPreviewModal } from '../components/ReportPreviewModal'
import { SkeletonTable } from '../components/Skeleton'
import { useToast } from '../contexts/ToastContext'
import { api } from '../lib/apiClient'
import type { ReportRow } from '../lib/apiClient'
import type { ReportPdfArgs } from '../lib/reportPdf'

export function ReportsPage() {
  const { active, archived } = useClasses()
  const { toast } = useToast()
  const {
    reports,
    total,
    page,
    limit,
    loading,
    filters,
    sort,
    setFilter,
    setSort,
    setPage,
    resetFilters,
  } = useReportsQuery()

  const [previewArgs, setPreviewArgs] = useState<ReportPdfArgs | null>(null)
  const [loadingReport, setLoadingReport] = useState<string | null>(null)

  async function handleReportClick(row: ReportRow) {
    if (loadingReport) return
    setLoadingReport(row.id)
    try {
      const [fullReport, trainers, enrollments, drills] = await Promise.all([
        api.reports.get(row.id),
        api.trainers.list(row.class_id),
        api.enrollments.list(row.class_id),
        api.drills.list(row.class_id),
      ])
      setPreviewArgs({
        report: fullReport,
        className: row.classes.name,
        trainers,
        enrollments,
        drills,
      })
    } catch {
      toast('Failed to load report', 'error')
    } finally {
      setLoadingReport(null)
    }
  }

  const allClasses = filters.archived ? [...active, ...archived] : active

  const hasActiveFilters =
    filters.province !== '' ||
    filters.site !== '' ||
    filters.class_id !== '' ||
    filters.game_type !== '' ||
    filters.date_from !== '' ||
    filters.date_to !== '' ||
    filters.search !== '' ||
    filters.archived !== false

  return (
    <div className="flex flex-col h-full min-h-0">
      <header className="flex-shrink-0 flex items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-100">Reports</h2>
          <p className="mt-0.5 text-sm text-slate-300">
            Daily reports across all {filters.archived ? '' : 'active '}classes
          </p>
        </div>
      </header>

      <div className="mt-4 flex-1 min-h-0 overflow-auto flex flex-col gap-4">
        <ReportsFilterBar
          filters={filters}
          setFilter={setFilter}
          resetFilters={resetFilters}
          classes={allClasses}
        />

        {loading ? (
          <SkeletonTable rows={5} cols={5} />
        ) : reports.length === 0 ? (
          <div className="bg-gw-surface rounded-[10px] p-10 text-center">
            {hasActiveFilters ? (
              <>
                <p className="text-sm text-slate-300">No reports match your filters.</p>
                <button
                  type="button"
                  onClick={resetFilters}
                  className="mt-2 text-xs text-gw-blue underline underline-offset-2 hover:text-blue-300 transition-colors"
                >
                  Reset all filters
                </button>
              </>
            ) : (
              <>
                <p className="text-sm text-slate-300">No reports found.</p>
                <p className="mt-1 text-xs text-slate-500">Reports appear here once created inside a class.</p>
              </>
            )}
          </div>
        ) : (
          <>
            <ReportsTable
              reports={reports}
              sort={sort}
              onSort={setSort}
              onReportClick={handleReportClick}
            />
            {loadingReport && (
              <div className="text-center text-xs text-slate-500">Loading report…</div>
            )}
            <Pagination page={page} limit={limit} total={total} onPageChange={setPage} itemLabel="report" />
          </>
        )}
      </div>

      {previewArgs && (
        <ReportPreviewModal args={previewArgs} onClose={() => setPreviewArgs(null)} />
      )}
    </div>
  )
}
