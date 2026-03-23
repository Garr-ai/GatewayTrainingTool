/**
 * pages/DashboardContent.tsx — Coordinator dashboard overview
 *
 * The main landing page for coordinators after login. Shows live summary
 * cards (active classes with province breakdown, today's sessions count,
 * recent reports count), a today's sessions table, and an active classes list.
 */

import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useClasses } from '../contexts/ClassesContext'
import { api } from '../lib/apiClient'
import type { ScheduleRow } from '../lib/apiClient'
import { formatTime, classSlug } from '../lib/utils'
import { SkeletonText, SkeletonTable } from '../components/Skeleton'
import type { Province } from '../types'

const provinceBadge: Record<Province, string> = {
  BC: 'bg-emerald-100 text-emerald-700',
  AB: 'bg-amber-100 text-amber-700',
  ON: 'bg-blue-100 text-blue-700',
}

function toISODate(d: Date) {
  return d.toISOString().slice(0, 10)
}

export function DashboardContent() {
  const { email, signOut } = useAuth()
  const { active, loading: classesLoading } = useClasses()
  const navigate = useNavigate()

  const [todaySessions, setTodaySessions] = useState<ScheduleRow[]>([])
  const [sessionsLoading, setSessionsLoading] = useState(true)
  const [recentReportsTotal, setRecentReportsTotal] = useState(0)
  const [reportsLoading, setReportsLoading] = useState(true)

  useEffect(() => {
    const today = toISODate(new Date())
    const sevenDaysAgo = toISODate(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000))

    api.schedule
      .listAll({ date_from: today, date_to: today, limit: 200 })
      .then((res) => setTodaySessions(res.data))
      .catch(() => setTodaySessions([]))
      .finally(() => setSessionsLoading(false))

    api.reports
      .listAll({ date_from: sevenDaysAgo, limit: 1 })
      .then((res) => setRecentReportsTotal(res.total))
      .catch(() => setRecentReportsTotal(0))
      .finally(() => setReportsLoading(false))
  }, [])

  // Province breakdown for active classes
  const provinceCounts = active.reduce<Record<string, number>>((acc, c) => {
    acc[c.province] = (acc[c.province] || 0) + 1
    return acc
  }, {})

  return (
    <>
      <header className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Dashboard</h2>
          <p className="mt-0.5 text-xs text-slate-500">Coordinator overview</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex flex-col items-end gap-1">
            <span className="text-[10px] font-semibold tracking-[0.16em] uppercase text-slate-500">Coordinator</span>
            <span className="text-xs text-slate-800">{email}</span>
            <button
              type="button"
              className="mt-1 inline-flex items-center rounded-md border border-slate-300 px-2 py-1 text-[11px] text-slate-700 hover:border-slate-400"
              onClick={signOut}
            >
              Sign out
            </button>
          </div>
        </div>
      </header>

      {/* ── Summary cards ─────────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {/* Active classes */}
        <section className="rounded-xl bg-white p-4 shadow-sm min-h-[110px]">
          <h3 className="text-sm font-semibold text-slate-900 mb-2">Active classes</h3>
          {classesLoading ? (
            <SkeletonText className="h-6 w-16 mt-1" />
          ) : (
            <>
              <p className="text-2xl font-bold text-gw-dark">{active.length}</p>
              {Object.keys(provinceCounts).length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {Object.entries(provinceCounts).map(([prov, count]) => (
                    <span
                      key={prov}
                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${provinceBadge[prov as Province] ?? 'bg-slate-100 text-slate-600'}`}
                    >
                      {prov}: {count}
                    </span>
                  ))}
                </div>
              )}
            </>
          )}
        </section>

        {/* Today's sessions */}
        <section className="rounded-xl bg-white p-4 shadow-sm min-h-[110px]">
          <h3 className="text-sm font-semibold text-slate-900 mb-2">Today&apos;s sessions</h3>
          {sessionsLoading ? (
            <SkeletonText className="h-6 w-16 mt-1" />
          ) : (
            <p className="text-2xl font-bold text-gw-dark">{todaySessions.length}</p>
          )}
        </section>

        {/* Recent reports */}
        <section className="rounded-xl bg-white p-4 shadow-sm min-h-[110px]">
          <h3 className="text-sm font-semibold text-slate-900 mb-2">Recent reports</h3>
          {reportsLoading ? (
            <SkeletonText className="h-6 w-16 mt-1" />
          ) : (
            <>
              <p className="text-2xl font-bold text-gw-dark">{recentReportsTotal}</p>
              <p className="mt-1 text-[11px] text-slate-500">in the last 7 days</p>
            </>
          )}
        </section>
      </div>

      {/* ── Today's sessions table ────────────────────────────────── */}
      <section className="mt-2 rounded-xl bg-white p-4 shadow-sm">
        <h3 className="text-sm font-semibold text-slate-900 mb-2">Today&apos;s sessions</h3>
        {sessionsLoading ? (
          <SkeletonTable rows={3} cols={4} />
        ) : todaySessions.length === 0 ? (
          <p className="text-xs text-slate-500">No sessions scheduled for today.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-slate-200 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                  <th className="pb-2 pr-4">Class</th>
                  <th className="pb-2 pr-4">Time</th>
                  <th className="pb-2 pr-4">Trainer</th>
                  <th className="pb-2">Group</th>
                </tr>
              </thead>
              <tbody>
                {todaySessions.map((slot) => (
                  <tr
                    key={slot.id}
                    className="border-b border-slate-100 last:border-0 cursor-pointer hover:bg-slate-50 transition-colors"
                    onClick={() => navigate(`/classes/${classSlug(slot.classes.name)}`)}
                  >
                    <td className="py-2 pr-4 font-medium text-gw-dark">{slot.classes.name}</td>
                    <td className="py-2 pr-4 text-slate-600">
                      {formatTime(slot.start_time)} – {formatTime(slot.end_time)}
                    </td>
                    <td className="py-2 pr-4 text-slate-600">
                      {slot.class_trainers?.trainer_name ?? '—'}
                    </td>
                    <td className="py-2 text-slate-600">{slot.group_label || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* ── Active classes list ────────────────────────────────────── */}
      <section className="mt-2 rounded-xl bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-semibold text-slate-900">Active classes</h3>
          <Link to="/classes" className="text-xs font-medium text-gw-blue hover:underline">
            View all
          </Link>
        </div>
        {classesLoading ? (
          <div className="space-y-2">
            <SkeletonText className="h-4 w-2/3" />
            <SkeletonText className="h-4 w-1/2" />
            <SkeletonText className="h-4 w-3/4" />
          </div>
        ) : active.length === 0 ? (
          <p className="text-xs text-slate-500">No active classes.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {active.map((cls) => (
              <li
                key={cls.id}
                className="flex items-center justify-between gap-3 py-2 cursor-pointer hover:bg-slate-50 rounded-md px-1 transition-colors"
                onClick={() => navigate(`/classes/${classSlug(cls.name)}`)}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-xs font-medium text-gw-dark truncate">{cls.name}</span>
                  <span className="text-[11px] text-slate-500 truncate">{cls.site}</span>
                  <span
                    className={`inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${provinceBadge[cls.province] ?? 'bg-slate-100 text-slate-600'}`}
                  >
                    {cls.province}
                  </span>
                </div>
                <span className="shrink-0 text-[11px] text-slate-400">
                  {cls.start_date} – {cls.end_date}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  )
}
