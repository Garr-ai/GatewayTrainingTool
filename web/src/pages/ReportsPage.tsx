import { useReportsQuery } from '../hooks/useReportsQuery'
import { useClasses } from '../contexts/ClassesContext'
import { ReportsFilterBar } from '../components/ReportsFilterBar'
import { ReportsTable } from '../components/ReportsTable'
import { Pagination } from '../components/Pagination'
import { SkeletonTable } from '../components/Skeleton'

export function ReportsPage() {
  const { active, archived } = useClasses()
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

  // When "Include archived" is checked, show all classes in dropdowns;
  // otherwise only active classes
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
      <header className="flex-shrink-0">
        <h2 className="text-lg font-semibold text-slate-900">Reports</h2>
        <p className="mt-0.5 text-xs text-slate-500">
          Daily reports across all {filters.archived ? '' : 'active '}classes
        </p>
      </header>

      <div className="mt-4 flex-1 min-h-0 overflow-auto flex flex-col gap-4">
        {/* Filter bar */}
        <ReportsFilterBar
          filters={filters}
          setFilter={setFilter}
          resetFilters={resetFilters}
          classes={allClasses}
        />

        {/* Content */}
        {loading ? (
          <SkeletonTable rows={5} cols={5} />
        ) : reports.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-10 text-center">
            {hasActiveFilters ? (
              <>
                <p className="text-sm text-slate-600">No reports match your filters.</p>
                <button
                  type="button"
                  onClick={resetFilters}
                  className="mt-2 text-xs text-gw-dark hover:underline"
                >
                  Reset all filters
                </button>
              </>
            ) : (
              <>
                <p className="text-sm text-slate-600">No reports found.</p>
                <p className="mt-1 text-xs text-slate-500">Reports appear here once created inside a class.</p>
              </>
            )}
          </div>
        ) : (
          <>
            <ReportsTable reports={reports} sort={sort} onSort={setSort} />
            <Pagination page={page} limit={limit} total={total} onPageChange={setPage} itemLabel="report" />
          </>
        )}
      </div>
    </div>
  )
}
