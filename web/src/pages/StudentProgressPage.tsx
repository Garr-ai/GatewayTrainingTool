import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { api } from '../lib/apiClient'
import { SkeletonTable, SkeletonCard } from '../components/Skeleton'
import type { StudentProgressResponse, DailyRating } from '../types'

const RATING_COLOR: Record<DailyRating, string> = {
  EE: 'bg-emerald-100 text-emerald-700',
  ME: 'bg-blue-100 text-blue-700',
  AD: 'bg-amber-100 text-amber-700',
  NI: 'bg-rose-100 text-rose-700',
}

function RatingBadge({ rating }: { rating: DailyRating | null }) {
  if (!rating) return <span className="text-slate-400">—</span>
  return (
    <span className={`inline-block text-[10px] font-medium px-1.5 py-0.5 rounded ${RATING_COLOR[rating]}`}>
      {rating}
    </span>
  )
}

export function StudentProgressPage() {
  const { email } = useParams()
  const [data, setData] = useState<StudentProgressResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!email) return
    setLoading(true)
    api.studentProgress
      .get(decodeURIComponent(email))
      .then(setData)
      .catch(err => setError((err as Error).message))
      .finally(() => setLoading(false))
  }, [email])

  if (loading) {
    return (
      <div className="flex flex-col gap-4">
        <SkeletonCard lines={3} />
        <SkeletonTable rows={5} cols={5} />
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-10 text-center">
        <p className="text-sm text-slate-600">{error ?? 'Student not found.'}</p>
        <Link to="/students" className="mt-2 text-xs text-gw-dark hover:underline">Back to Students</Link>
      </div>
    )
  }

  // Group drill times by drill name
  const drillGroups = new Map<string, typeof data.drill_times>()
  for (const dt of data.drill_times) {
    const key = dt.drill_name
    if (!drillGroups.has(key)) drillGroups.set(key, [])
    drillGroups.get(key)!.push(dt)
  }

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Header */}
      <header className="flex-shrink-0">
        <Link to="/students" className="text-xs text-gw-blue hover:underline">&larr; Back to Students</Link>
        <h2 className="mt-1 text-lg font-semibold text-slate-900">{data.student_name}</h2>
        <p className="mt-0.5 text-xs text-slate-500">{data.student_email}</p>
      </header>

      <div className="mt-4 flex-1 min-h-0 overflow-auto flex flex-col gap-6">
        {/* Enrolled Classes */}
        <section>
          <h3 className="text-sm font-semibold text-slate-800 mb-2">Enrolled Classes</h3>
          <div className="flex flex-wrap gap-2">
            {data.classes.map(c => (
              <div key={c.enrollment_id} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm">
                <span className="font-medium text-gw-dark">{c.class_name}</span>
                <span className={`ml-2 inline-block text-[10px] font-medium px-1.5 py-0.5 rounded ${
                  c.status === 'enrolled' ? 'bg-emerald-100 text-emerald-700' :
                  c.status === 'waitlist' ? 'bg-amber-100 text-amber-700' :
                  'bg-slate-100 text-slate-600'
                }`}>
                  {c.status}
                </span>
                {c.group_label && <span className="ml-1.5 text-xs text-slate-500">Group {c.group_label}</span>}
              </div>
            ))}
          </div>
        </section>

        {/* Progress Ratings */}
        <section>
          <h3 className="text-sm font-semibold text-slate-800 mb-2">
            Progress Ratings
            {data.progress.length > 0 && <span className="ml-1.5 text-xs font-normal text-slate-400">({data.progress.length} reports)</span>}
          </h3>
          {data.progress.length === 0 ? (
            <p className="text-xs text-slate-500">No progress data recorded yet.</p>
          ) : (
            <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 bg-gw-dark">
                      <th className="px-4 py-3 font-medium text-white">Date</th>
                      <th className="px-4 py-3 font-medium text-white hidden sm:table-cell">Class</th>
                      <th className="px-4 py-3 font-medium text-white hidden md:table-cell">Session</th>
                      <th className="px-4 py-3 font-medium text-white text-center">GK</th>
                      <th className="px-4 py-3 font-medium text-white text-center">DEX</th>
                      <th className="px-4 py-3 font-medium text-white text-center">HOM</th>
                      <th className="px-4 py-3 font-medium text-white hidden lg:table-cell">Notes</th>
                      <th className="px-4 py-3 font-medium text-white text-center hidden md:table-cell">Attended</th>
                      <th className="px-4 py-3 font-medium text-white text-center hidden md:table-cell">HW</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.progress.map((p, i) => (
                      <tr key={i} className="border-b border-slate-100">
                        <td className="px-4 py-3 text-slate-600 whitespace-nowrap">{p.report_date}</td>
                        <td className="px-4 py-3 text-slate-600 truncate hidden sm:table-cell">{p.class_name}</td>
                        <td className="px-4 py-3 text-slate-600 truncate hidden md:table-cell">{p.session_label ?? '—'}</td>
                        <td className="px-4 py-3 text-center"><RatingBadge rating={p.gk_rating} /></td>
                        <td className="px-4 py-3 text-center"><RatingBadge rating={p.dex_rating} /></td>
                        <td className="px-4 py-3 text-center"><RatingBadge rating={p.hom_rating} /></td>
                        <td className="px-4 py-3 text-slate-500 text-xs truncate max-w-[200px] hidden lg:table-cell">{p.progress_text ?? '—'}</td>
                        <td className="px-4 py-3 text-center hidden md:table-cell">
                          {p.attendance ? (
                            <svg className="w-4 h-4 text-emerald-500 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                            </svg>
                          ) : (
                            <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-rose-100 text-rose-700">Absent</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center hidden md:table-cell">
                          {p.homework_completed ? (
                            <svg className="w-4 h-4 text-emerald-500 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                            </svg>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </section>

        {/* Drill Times */}
        {drillGroups.size > 0 && (
          <section>
            <h3 className="text-sm font-semibold text-slate-800 mb-2">Drill & Test Results</h3>
            <div className="flex flex-col gap-3">
              {[...drillGroups.entries()].map(([drillName, times]) => {
                const first = times[0]
                const isDrill = first.drill_type === 'drill'
                return (
                  <div key={drillName} className="rounded-xl border border-slate-200 bg-white p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="font-medium text-sm text-gw-dark">{drillName}</span>
                      <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${isDrill ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'}`}>
                        {first.drill_type}
                      </span>
                      {isDrill && first.par_time_seconds && (
                        <span className="text-xs text-slate-500">Par: {first.par_time_seconds}s</span>
                      )}
                      {!isDrill && first.target_score && (
                        <span className="text-xs text-slate-500">Target: {first.target_score}</span>
                      )}
                    </div>
                    <div className="overflow-x-auto">
                      <table className="text-sm">
                        <thead>
                          <tr className="text-xs text-slate-500">
                            <th className="pr-4 py-1 text-left font-medium">Date</th>
                            <th className="pr-4 py-1 text-left font-medium">Class</th>
                            <th className="pr-4 py-1 text-right font-medium">{isDrill ? 'Time (s)' : 'Score'}</th>
                            <th className="pr-4 py-1 text-center font-medium">Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {times.map((t, i) => {
                            const value = isDrill ? t.time_seconds : t.score
                            const target = isDrill ? t.par_time_seconds : t.target_score
                            const met = value != null && target != null
                              ? (isDrill ? value <= target : value >= target)
                              : null
                            return (
                              <tr key={i} className="border-t border-slate-100">
                                <td className="pr-4 py-1.5 text-slate-600 whitespace-nowrap">{t.report_date}</td>
                                <td className="pr-4 py-1.5 text-slate-600">{t.class_name}</td>
                                <td className="pr-4 py-1.5 text-right text-slate-700 font-medium">
                                  {value ?? '—'}
                                </td>
                                <td className="pr-4 py-1.5 text-center">
                                  {met === null ? (
                                    <span className="text-slate-400">—</span>
                                  ) : met ? (
                                    <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700">Pass</span>
                                  ) : (
                                    <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-amber-100 text-amber-700">Miss</span>
                                  )}
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )
              })}
            </div>
          </section>
        )}
      </div>
    </div>
  )
}
