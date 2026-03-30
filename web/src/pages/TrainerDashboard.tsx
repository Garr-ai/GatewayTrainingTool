/**
 * pages/TrainerDashboard.tsx — Self-service dashboard for trainers
 *
 * Shown when a trainer logs in (dispatched from DashboardView based on role).
 * Fetches GET /me/trainer-dashboard using the current user's JWT — no email
 * parameter needed; the backend resolves identity from the token.
 *
 * Displays:
 *   - A welcome header with the trainer's name
 *   - Cards for each assigned class showing: class name, site/province, game type,
 *     trainer role, enrolled student count, and up to 3 upcoming schedule slots
 */

import { useState, useEffect } from 'react'
import { api } from '../lib/apiClient'
import { SkeletonCard } from '../components/Skeleton'
import type { TrainerDashboardResponse } from '../types'

export function TrainerDashboard({ email }: { email: string }) {
  const [data, setData] = useState<TrainerDashboardResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    api.selfService
      .trainerDashboard()
      .then(setData)
      .catch(err => setError((err as Error).message))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="flex flex-col gap-4">
        <SkeletonCard lines={2} />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => <SkeletonCard key={i} lines={4} />)}
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-10 text-center">
        <p className="text-sm text-slate-600">{error}</p>
      </div>
    )
  }

  const name = data?.trainer_name ?? email
  const classes = data?.classes ?? []

  return (
    <div className="flex flex-col gap-6">
      {/* Welcome header */}
      <header>
        <h2 className="text-lg font-semibold text-slate-900">Welcome back, {name}</h2>
        <p className="mt-0.5 text-xs text-slate-500">{email}</p>
      </header>

      {/* Classes */}
      <section>
        <h3 className="text-sm font-semibold text-slate-700 mb-3">
          Your Classes
          {classes.length > 0 && (
            <span className="ml-1.5 text-xs font-normal text-slate-400">({classes.length})</span>
          )}
        </h3>
        {classes.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-10 text-center">
            <p className="text-sm text-slate-600">You are not currently assigned to any classes.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {classes.map(cls => (
              <div key={cls.class_id} className={`rounded-xl border bg-white p-4 flex flex-col gap-3 ${cls.archived ? 'opacity-60' : 'border-slate-200'}`}>
                {/* Class header */}
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold text-gw-dark">{cls.class_name}</p>
                    <p className="text-xs text-slate-500">{cls.site} · {cls.province}</p>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${
                      cls.trainer_role === 'primary'
                        ? 'bg-gw-dark text-white'
                        : 'bg-slate-100 text-slate-600'
                    }`}>
                      {cls.trainer_role}
                    </span>
                    {cls.archived && (
                      <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-slate-100 text-slate-500">archived</span>
                    )}
                  </div>
                </div>

                {/* Stats row */}
                <div className="flex gap-4 text-xs text-slate-600">
                  {cls.game_type && (
                    <span className="flex items-center gap-1">
                      <span className="font-medium">Game:</span> {cls.game_type}
                    </span>
                  )}
                  <span className="flex items-center gap-1">
                    <span className="font-medium">Students:</span> {cls.enrolled_count}
                  </span>
                </div>

                {/* Dates */}
                {cls.start_date && (
                  <p className="text-xs text-slate-500">
                    {cls.start_date} → {cls.end_date ?? 'TBD'}
                  </p>
                )}

                {/* Upcoming schedule */}
                {cls.upcoming_slots.length > 0 && (
                  <div>
                    <p className="text-[11px] font-medium text-slate-700 mb-1">Upcoming</p>
                    <div className="flex flex-col gap-1">
                      {cls.upcoming_slots.map(slot => (
                        <div key={slot.id} className="flex items-center gap-2 text-[11px] text-slate-600 bg-slate-50 rounded px-2 py-1">
                          <span className="font-medium whitespace-nowrap">{slot.slot_date}</span>
                          <span>{slot.start_time}–{slot.end_time}</span>
                          {slot.group_label && (
                            <span className="ml-auto text-[10px] bg-white border border-slate-200 rounded px-1">
                              Grp {slot.group_label}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
