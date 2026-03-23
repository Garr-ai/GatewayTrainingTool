import { useScheduleQuery } from '../hooks/useScheduleQuery'
import { useClasses } from '../contexts/ClassesContext'
import { ScheduleFilterBar } from '../components/ScheduleFilterBar'
import { ScheduleTable } from '../components/ScheduleTable'
import { Pagination } from '../components/Pagination'
import { SkeletonTable } from '../components/Skeleton'

export function SchedulePage() {
  const { active, archived } = useClasses()
  const {
    slots,
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
  } = useScheduleQuery()

  const allClasses = filters.archived ? [...active, ...archived] : active

  const hasActiveFilters =
    filters.province !== '' ||
    filters.site !== '' ||
    filters.class_id !== '' ||
    filters.game_type !== '' ||
    filters.date_from !== '' ||
    filters.date_to !== '' ||
    filters.group_label !== '' ||
    filters.search !== '' ||
    filters.archived !== false

  return (
    <div className="flex flex-col h-full min-h-0">
      <header className="flex-shrink-0">
        <h2 className="text-lg font-semibold text-slate-900">Schedule</h2>
        <p className="mt-0.5 text-xs text-slate-500">
          Upcoming sessions across all {filters.archived ? '' : 'active '}classes
        </p>
      </header>

      <div className="mt-4 flex-1 min-h-0 overflow-auto flex flex-col gap-4">
        {/* Filter bar */}
        <ScheduleFilterBar
          filters={filters}
          setFilter={setFilter}
          resetFilters={resetFilters}
          classes={allClasses}
        />

        {/* Content */}
        {loading ? (
          <SkeletonTable rows={5} cols={5} />
        ) : slots.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-10 text-center">
            {hasActiveFilters ? (
              <>
                <p className="text-sm text-slate-600">No sessions match your filters.</p>
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
                <p className="text-sm text-slate-600">No upcoming sessions.</p>
                <p className="mt-1 text-xs text-slate-500">Schedule slots appear here once added inside a class.</p>
              </>
            )}
          </div>
        ) : (
          <>
            <ScheduleTable slots={slots} sort={sort} onSort={setSort} />
            <Pagination page={page} limit={limit} total={total} onPageChange={setPage} itemLabel="session" />
          </>
        )}
      </div>
    </div>
  )
}
