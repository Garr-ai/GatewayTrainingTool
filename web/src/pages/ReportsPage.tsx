/**
 * pages/ReportsPage.tsx — Global daily reports list (coordinator only)
 *
 * Shows all daily reports across all classes in a single table, sorted by
 * most recent report date. Clicking a row navigates to that class's detail page
 * (the Daily Reports tab), not to a standalone report view.
 *
 * The API response includes a nested `classes` object (joined server-side) so
 * the table can display the class name and site without additional requests.
 *
 * This page is accessible from the main sidebar navigation under "Reports".
 */

import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../lib/apiClient'
import type { ClassDailyReport } from '../types'
import { classSlug } from '../lib/utils'

/**
 * Extends ClassDailyReport with the joined `classes` object returned by
 * the listAll endpoint (GET /reports).
 */
type ReportRow = ClassDailyReport & { classes: { id: string; name: string; site: string } }

export function ReportsPage() {
  const [reports, setReports] = useState<ReportRow[]>([])
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  useEffect(() => {
    async function load() {
      try {
        const data = await api.reports.listAll()
        // Cast is safe because listAll returns the joined shape (type is widened in apiClient)
        setReports(data as ReportRow[])
      } catch (err) {
        console.error('fetchReports error:', (err as Error).message)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  return (
    <div className="flex flex-col h-full min-h-0">
      <header className="flex-shrink-0">
        <h2 className="text-lg font-semibold text-slate-900">Reports</h2>
        <p className="mt-0.5 text-xs text-slate-500">Daily reports across all active classes</p>
      </header>

      <div className="mt-4 flex-1 min-h-0 overflow-auto">
        {loading ? (
          <p className="text-sm text-slate-500">Loading…</p>
        ) : reports.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-10 text-center">
            <p className="text-sm text-slate-600">No reports found.</p>
            <p className="mt-1 text-xs text-slate-500">Reports appear here once created inside a class.</p>
          </div>
        ) : (
          <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-gw-dark">
                    <th className="px-4 py-3 font-medium text-white">Class</th>
                    <th className="px-4 py-3 font-medium text-white">Date</th>
                    <th className="hidden sm:table-cell px-4 py-3 font-medium text-white">Group</th>
                    <th className="hidden sm:table-cell px-4 py-3 font-medium text-white">Game</th>
                    <th className="hidden md:table-cell px-4 py-3 font-medium text-white">Session</th>
                    <th className="hidden md:table-cell px-4 py-3 font-medium text-white">Trainees</th>
                  </tr>
                </thead>
                <tbody>
                  {reports.map(r => (
                    <tr
                      key={r.id}
                      className="border-b border-slate-100 hover:bg-slate-50 cursor-pointer"
                      onClick={() => navigate(`/classes/${classSlug(r.classes.name)}`)}
                    >
                      <td className="px-4 py-3 font-medium text-gw-dark">{r.classes.name}</td>
                      <td className="px-4 py-3 text-slate-600">{r.report_date}</td>
                      <td className="hidden sm:table-cell px-4 py-3 text-slate-600">{r.group_label ?? '—'}</td>
                      <td className="hidden sm:table-cell px-4 py-3 text-slate-600">{r.game ?? '—'}</td>
                      <td className="hidden md:table-cell px-4 py-3 text-slate-600">{r.session_label ?? '—'}</td>
                      <td className="hidden md:table-cell px-4 py-3 text-slate-600">{r.current_trainees ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
