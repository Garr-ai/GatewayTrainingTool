/**
 * pages/TrainerDashboard.tsx — Self-service dashboard for trainers
 *
 * Shown when a trainer logs in (dispatched from DashboardView based on role).
 * Reads data from TrainerContext (mounted by ConditionalTrainerProvider at the
 * layout level) — no additional fetch needed.
 *
 * Displays:
 *   - A welcome header with the trainer's name
 *   - Summary stat tiles (active classes, students, hours, upcoming sessions)
 *   - A consolidated upcoming sessions list across all active classes
 *   - Clickable cards for each assigned class
 */

import { Link } from 'react-router-dom'
import { useTrainer } from '../contexts/TrainerContext'
import { SkeletonCard } from '../components/Skeleton'
import { EmptyState } from '../components/EmptyState'
import type { TrainerMyClassesResponse, UpcomingSlot } from '../types'

export function TrainerDashboard({ email }: { email: string }) {
  const { trainerName, trainerEmail, classes, loading } = useTrainer()

  if (loading) {
    return (
      <div className="flex flex-col gap-6">
        <SkeletonCard lines={2} />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[...Array(4)].map((_, i) => <SkeletonCard key={i} lines={1} />)}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => <SkeletonCard key={i} lines={4} />)}
        </div>
      </div>
    )
  }

  const name = trainerName ?? (trainerEmail || email)
  const activeClasses = classes.filter(c => !c.archived)
  const archivedClasses = classes.filter(c => c.archived)

  const totalStudents = activeClasses.reduce((sum, c) => sum + c.enrolled_count, 0)
  const totalHours = classes.reduce((sum, c) => sum + c.total_hours, 0)

  // Flatten all upcoming slots across active classes, sorted chronologically
  const today = new Date().toISOString().slice(0, 10)
  const upcomingSessions: Array<UpcomingSlot & { class_id: string; class_name: string }> = activeClasses
    .flatMap(c => c.upcoming_slots.map(s => ({ ...s, class_id: c.class_id, class_name: c.class_name })))
    .filter(s => s.slot_date >= today)
    .sort((a, b) => a.slot_date.localeCompare(b.slot_date) || a.start_time.localeCompare(b.start_time))

  // Sessions within the next 7 days
  const weekEnd = new Date()
  weekEnd.setDate(weekEnd.getDate() + 7)
  const weekEndStr = weekEnd.toISOString().slice(0, 10)
  const sessionsThisWeek = upcomingSessions.filter(s => s.slot_date <= weekEndStr).length

  const stats = [
    { label: 'Active classes', value: String(activeClasses.length) },
    { label: 'Total students', value: String(totalStudents) },
    { label: 'Hours logged', value: `${totalHours}h` },
    { label: 'Sessions this week', value: String(sessionsThisWeek) },
  ]

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h2 className="text-xl font-bold text-slate-100">Welcome back, {name}</h2>
        <p className="mt-0.5 text-sm text-slate-400">{email}</p>
      </header>

      {/* Summary stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {stats.map(({ label, value }) => (
          <div key={label} className="bg-gw-surface rounded-[10px] border border-white/[0.06] px-4 py-3">
            <p className="text-[11px] text-slate-500 uppercase tracking-wide font-medium">{label}</p>
            <p className="mt-1 text-2xl font-bold text-slate-100">{value}</p>
          </div>
        ))}
      </div>

      {/* Consolidated upcoming sessions */}
      {upcomingSessions.length > 0 && (
        <section>
          <h3 className="text-sm font-semibold text-slate-200 mb-3">Upcoming Sessions</h3>
          <div className="bg-gw-surface rounded-[10px] border border-white/[0.06] divide-y divide-white/[0.04]">
            {upcomingSessions.slice(0, 8).map(slot => (
              <Link
                key={slot.id}
                to={`/my-classes/${slot.class_id}`}
                className="flex items-center gap-3 px-4 py-2.5 hover:bg-gw-elevated transition-colors"
              >
                <div className="text-center min-w-[44px]">
                  <p className="text-[10px] text-slate-500 uppercase">{new Date(slot.slot_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short' })}</p>
                  <p className="text-base font-bold text-slate-200 leading-tight">{new Date(slot.slot_date + 'T00:00:00').getDate()}</p>
                </div>
                <div className="w-px self-stretch bg-white/[0.06]" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-200 truncate">{slot.class_name}</p>
                  <p className="text-xs text-slate-500">{slot.start_time}–{slot.end_time}</p>
                </div>
                {slot.group_label && (
                  <span className="text-[10px] bg-white/[0.06] border border-white/[0.08] rounded px-1.5 py-0.5 text-slate-500 shrink-0">
                    Grp {slot.group_label}
                  </span>
                )}
                <svg className="w-3.5 h-3.5 text-slate-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Your Classes */}
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
          <div className="flex flex-col gap-4">
            {activeClasses.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {activeClasses.map(cls => <ClassCard key={cls.class_id} cls={cls} />)}
              </div>
            )}
            {archivedClasses.length > 0 && (
              <>
                <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Archived</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {archivedClasses.map(cls => <ClassCard key={cls.class_id} cls={cls} />)}
                </div>
              </>
            )}
          </div>
        )}
      </section>
    </div>
  )
}

function ClassCard({ cls }: { cls: TrainerMyClassesResponse['classes'][0] }) {
  const nextSlot = cls.upcoming_slots[0]
  return (
    <Link
      to={`/my-classes/${cls.class_id}`}
      className={`rounded-[10px] border bg-gw-surface p-4 flex flex-col gap-3 hover:border-gw-blue/30 transition-colors duration-150 ${
        cls.archived ? 'opacity-60 border-white/[0.04]' : 'border-white/[0.08]'
      }`}
    >
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

      <div className="flex flex-wrap gap-3 text-xs text-slate-400">
        {cls.game_type && (
          <span><span className="font-medium text-slate-300">Game:</span> {cls.game_type}</span>
        )}
        <span><span className="font-medium text-slate-300">Students:</span> {cls.enrolled_count}</span>
        <span><span className="font-medium text-slate-300">Hours:</span> {cls.total_hours}h</span>
      </div>

      {cls.start_date && (
        <p className="text-xs text-slate-500">
          {cls.start_date} → {cls.end_date ?? 'TBD'}
        </p>
      )}

      {nextSlot && (
        <div className="flex items-center gap-2 text-[11px] text-slate-400 bg-gw-elevated rounded px-2 py-1">
          <span className="font-medium whitespace-nowrap text-slate-300">{nextSlot.slot_date}</span>
          <span>{nextSlot.start_time}–{nextSlot.end_time}</span>
          {nextSlot.group_label && (
            <span className="ml-auto text-[10px] bg-white/[0.06] border border-white/[0.08] rounded px-1 text-slate-500">
              Grp {nextSlot.group_label}
            </span>
          )}
        </div>
      )}
    </Link>
  )
}
