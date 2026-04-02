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
import { EmptyState } from '../components/EmptyState'
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
      <div className="bg-gw-surface rounded-[10px]">
        <EmptyState title="Something went wrong" description={error} variant="neutral" />
      </div>
    )
  }

  const name = data?.trainer_name ?? email
  const classes = data?.classes ?? []

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h2 className="text-xl font-bold text-slate-100">Welcome back, {name}</h2>
        <p className="mt-0.5 text-sm text-slate-400">{email}</p>
      </header>

      <section>
        <h3 className="text-sm font-semibold text-slate-200 mb-3">
          Your Classes
          {classes.length > 0 && (
            <span className="ml-1.5 text-xs font-normal text-slate-500">({classes.length})</span>
          )}
        </h3>
        {classes.length === 0 ? (
          <div className="bg-gw-surface rounded-[10px]">
            <EmptyState
              title="No classes assigned"
              description="You are not currently assigned to any classes."
              variant="neutral"
            />
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {classes.map(cls => (
              <div key={cls.class_id} className={`rounded-[10px] border bg-gw-surface p-4 flex flex-col gap-3 ${cls.archived ? 'opacity-60 border-white/[0.04]' : 'border-white/[0.08]'}`}>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold text-slate-200">{cls.class_name}</p>
                    <p className="text-xs text-slate-500">{cls.site} · {cls.province}</p>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${
                      cls.trainer_role === 'primary'
                        ? 'bg-gw-blue/20 text-gw-blue'
                        : 'bg-white/[0.06] text-slate-400'
                    }`}>
                      {cls.trainer_role}
                    </span>
                    {cls.archived && (
                      <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-white/[0.06] text-slate-500">archived</span>
                    )}
                  </div>
                </div>

                <div className="flex gap-4 text-xs text-slate-400">
                  {cls.game_type && (
                    <span className="flex items-center gap-1">
                      <span className="font-medium text-slate-300">Game:</span> {cls.game_type}
                    </span>
                  )}
                  <span className="flex items-center gap-1">
                    <span className="font-medium text-slate-300">Students:</span> {cls.enrolled_count}
                  </span>
                </div>

                {cls.start_date && (
                  <p className="text-xs text-slate-500">
                    {cls.start_date} → {cls.end_date ?? 'TBD'}
                  </p>
                )}

                {cls.upcoming_slots.length > 0 && (
                  <div>
                    <p className="text-[11px] font-medium text-slate-400 mb-1">Upcoming</p>
                    <div className="flex flex-col gap-1">
                      {cls.upcoming_slots.map(slot => (
                        <div key={slot.id} className="flex items-center gap-2 text-[11px] text-slate-400 bg-gw-elevated rounded px-2 py-1">
                          <span className="font-medium whitespace-nowrap text-slate-300">{slot.slot_date}</span>
                          <span>{slot.start_time}–{slot.end_time}</span>
                          {slot.group_label && (
                            <span className="ml-auto text-[10px] bg-white/[0.06] border border-white/[0.08] rounded px-1 text-slate-500">
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
