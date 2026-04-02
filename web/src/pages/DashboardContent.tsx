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
  BC: 'bg-blue-500/15 text-blue-300',
  AB: 'bg-orange-400/15 text-orange-300',
  ON: 'bg-purple-500/15 text-purple-300',
}

function toISODate(d: Date) {
  return d.toISOString().slice(0, 10)
}

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

  const provinceCounts = active.reduce<Record<string, number>>((acc, c) => {
    acc[c.province] = (acc[c.province] || 0) + 1
    return acc
  }, {})

  const displayedClasses = useMemo(() =>
    [...active]
      .sort((a, b) => b.start_date.localeCompare(a.start_date))
      .slice(0, MAX_CLASSES_SHOWN),
    [active],
  )
  const hiddenCount = Math.max(0, active.length - MAX_CLASSES_SHOWN)

  return (
    <>
      {/* Page header */}
      <header className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-100">Dashboard</h2>
          <p className="mt-0.5 text-sm text-slate-300">
            {new Date().toLocaleDateString('en-CA', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
            {!sessionsLoading && (
              <span className="ml-2 text-slate-500">· {todaySessions.length} active session{todaySessions.length !== 1 ? 's' : ''} today</span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="hidden sm:flex flex-col items-end gap-0.5">
            <span className="text-xs uppercase tracking-wide text-slate-500">Coordinator</span>
            <span className="text-xs text-slate-300">{email}</span>
            <button
              type="button"
              className="mt-1 text-gw-blue underline underline-offset-2 hover:text-blue-300 transition-colors duration-150 text-xs"
              onClick={signOut}
            >
              Sign out
            </button>
          </div>
          <button
            type="button"
            onClick={() => setCreateOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-md bg-gradient-to-r from-gw-blue to-gw-teal text-white font-semibold px-4 py-2 text-sm hover:brightness-110 transition-all duration-150"
          >
            <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 5v14M5 12h14" />
            </svg>
            New Class
          </button>
        </div>
      </header>

      {/* ── Stat cards ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Active classes */}
        <section className="bg-gradient-to-br from-gw-blue/20 to-gw-teal/20 border border-gw-blue/25 rounded-[10px] p-4">
          <p className="text-xs uppercase tracking-wide text-slate-500 mb-1">Active classes</p>
          {classesLoading ? (
            <SkeletonText className="h-7 w-16 mt-1" />
          ) : (
            <>
              <p className="text-2xl font-bold text-slate-100">{active.length}</p>
              {Object.keys(provinceCounts).length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {Object.entries(provinceCounts).map(([prov, count]) => (
                    <span
                      key={prov}
                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${provinceBadge[prov as Province] ?? 'bg-white/10 text-slate-400'}`}
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
        <section className="bg-gw-surface rounded-[10px] p-4">
          <p className="text-xs uppercase tracking-wide text-slate-500 mb-1">Today's sessions</p>
          {sessionsLoading ? (
            <SkeletonText className="h-7 w-16 mt-1" />
          ) : (
            <p className="text-2xl font-bold text-slate-100">{todaySessions.length}</p>
          )}
        </section>

        {/* Recent reports */}
        <section className="bg-gw-surface rounded-[10px] p-4">
          <p className="text-xs uppercase tracking-wide text-slate-500 mb-1">Reports (7d)</p>
          {reportsLoading ? (
            <SkeletonText className="h-7 w-16 mt-1" />
          ) : (
            <>
              <p className="text-2xl font-bold text-slate-100">{recentReportsTotal}</p>
              <p className="mt-1 text-xs text-slate-500">in the last 7 days</p>
            </>
          )}
        </section>

        {/* Quick actions */}
        <section className="bg-gw-surface rounded-[10px] p-4 flex flex-col gap-2 justify-center">
          <button
            type="button"
            onClick={() => navigate('/reports')}
            className="flex items-center gap-2 rounded-md bg-gw-surface text-slate-200 border border-white/10 px-3 py-1.5 text-xs font-semibold hover:bg-gw-elevated transition-colors duration-150"
          >
            <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8zM14 2v6h6" /></svg>
            View reports
          </button>
          <button
            type="button"
            onClick={() => navigate('/schedule')}
            className="flex items-center gap-2 rounded-md bg-gw-surface text-slate-200 border border-white/10 px-3 py-1.5 text-xs font-semibold hover:bg-gw-elevated transition-colors duration-150"
          >
            <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 4H5a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2V6a2 2 0 00-2-2zM16 2v4M8 2v4M3 10h18" /></svg>
            View schedule
          </button>
        </section>
      </div>

      {/* ── Alerts ─────────────────────────────────────────────────── */}
      {!alertsLoading && classesWithoutTrainers.length > 0 && (
        <section className="rounded-[10px] border border-amber-500/25 bg-amber-500/10 px-4 py-3">
          <div className="flex items-start gap-2">
            <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-amber-400 mt-0.5 shrink-0">
              <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0zM12 9v4M12 17h.01" />
            </svg>
            <div>
              <p className="text-xs font-semibold text-amber-300">Needs attention</p>
              <p className="mt-0.5 text-xs text-amber-400/80">
                {classesWithoutTrainers.length} class{classesWithoutTrainers.length !== 1 ? 'es have' : ' has'} no trainers assigned:{' '}
                {classesWithoutTrainers.map((name, i) => (
                  <span key={name}>
                    {i > 0 && ', '}
                    <Link
                      to={`/classes/${classSlug(name)}`}
                      className="font-medium underline hover:text-amber-200"
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

      {/* ── Bottom two-col section ──────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Today's sessions table — 2/3 width */}
        <section className="md:col-span-2 bg-gw-surface rounded-[10px] overflow-hidden">
          <div className="px-4 py-3 border-b border-white/[0.06]">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">Today's sessions</h3>
          </div>
          {sessionsLoading ? (
            <div className="p-4"><SkeletonTable rows={3} cols={4} /></div>
          ) : todaySessions.length === 0 ? (
            <p className="px-4 py-6 text-sm text-slate-500">No sessions scheduled for today.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-white/[0.02] border-b border-white/[0.06]">
                    <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Class</th>
                    <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Time</th>
                    <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Trainer</th>
                    <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Group</th>
                  </tr>
                </thead>
                <tbody>
                  {todaySessions.map((slot) => (
                    <tr
                      key={slot.id}
                      className="border-b border-white/[0.03] cursor-pointer hover:bg-gw-elevated transition-colors duration-100"
                      onClick={() => navigate(`/classes/${classSlug(slot.classes.name)}`)}
                    >
                      <td className="px-4 py-2.5 font-medium text-slate-200">{slot.classes.name}</td>
                      <td className="px-4 py-2.5 text-slate-400">{formatTime(slot.start_time)} – {formatTime(slot.end_time)}</td>
                      <td className="px-4 py-2.5 text-slate-400">{slot.class_trainers?.trainer_name ?? '—'}</td>
                      <td className="px-4 py-2.5 text-slate-400">{slot.group_label || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* Active classes list — 1/3 width */}
        <section className="bg-gw-surface rounded-[10px] overflow-hidden">
          <div className="px-4 py-3 border-b border-white/[0.06] flex items-center justify-between">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">Active classes</h3>
            <Link to="/classes" className="text-xs font-medium text-gw-blue hover:text-blue-300 transition-colors">
              View all
            </Link>
          </div>
          {classesLoading ? (
            <div className="p-4 space-y-2">
              <SkeletonText className="h-4 w-2/3" />
              <SkeletonText className="h-4 w-1/2" />
              <SkeletonText className="h-4 w-3/4" />
            </div>
          ) : active.length === 0 ? (
            <p className="px-4 py-6 text-sm text-slate-500">No active classes.</p>
          ) : (
            <>
              <ul>
                {displayedClasses.map((cls) => (
                  <li
                    key={cls.id}
                    className="flex items-center justify-between gap-2 px-4 py-2.5 border-b border-white/[0.03] cursor-pointer hover:bg-gw-elevated transition-colors duration-100"
                    onClick={() => navigate(`/classes/${classSlug(cls.name)}`)}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-xs font-medium text-slate-200 truncate">{cls.name}</span>
                      <span
                        className={`inline-flex shrink-0 items-center rounded-full px-1.5 py-0.5 text-[10px] font-medium ${provinceBadge[cls.province] ?? 'bg-white/10 text-slate-400'}`}
                      >
                        {cls.province}
                      </span>
                    </div>
                    <span className="shrink-0 text-[11px] text-slate-500">{cls.start_date}</span>
                  </li>
                ))}
              </ul>
              {hiddenCount > 0 && (
                <Link
                  to="/classes"
                  className="block px-4 py-2.5 text-center text-xs font-medium text-gw-blue hover:text-blue-300 transition-colors"
                >
                  and {hiddenCount} more →
                </Link>
              )}
            </>
          )}
        </section>
      </div>

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
