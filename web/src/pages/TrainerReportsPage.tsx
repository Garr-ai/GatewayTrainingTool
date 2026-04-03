import { useState, useEffect } from 'react'
import { api } from '../lib/apiClient'
import { useTrainer } from '../contexts/TrainerContext'
import { SkeletonTable } from '../components/Skeleton'
import { EmptyState } from '../components/EmptyState'
import { Pagination } from '../components/Pagination'
import type { ClassDailyReport } from '../types'
import type { ReportRowClass } from '../lib/apiClient'

type ReportRow = ClassDailyReport & { classes: ReportRowClass }

export function TrainerReportsPage() {
  const { classes } = useTrainer()
  const [reports, setReports] = useState<ReportRow[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(0)
  const [loading, setLoading] = useState(true)

  const [filterClass, setFilterClass] = useState('')
  const [filterFrom, setFilterFrom] = useState('')
  const [filterTo, setFilterTo] = useState('')
  const [filterStatus, setFilterStatus] = useState('')

  const limit = 50

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    api.selfService.allReports({
      class_id: filterClass || undefined,
      date_from: filterFrom || undefined,
      date_to: filterTo || undefined,
      status: filterStatus || undefined,
      page,
      limit,
    })
      .then(res => {
        if (cancelled) return
        setReports(res.data as ReportRow[])
        setTotal(res.total)
      })
      .catch(err => console.error(err))
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [filterClass, filterFrom, filterTo, filterStatus, page])

  function reset() {
    setFilterClass('')
    setFilterFrom('')
    setFilterTo('')
    setFilterStatus('')
    setPage(0)
  }

  const inputClass = 'h-8 bg-gw-surface border border-white/10 rounded px-2.5 text-xs text-slate-200 outline-none focus:border-gw-blue/40'

  return (
    <div className="flex flex-col gap-4">
      <header>
        <h2 className="text-xl font-bold text-slate-100">Reports</h2>
        <p className="mt-0.5 text-sm text-slate-400">Daily reports across all assigned classes</p>
      </header>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 items-end">
        <select value={filterClass} onChange={e => { setFilterClass(e.target.value); setPage(0) }} className={inputClass}>
          <option value="">All classes</option>
          {classes.map(c => <option key={c.class_id} value={c.class_id}>{c.class_name}</option>)}
        </select>
        <input type="date" value={filterFrom} onChange={e => { setFilterFrom(e.target.value); setPage(0) }} className={inputClass} title="From date" />
        <input type="date" value={filterTo} onChange={e => { setFilterTo(e.target.value); setPage(0) }} className={inputClass} title="To date" />
        <select value={filterStatus} onChange={e => { setFilterStatus(e.target.value); setPage(0) }} className={inputClass}>
          <option value="">All statuses</option>
          <option value="draft">Draft</option>
          <option value="finalized">Finalized</option>
        </select>
        {(filterClass || filterFrom || filterTo || filterStatus) && (
          <button type="button" onClick={reset} className="h-8 px-3 rounded text-xs text-slate-400 border border-white/10 hover:text-slate-200 hover:border-white/20 transition-colors">Reset</button>
        )}
      </div>

      {loading ? (
        <SkeletonTable rows={5} cols={5} />
      ) : reports.length === 0 ? (
        <div className="bg-gw-surface rounded-[10px]">
          <EmptyState title="No reports found" description="No daily reports match your filters." variant="neutral" action={{ label: 'Reset filters', onClick: reset }} />
        </div>
      ) : (
        <>
          <div className="bg-gw-surface rounded-[10px] overflow-x-auto">
            <table className="min-w-full text-xs">
              <thead>
                <tr className="bg-white/[0.02] border-b border-white/[0.06]">
                  <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Date</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Class</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 hidden sm:table-cell">Session</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 hidden sm:table-cell">Group</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Status</th>
                </tr>
              </thead>
              <tbody>
                {reports.map(r => (
                  <tr key={r.id} className="border-b border-white/[0.03] hover:bg-gw-elevated transition-colors">
                    <td className="px-3 py-2 text-slate-200 font-medium">{r.report_date}</td>
                    <td className="px-3 py-2 text-slate-300 text-xs">{(r.classes as ReportRowClass).name}</td>
                    <td className="px-3 py-2 text-slate-400 hidden sm:table-cell">{r.session_label ?? '—'}</td>
                    <td className="px-3 py-2 text-slate-400 hidden sm:table-cell">{r.group_label ?? '—'}</td>
                    <td className="px-3 py-2">
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium ${
                        r.status === 'finalized' ? 'bg-emerald-500/15 text-emerald-300' : 'bg-amber-500/15 text-amber-300'
                      }`}>{r.status}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination page={page} limit={limit} total={total} onPageChange={setPage} itemLabel="report" />
        </>
      )}
    </div>
  )
}
