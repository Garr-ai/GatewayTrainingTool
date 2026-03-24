/**
 * pages/SchedulePage.tsx — Cross-class schedule listing
 *
 * Shows all upcoming schedule slots across all classes with filtering,
 * sorting, and pagination. Supports both a table view and a calendar view.
 */

import { useState } from 'react'
import { useScheduleQuery } from '../hooks/useScheduleQuery'
import { useClasses } from '../contexts/ClassesContext'
import { ScheduleFilterBar } from '../components/ScheduleFilterBar'
import { ScheduleTable } from '../components/ScheduleTable'
import { ScheduleCalendar } from '../components/ScheduleCalendar'
import { Pagination } from '../components/Pagination'
import { SkeletonTable } from '../components/Skeleton'

type ScheduleView = 'table' | 'calendar'

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

  const [view, setView] = useState<ScheduleView>('table')

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
      <header className="flex-shrink-0 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Schedule</h2>
          <p className="mt-0.5 text-xs text-slate-500">
            Upcoming sessions across all {filters.archived ? '' : 'active '}classes
          </p>
        </div>

        {/* View toggle */}
        <div className="flex items-center gap-1 rounded-lg bg-slate-100 p-0.5 self-start sm:self-auto">
          <button
            type="button"
            onClick={() => setView('table')}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${view === 'table' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
          >
            <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 3h18v18H3zM3 9h18M3 15h18M9 3v18M15 3v18" />
            </svg>
            Table
          </button>
          <button
            type="button"
            onClick={() => setView('calendar')}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${view === 'calendar' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
          >
            <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 4H5a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2V6a2 2 0 00-2-2zM16 2v4M8 2v4M3 10h18" />
            </svg>
            Calendar
          </button>
        </div>
      </header>

      <div className="mt-4 flex-1 min-h-0 overflow-auto flex flex-col gap-4">
        <ScheduleFilterBar
          filters={filters}
          setFilter={setFilter}
          resetFilters={resetFilters}
          classes={allClasses}
        />

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
        ) : view === 'table' ? (
          <>
            <ScheduleTable slots={slots} sort={sort} onSort={setSort} />
            <Pagination page={page} limit={limit} total={total} onPageChange={setPage} itemLabel="session" />
          </>
        ) : (
          <ScheduleCalendar slots={slots} />
        )}
      </div>
    </div>
  )
}
