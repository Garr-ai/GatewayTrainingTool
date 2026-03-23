/**
 * pages/ClassDetail/ClassOverviewSection.tsx — Class overview summary tab
 *
 * The first tab shown when opening a class detail page. Displays the core
 * class metadata in a three-column card grid:
 *   1. Class details — name, site, province, game type, and date range
 *   2. Trainers — assigned trainers with role badges
 *   3. Students & schedule — enrolled count, next session, reports, and hours
 *
 * All data comes from ClassDetailContext (shared cache) — no local fetching.
 */

import { useMemo } from 'react'
import type { Class } from '../../types'
import { useClassDetail } from '../../contexts/ClassDetailContext'
import { formatTime } from '../../lib/utils'
import { SkeletonText } from '../../components/Skeleton'

interface ClassOverviewSectionProps {
  classData: Class
}

export function ClassOverviewSection({ classData }: ClassOverviewSectionProps) {
  const { trainers, enrollments, schedule, reports, hours, loading } = useClassDetail()

  const enrolledCount = enrollments.filter((e) => e.status === 'enrolled').length

  const today = new Date().toISOString().slice(0, 10)
  const nextSession = useMemo(() =>
    schedule
      .filter((s) => s.slot_date >= today)
      .sort((a, b) =>
        a.slot_date === b.slot_date
          ? a.start_time.localeCompare(b.start_time)
          : a.slot_date.localeCompare(b.slot_date),
      )[0] ?? null,
    [schedule, today],
  )

  const totalHours = hours.reduce((sum, h) => sum + h.hours, 0)

  return (
    <section className="grid grid-cols-1 md:grid-cols-3 gap-3">
      {/* Class details card */}
      <div className="rounded-xl bg-white p-4 shadow-sm">
        <h3 className="text-sm font-semibold text-slate-900 mb-1">Class details</h3>
        <dl className="space-y-1 text-xs text-slate-600">
          <div>
            <dt className="font-medium text-slate-700">Name</dt>
            <dd>{classData.name}</dd>
          </div>
          <div>
            <dt className="font-medium text-slate-700">Site</dt>
            <dd>{classData.site}</dd>
          </div>
          <div>
            <dt className="font-medium text-slate-700">Province</dt>
            <dd>{classData.province}</dd>
          </div>
          <div>
            <dt className="font-medium text-slate-700">Game type</dt>
            <dd>{classData.game_type ?? 'Not set'}</dd>
          </div>
          <div>
            <dt className="font-medium text-slate-700">Dates</dt>
            <dd>
              {classData.start_date} – {classData.end_date}
            </dd>
          </div>
        </dl>
      </div>

      {/* Trainers card */}
      <div className="rounded-xl bg-white p-4 shadow-sm">
        <h3 className="text-sm font-semibold text-slate-900 mb-1">Trainers</h3>
        {loading ? (
          <div className="space-y-2"><SkeletonText className="w-1/2" /><SkeletonText className="w-3/4" /><SkeletonText className="w-2/3" /></div>
        ) : trainers.length === 0 ? (
          <p className="text-xs text-slate-500">No trainers assigned.</p>
        ) : (
          <>
            <p className="text-xs text-slate-500 mb-2">
              {trainers.length} trainer{trainers.length !== 1 ? 's' : ''}
            </p>
            <ul className="space-y-1">
              {trainers.map((t) => (
                <li key={t.id} className="flex items-center gap-2 text-xs text-slate-700">
                  <span>{t.trainer_name}</span>
                  <span
                    className={
                      'inline-block rounded-full px-1.5 py-0.5 text-[10px] font-medium ' +
                      (t.role === 'primary'
                        ? 'bg-blue-100 text-blue-700'
                        : 'bg-slate-100 text-slate-600')
                    }
                  >
                    {t.role}
                  </span>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>

      {/* Students & schedule card */}
      <div className="rounded-xl bg-white p-4 shadow-sm">
        <h3 className="text-sm font-semibold text-slate-900 mb-1">Students & schedule</h3>
        {loading ? (
          <div className="space-y-2"><SkeletonText className="w-1/2" /><SkeletonText className="w-3/4" /><SkeletonText className="w-2/3" /></div>
        ) : (
          <dl className="space-y-1 text-xs text-slate-600">
            <div>
              <dt className="font-medium text-slate-700">Enrolled students</dt>
              <dd>{enrolledCount}</dd>
            </div>
            <div>
              <dt className="font-medium text-slate-700">Next session</dt>
              <dd>
                {nextSession
                  ? `${nextSession.slot_date} ${formatTime(nextSession.start_time)} – ${formatTime(nextSession.end_time)}`
                  : 'No upcoming sessions'}
              </dd>
            </div>
            <div>
              <dt className="font-medium text-slate-700">Total reports</dt>
              <dd>{reports.length}</dd>
            </div>
            <div>
              <dt className="font-medium text-slate-700">Total logged hours</dt>
              <dd>{totalHours}</dd>
            </div>
          </dl>
        )}
      </div>
    </section>
  )
}
