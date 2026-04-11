import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { api } from '../lib/apiClient'
import { SkeletonCard, SkeletonTable } from '../components/Skeleton'
import { EmptyState } from '../components/EmptyState'
import { StudentReportInput } from '../components/StudentReportInput'
import type { StudentClassDetailResponse, StudentReportView, DailyRating } from '../types'

const RATING_COLOR: Record<DailyRating, string> = {
  EE: 'bg-emerald-500/15 text-emerald-400',
  ME: 'bg-blue-500/15 text-blue-400',
  AD: 'bg-amber-500/15 text-amber-400',
  NI: 'bg-rose-500/15 text-rose-400',
}

function RatingBadge({ rating }: { rating: DailyRating | null }) {
  if (!rating) return <span className="text-slate-500">—</span>
  return (
    <span className={`inline-block text-[10px] font-medium px-1.5 py-0.5 rounded ${RATING_COLOR[rating]}`}>
      {rating}
    </span>
  )
}

export function StudentClassDetailPage() {
  const { classId } = useParams<{ classId: string }>()
  const [classInfo, setClassInfo] = useState<StudentClassDetailResponse | null>(null)
  const [reports, setReports] = useState<StudentReportView[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [expandedReport, setExpandedReport] = useState<string | null>(null)

  useEffect(() => {
    if (!classId) return
    Promise.all([
      api.selfService.studentClassDetail(classId),
      api.selfService.studentClassReports(classId),
    ])
      .then(([detail, rpts]) => {
        setClassInfo(detail)
        setReports(rpts.sort((a, b) => b.report_date.localeCompare(a.report_date)))
      })
      .catch(err => setError((err as Error).message))
      .finally(() => setLoading(false))
  }, [classId])

  if (loading) {
    return (
      <div className="flex flex-col gap-4">
        <SkeletonCard lines={3} />
        <SkeletonTable rows={5} cols={5} />
      </div>
    )
  }

  if (error || !classInfo) {
    return (
      <div className="bg-gw-surface rounded-[10px]">
        <EmptyState title="Error loading class" description={error ?? 'Class not found.'} variant="neutral" />
      </div>
    )
  }

  const { class_info, enrollment, upcoming_slots } = classInfo

  const handleReportUpdate = (updated: StudentReportView) => {
    setReports(prev => prev.map(r => r.report_id === updated.report_id ? updated : r))
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Back link + header */}
      <div>
        <Link to="/dashboard" className="text-xs text-slate-500 hover:text-slate-300 transition-colors mb-2 inline-block">
          &larr; Back to Dashboard
        </Link>
        <h2 className="text-xl font-bold text-slate-100">{class_info.name}</h2>
        <div className="flex flex-wrap items-center gap-3 mt-1 text-sm text-slate-400">
          <span>{class_info.site} · {class_info.province}</span>
          {class_info.game_type && <span>· {class_info.game_type}</span>}
          <span>· {class_info.start_date} → {class_info.end_date}</span>
        </div>
        <div className="flex items-center gap-2 mt-2">
          <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${
            enrollment.status === 'enrolled' ? 'bg-emerald-500/15 text-emerald-400' :
            enrollment.status === 'waitlist' ? 'bg-amber-500/15 text-amber-400' :
            'bg-white/[0.06] text-slate-400'
          }`}>
            {enrollment.status}
          </span>
          {enrollment.group_label && (
            <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-white/[0.06] text-slate-400">
              Group {enrollment.group_label}
            </span>
          )}
        </div>
      </div>

      {/* Upcoming schedule */}
      {upcoming_slots.length > 0 && (
        <section>
          <h3 className="text-sm font-semibold text-slate-200 mb-2">Upcoming Schedule</h3>
          <div className="flex flex-col gap-1">
            {upcoming_slots.map(slot => (
              <div key={slot.id} className="flex items-center gap-3 text-sm text-slate-400 bg-gw-surface rounded-[10px] px-3 py-2 border border-white/[0.06]">
                <span className="font-medium text-slate-300 whitespace-nowrap">{slot.slot_date}</span>
                <span>{slot.start_time} – {slot.end_time}</span>
                {slot.group_label && (
                  <span className="text-[10px] bg-white/[0.06] border border-white/[0.08] rounded px-1.5 py-0.5 text-slate-500">
                    Grp {slot.group_label}
                  </span>
                )}
                {slot.notes && <span className="text-slate-500 truncate">{slot.notes}</span>}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Daily reports */}
      <section>
        <h3 className="text-sm font-semibold text-slate-200 mb-2">
          Daily Reports
          {reports.length > 0 && (
            <span className="ml-1.5 text-xs font-normal text-slate-500">({reports.length})</span>
          )}
        </h3>
        {reports.length === 0 ? (
          <div className="bg-gw-surface rounded-[10px]">
            <EmptyState title="No reports yet" description="Daily reports will appear here once your trainer creates them." variant="neutral" />
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {reports.map(report => {
              const isExpanded = expandedReport === report.report_id
              const prog = report.my_progress
              return (
                <div
                  key={report.report_id}
                  className="rounded-[10px] border border-white/[0.08] bg-gw-surface overflow-hidden"
                >
                  {/* Collapsible header */}
                  <button
                    type="button"
                    onClick={() => setExpandedReport(isExpanded ? null : report.report_id)}
                    className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-white/[0.02] transition-colors"
                  >
                    <svg
                      className={`w-4 h-4 text-slate-500 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                      fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                    </svg>
                    <div className="flex-1 min-w-0 flex items-center gap-3">
                      <span className="text-sm font-medium text-slate-200 whitespace-nowrap">{report.report_date}</span>
                      {report.session_label && (
                        <span className="text-xs text-slate-400">{report.session_label}</span>
                      )}
                      {report.game && (
                        <span className="text-xs text-slate-500">{report.game}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {prog?.attendance ? (
                        <svg className="w-4 h-4 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      ) : (
                        <span className="text-[10px] text-slate-500">Not signed in</span>
                      )}
                      <div className="flex gap-1">
                        <RatingBadge rating={prog?.gk_rating ?? null} />
                        <RatingBadge rating={prog?.dex_rating ?? null} />
                        <RatingBadge rating={prog?.hom_rating ?? null} />
                      </div>
                    </div>
                  </button>

                  {/* Expanded content */}
                  {isExpanded && (
                    <div className="px-4 pb-4">
                      {report.class_start_time && report.class_end_time && (
                        <p className="text-xs text-slate-500 mb-3">
                          Class time: {report.class_start_time} – {report.class_end_time}
                        </p>
                      )}
                      <StudentReportInput
                        report={report}
                        classId={classId!}
                        onUpdate={handleReportUpdate}
                      />
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </section>
    </div>
  )
}
