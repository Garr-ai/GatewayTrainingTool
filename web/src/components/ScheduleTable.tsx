import { useNavigate } from 'react-router-dom'
import type { ScheduleRow } from '../lib/apiClient'
import type { ScheduleSort } from '../hooks/useScheduleQuery'
import { classSlug, formatTime } from '../lib/utils'
import type { Province } from '../types'

interface ScheduleTableProps {
  slots: ScheduleRow[]
  sort: ScheduleSort
  onSort: (column: string) => void
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
  { key: 'slot_date', label: 'Date', sortable: true },
  { key: 'start_time', label: 'Time', sortable: true },
  { key: 'trainer', label: 'Trainer', sortable: false, hideBelow: 'sm' },
  { key: 'group', label: 'Group', sortable: false, hideBelow: 'sm' },
  { key: 'notes', label: 'Notes', sortable: false, hideBelow: 'md' },
]

function SortArrow({ column, sort }: { column: string; sort: ScheduleSort }) {
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

export function ScheduleTable({ slots, sort, onSort }: ScheduleTableProps) {
  const navigate = useNavigate()

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
            <col className="w-[20%]" />   {/* Class */}
            <col className="w-[13%]" />   {/* Date */}
            <col className="w-[17%]" />   {/* Time */}
            <col className="hidden sm:table-column w-[18%]" />  {/* Trainer */}
            <col className="hidden sm:table-column w-[10%]" />  {/* Group */}
            <col className="hidden md:table-column w-[22%]" />  {/* Notes */}
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
            {slots.map(s => {
              const province = s.classes.province as Province
              return (
                <tr
                  key={s.id}
                  className="border-b border-slate-100 hover:bg-slate-50 cursor-pointer"
                  onClick={() => navigate(`/classes/${classSlug(s.classes.name)}`)}
                >
                  <td className="px-4 py-3 font-medium text-gw-dark truncate">
                    {s.classes.name}
                    {province && (
                      <span className={`ml-1.5 inline-block text-[10px] font-medium px-1.5 py-0.5 rounded ${PROVINCE_BADGE[province] ?? ''}`}>
                        {province}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-slate-600 whitespace-nowrap">
                    {new Date(s.slot_date + 'T00:00:00').toLocaleDateString('en-CA', {
                      weekday: 'short',
                      month: 'short',
                      day: 'numeric',
                    })}
                  </td>
                  <td className="px-4 py-3 text-slate-600 whitespace-nowrap">
                    {formatTime(s.start_time)} – {formatTime(s.end_time)}
                  </td>
                  <td className="hidden sm:table-cell px-4 py-3 text-slate-600 truncate">
                    {s.class_trainers?.trainer_name ?? '—'}
                  </td>
                  <td className="hidden sm:table-cell px-4 py-3 text-slate-600">{s.group_label ?? '—'}</td>
                  <td className="hidden md:table-cell px-4 py-3 text-slate-500 truncate">{s.notes ?? '—'}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
