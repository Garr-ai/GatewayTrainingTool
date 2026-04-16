import { useState } from 'react'
import { api } from '../../lib/apiClient'
import { useTrainerClassDetail } from '../../contexts/TrainerClassDetailContext'
import { useToast } from '../../contexts/ToastContext'
import { EmptyState } from '../../components/EmptyState'
import { SkeletonTable } from '../../components/Skeleton'
import type { ClassEnrollment } from '../../types'

export function TrainerStudentsSection() {
  const { classId, classInfo, enrollments, loading, setEnrollments, refreshEnrollments } = useTrainerClassDetail()
  const { toast } = useToast()
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  const archived = classInfo?.archived ?? false

  async function handleToggleFail(enrollment: ClassEnrollment) {
    if (actionLoading) return
    const newStatus = enrollment.status === 'failed' ? 'enrolled' : 'failed'
    const prev = enrollments
    setEnrollments(es => es.map(e => e.id === enrollment.id ? { ...e, status: newStatus } : e))
    toast(newStatus === 'failed' ? 'Student marked as failed' : 'Student reinstated', 'success')
    setActionLoading(enrollment.id)
    try {
      await api.selfService.updateEnrollmentStatus(classId, enrollment.id, { status: newStatus })
      refreshEnrollments()
    } catch (err) {
      toast((err as Error).message, 'error')
      setEnrollments(prev)
    } finally {
      setActionLoading(null)
    }
  }

  return (
    <section className="bg-white dark:bg-gw-surface rounded-[10px] p-4">
      <header className="mb-3">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
          Enrolled students
          {!loading && enrollments.length > 0 && (
            <span className="ml-1.5 font-normal normal-case tracking-normal text-slate-500">({enrollments.length})</span>
          )}
        </h3>
        <p className="mt-0.5 text-xs text-slate-500">Students enrolled in this class.</p>
      </header>

      {loading ? (
        <SkeletonTable rows={4} cols={5} />
      ) : enrollments.length === 0 ? (
        <div className="bg-slate-100 dark:bg-gw-elevated rounded-[10px]">
          <EmptyState title="No students enrolled" description="No students are currently enrolled in this class." variant="neutral" />
        </div>
      ) : (
        <div className="bg-slate-100 dark:bg-gw-elevated rounded-[10px] overflow-x-auto">
          <table className="min-w-full text-xs">
            <thead>
              <tr className="bg-white/[0.02] border-b border-slate-200 dark:border-white/[0.06]">
                <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Name</th>
                <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 hidden sm:table-cell">Email</th>
                <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Status</th>
                <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 hidden sm:table-cell">Group</th>
                {!archived && <th className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">Actions</th>}
              </tr>
            </thead>
            <tbody>
              {enrollments.map(e => (
                <tr key={e.id} className="border-b border-white/[0.03] hover:bg-white dark:bg-gw-surface transition-colors duration-100">
                  <td className="px-3 py-2 text-slate-700 dark:text-slate-200">{e.student_name}</td>
                  <td className="px-3 py-2 text-slate-500 dark:text-slate-400 hidden sm:table-cell">{e.student_email}</td>
                  <td className="px-3 py-2">
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium ${
                      e.status === 'enrolled' ? 'bg-emerald-500/15 text-emerald-300' :
                      e.status === 'failed'   ? 'bg-rose-500/15 text-rose-400' :
                      'bg-slate-500/15 text-slate-400'
                    }`}>
                      {e.status}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-slate-500 dark:text-slate-400 hidden sm:table-cell">{e.group_label ?? '—'}</td>
                  {!archived && (
                    <td className="px-3 py-2 text-right">
                      {(e.status === 'enrolled' || e.status === 'failed') && (
                        <button
                          type="button"
                          onClick={() => handleToggleFail(e)}
                          disabled={actionLoading === e.id}
                          className={`rounded px-2 py-1 text-[11px] font-medium transition-colors disabled:opacity-50 ${
                            e.status === 'failed'
                              ? 'text-emerald-400 hover:bg-emerald-500/10'
                              : 'text-rose-400 hover:bg-rose-500/10'
                          }`}
                        >
                          {e.status === 'failed' ? 'Unfail' : 'Fail'}
                        </button>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
