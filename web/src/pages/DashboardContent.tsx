/**
 * pages/DashboardContent.tsx — Coordinator dashboard overview
 *
 * The main landing page for coordinators after login. Shows live summary
 * cards (active classes with province breakdown, today's sessions count,
 * recent reports count), quick action buttons, alerts for items needing
 * attention, a today's sessions table, and a limited active classes list.
 */

import { useState, useEffect, useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useClasses } from '../contexts/ClassesContext'
import { api } from '../lib/apiClient'
import type { ScheduleRow } from '../lib/apiClient'
import { formatTime, classSlug } from '../lib/utils'
import { SkeletonText, SkeletonTable } from '../components/Skeleton'
import { CreateClassModal } from '../components/CreateClassModal'
import type { Province } from '../types'

const provinceBadge: Record<Province, string> = {
  BC: 'bg-emerald-100 text-emerald-700',
  AB: 'bg-amber-100 text-amber-700',
  ON: 'bg-blue-100 text-blue-700',
}

function toISODate(d: Date) {
  return d.toISOString().slice(0, 10)
}

/** Maximum number of classes shown in the dashboard list */
const MAX_CLASSES_SHOWN = 5

export function DashboardContent() {
  const { email, signOut } = useAuth()
  const { active, loading: classesLoading, refresh: refreshClasses } = useClasses()
  const navigate = useNavigate()

  const [todaySessions, setTodaySessions] = useState<ScheduleRow[]>([])
  const [sessionsLoading, setSessionsLoading] = useState(true)
  const [recentReportsTotal, setRecentReportsTotal] = useState(0)
  const [reportsLoading, setReportsLoading] = useState(true)
  const [createOpen, setCreateOpen] = useState(false)

  // Alerts: track classes with no trainers
  const [classesWithoutTrainers, setClassesWithoutTrainers] = useState<string[]>([])
  const [alertsLoading, setAlertsLoading] = useState(true)

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

  // Check for classes without trainers (lightweight: first 10 active classes)
  useEffect(() => {
    if (classesLoading || active.length === 0) {
      setAlertsLoading(false)
      return
    }
    const classesToCheck = active.slice(0, 10)
    Promise.all(
      classesToCheck.map(async (cls) => {
        try {
          const trainers = await api.trainers.list(cls.id)
          return trainers.length === 0 ? cls.name : null
        } catch {
          return null
        }
      }),
    ).then((results) => {
      setClassesWithoutTrainers(results.filter((n): n is string => n !== null))
      setAlertsLoading(false)
    })
  }, [active, classesLoading])

  // Province breakdown for active classes
  const provinceCounts = active.reduce<Record<string, number>>((acc, c) => {
    acc[c.province] = (acc[c.province] || 0) + 1
    return acc
  }, {})

  // Sort by start_date descending and limit
  const displayedClasses = useMemo(() =>
    [...active]
      .sort((a, b) => b.start_date.localeCompare(a.start_date))
      .slice(0, MAX_CLASSES_SHOWN),
    [active],
  )
  const hiddenCount = Math.max(0, active.length - MAX_CLASSES_SHOWN)

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

      {/* ── Quick actions ─────────────────────────────────────────── */}
      <div className="mt-2 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setCreateOpen(true)}
          className="inline-flex items-center gap-1.5 rounded-lg bg-gw-blue px-3 py-2 text-xs font-medium text-white hover:bg-gw-blue-hover"
        >
          <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 5v14M5 12h14" />
          </svg>
          Create class
        </button>
        <button
          type="button"
          onClick={() => navigate('/reports')}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
        >
          <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8zM14 2v6h6M16 13H8M16 17H8M10 9H8" />
          </svg>
          View reports
        </button>
        <button
          type="button"
          onClick={() => navigate('/schedule')}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
        >
          <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 4H5a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2V6a2 2 0 00-2-2zM16 2v4M8 2v4M3 10h18" />
          </svg>
          View schedule
        </button>
      </div>

      {/* ── Alerts ────────────────────────────────────────────────── */}
      {!alertsLoading && classesWithoutTrainers.length > 0 && (
        <section className="mt-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
          <div className="flex items-start gap-2">
            <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-amber-600 mt-0.5 shrink-0">
              <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0zM12 9v4M12 17h.01" />
            </svg>
            <div>
              <p className="text-xs font-semibold text-amber-800">Needs attention</p>
              <p className="mt-0.5 text-xs text-amber-700">
                {classesWithoutTrainers.length} class{classesWithoutTrainers.length !== 1 ? 'es have' : ' has'} no trainers assigned:{' '}
                {classesWithoutTrainers.map((name, i) => (
                  <span key={name}>
                    {i > 0 && ', '}
                    <Link
                      to={`/classes/${classSlug(name)}`}
                      className="font-medium underline hover:text-amber-900"
                    >
                      {name}
                    </Link>
                  </span>
                ))}
              </p>
            </div>
          </div>
        </section>
      )}

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

      {/* ── Active classes list (limited) ─────────────────────────── */}
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
          <>
            <ul className="divide-y divide-slate-100">
              {displayedClasses.map((cls) => (
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
            {hiddenCount > 0 && (
              <Link
                to="/classes"
                className="mt-2 block text-center text-xs font-medium text-gw-blue hover:underline"
              >
                and {hiddenCount} more →
              </Link>
            )}
          </>
        )}
      </section>

      {createOpen && (
        <CreateClassModal
          onClose={() => setCreateOpen(false)}
          onSuccess={() => {
            setCreateOpen(false)
            refreshClasses()
          }}
        />
      )}
    </>
  )
}
