import type { ReportRow } from '../lib/apiClient'
import type { ReportsSort } from '../hooks/useReportsQuery'
import type { Province } from '../types'

interface ReportsTableProps {
  reports: ReportRow[]
  sort: ReportsSort
  onSort: (column: string) => void
  onReportClick: (report: ReportRow) => void
}

const PROVINCE_BADGE: Record<Province, string> = {
  BC: 'bg-emerald-100 text-emerald-700',
  AB: 'bg-amber-100 text-amber-700',
  ON: 'bg-blue-100 text-blue-700',
}

type Column = {
  key: string
  label: string
  sortable: boolean
  hideBelow?: 'sm' | 'md'
}

const COLUMNS: Column[] = [
  { key: 'class', label: 'Class', sortable: false },
  { key: 'site', label: 'Site', sortable: false },
  { key: 'report_date', label: 'Date', sortable: true },
  { key: 'group', label: 'Group', sortable: false, hideBelow: 'sm' },
  { key: 'game', label: 'Game', sortable: true, hideBelow: 'sm' },
  { key: 'session', label: 'Session', sortable: false, hideBelow: 'md' },
  { key: 'current_trainees', label: 'Trainees', sortable: true, hideBelow: 'md' },
]

function SortArrow({ column, sort }: { column: string; sort: ReportsSort }) {
  if (sort.column !== column) {
    return (
      <svg className="w-3 h-3 ml-1 opacity-0 group-hover:opacity-40 inline" viewBox="0 0 12 12" fill="currentColor">
        <path d="M6 2l3 4H3z" />
        <path d="M6 10l-3-4h6z" />
      </svg>
    )
  }
  return (
    <svg className="w-3 h-3 ml-1 inline" viewBox="0 0 12 12" fill="currentColor">
      {sort.direction === 'asc'
        ? <path d="M6 2l3 4H3z" />
        : <path d="M6 10l-3-4h6z" />
      }
    </svg>
  )
}

export function ReportsTable({ reports, sort, onSort, onReportClick }: ReportsTableProps) {
  const hiddenClass = (col: Column) => {
    if (col.hideBelow === 'sm') return 'hidden sm:table-cell'
    if (col.hideBelow === 'md') return 'hidden md:table-cell'
    return ''
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm table-fixed">
          <colgroup>
            <col className="w-[18%]" />   {/* Class */}
            <col className="w-[14%]" />   {/* Site */}
            <col className="w-[13%]" />   {/* Date */}
            <col className="hidden sm:table-column w-[10%]" />  {/* Group */}
            <col className="hidden sm:table-column w-[15%]" />  {/* Game */}
            <col className="hidden md:table-column w-[16%]" />  {/* Session */}
            <col className="hidden md:table-column w-[10%]" />  {/* Trainees */}
          </colgroup>
          <thead>
            <tr className="border-b border-slate-200 bg-gw-dark">
              {COLUMNS.map(col => (
                <th
                  key={col.key}
                  className={`px-4 py-3 font-medium text-white ${hiddenClass(col)} ${col.sortable ? 'cursor-pointer select-none group hover:bg-white/10' : ''}`}
                  onClick={col.sortable ? () => onSort(col.key) : undefined}
                >
                  {col.label}
                  {col.sortable && <SortArrow column={col.key} sort={sort} />}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {reports.map(r => {
              const province = r.classes.province as Province
              return (
                <tr
                  key={r.id}
                  className="border-b border-slate-100 hover:bg-slate-50 cursor-pointer"
                  onClick={() => onReportClick(r)}
                >
                  <td className="px-4 py-3 font-medium text-gw-dark truncate">{r.classes.name}</td>
                  <td className="px-4 py-3 text-slate-600 truncate">
                    {r.classes.site}
                    {province && (
                      <span className={`ml-1.5 inline-block text-[10px] font-medium px-1.5 py-0.5 rounded ${PROVINCE_BADGE[province] ?? ''}`}>
                        {province}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-slate-600 whitespace-nowrap">{r.report_date}</td>
                  <td className="hidden sm:table-cell px-4 py-3 text-slate-600">{r.group_label ?? '—'}</td>
                  <td className="hidden sm:table-cell px-4 py-3 text-slate-600 truncate">{r.game ?? '—'}</td>
                  <td className="hidden md:table-cell px-4 py-3 text-slate-600 truncate">{r.session_label ?? '—'}</td>
                  <td className="hidden md:table-cell px-4 py-3 text-slate-600">{r.current_trainees ?? '—'}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
