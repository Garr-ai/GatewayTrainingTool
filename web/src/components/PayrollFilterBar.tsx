import type { PayrollFilters } from '../hooks/usePayrollQuery'
import type { Class, Province } from '../types'
import { PROVINCES } from '../types'

interface PayrollFilterBarProps {
  filters: PayrollFilters
  setFilter: <K extends keyof PayrollFilters>(key: K, value: PayrollFilters[K]) => void
  resetFilters: () => void
  onExportCsv: () => void
  classes: Class[]
}

const selectClass = 'bg-gw-elevated border border-white/10 rounded-md text-sm pl-3 pr-8 py-1.5 text-slate-200 outline-none focus:border-gw-blue/40 focus:ring-2 focus:ring-gw-blue/15 appearance-none cursor-pointer'
const inputClass  = 'bg-gw-elevated border border-white/10 rounded-md text-sm px-3 py-1.5 text-slate-200 placeholder:text-slate-500 outline-none focus:border-gw-blue/40 focus:ring-2 focus:ring-gw-blue/15'

export function PayrollFilterBar({ filters, setFilter, resetFilters, onExportCsv, classes }: PayrollFilterBarProps) {
  const sites = [...new Set(
    classes
      .filter(c => !filters.province || c.province === filters.province)
      .map(c => c.site)
      .filter(Boolean),
  )].sort()

  const filteredClasses = classes.filter(c => {
    if (filters.province && c.province !== filters.province) return false
    if (filters.site && c.site !== filters.site) return false
    return true
  })

  const hasActiveFilters =
    filters.province !== '' ||
    filters.site !== '' ||
    filters.class_id !== '' ||
    filters.date_from !== '' ||
    filters.date_to !== ''

  return (
    <div className="bg-gw-surface rounded-[10px] p-3 flex flex-wrap items-center gap-2">
      <select
        className={selectClass}
        value={filters.province}
        onChange={e => {
          setFilter('province', e.target.value as Province | '')
          if (e.target.value !== filters.province) {
            setFilter('site', '')
            setFilter('class_id', '')
          }
        }}
      >
        <option value="">All provinces</option>
        {PROVINCES.map(p => (
          <option key={p.value} value={p.value}>{p.label}</option>
        ))}
      </select>

      <select
        className={selectClass}
        value={filters.site}
        onChange={e => {
          setFilter('site', e.target.value)
          if (e.target.value !== filters.site) setFilter('class_id', '')
        }}
      >
        <option value="">All sites</option>
        {sites.map(s => (
          <option key={s} value={s}>{s}</option>
        ))}
      </select>

      <select
        className={selectClass}
        value={filters.class_id}
        onChange={e => setFilter('class_id', e.target.value)}
      >
        <option value="">All classes</option>
        {filteredClasses.map(c => (
          <option key={c.id} value={c.id}>{c.name}</option>
        ))}
      </select>

      <input
        type="date"
        className={inputClass}
        value={filters.date_from}
        onChange={e => setFilter('date_from', e.target.value)}
        placeholder="From"
      />

      <input
        type="date"
        className={inputClass}
        value={filters.date_to}
        onChange={e => setFilter('date_to', e.target.value)}
        placeholder="To"
      />

      {hasActiveFilters && (
        <button
          type="button"
          onClick={resetFilters}
          className="text-xs text-gw-blue underline underline-offset-2 hover:text-blue-300 transition-colors px-1"
        >
          Reset
        </button>
      )}

      <div className="ml-auto">
        <button
          type="button"
          onClick={onExportCsv}
          className="inline-flex items-center gap-1.5 rounded-md bg-gw-surface text-slate-200 border border-white/10 px-3 py-1.5 text-xs font-semibold hover:bg-gw-elevated transition-colors duration-150"
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="7 10 12 15 17 10" />
            <line x1="12" y1="15" x2="12" y2="3" />
          </svg>
          Export CSV
        </button>
      </div>
    </div>
  )
}
