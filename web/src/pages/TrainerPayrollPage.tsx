import { usePayrollQuery } from '../hooks/usePayrollQuery'
import { useClasses } from '../contexts/ClassesContext'
import { PayrollFilterBar } from '../components/PayrollFilterBar'
import { PayrollTable } from '../components/PayrollTable'
import { Pagination } from '../components/Pagination'
import { SkeletonTable } from '../components/Skeleton'
import { useToast } from '../contexts/ToastContext'

export function TrainerPayrollPage() {
  const { active } = useClasses()
  const { toast } = useToast()
  const {
    rows, total, page, limit, loading,
    filters, setFilter, setPage, resetFilters, exportCsv,
  } = usePayrollQuery('trainer')

  async function handleExport() {
    try {
      await exportCsv()
      toast('CSV downloaded', 'success')
    } catch {
      toast('Export failed', 'error')
    }
  }

  const hasActiveFilters =
    filters.province !== '' ||
    filters.site !== '' ||
    filters.class_id !== '' ||
    filters.date_from !== '' ||
    filters.date_to !== ''

  return (
    <div className="flex flex-col h-full min-h-0">
      <header className="flex-shrink-0">
        <h2 className="text-lg font-semibold text-slate-900">Trainer Payroll</h2>
        <p className="mt-0.5 text-xs text-slate-500">
          Aggregated training hours per trainer across all classes
        </p>
      </header>

      <div className="mt-4 flex-1 min-h-0 overflow-auto flex flex-col gap-4">
        <PayrollFilterBar
          filters={filters}
          setFilter={setFilter}
          resetFilters={resetFilters}
          onExportCsv={handleExport}
          classes={active}
        />

        {loading ? (
          <SkeletonTable rows={5} cols={6} />
        ) : rows.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-10 text-center">
            {hasActiveFilters ? (
              <>
                <p className="text-sm text-slate-600">No hours match your filters.</p>
                <button type="button" onClick={resetFilters} className="mt-2 text-xs text-gw-dark hover:underline">
                  Reset all filters
                </button>
              </>
            ) : (
              <>
                <p className="text-sm text-slate-600">No trainer hours logged yet.</p>
                <p className="mt-1 text-xs text-slate-500">Hours appear here once logged inside a class.</p>
              </>
            )}
          </div>
        ) : (
          <>
            <PayrollTable rows={rows} personLabel="Trainer" />
            <Pagination page={page} limit={limit} total={total} onPageChange={setPage} itemLabel="trainer" />
          </>
        )}
      </div>
    </div>
  )
}
