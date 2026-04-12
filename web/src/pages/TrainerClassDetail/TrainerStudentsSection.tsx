import { useTrainerClassDetail } from '../../contexts/TrainerClassDetailContext'
import { EmptyState } from '../../components/EmptyState'
import { SkeletonTable } from '../../components/Skeleton'

export function TrainerStudentsSection() {
  const { enrollments, loading } = useTrainerClassDetail()

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
        <SkeletonTable rows={4} cols={4} />
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
                      e.status === 'waitlist' ? 'bg-amber-500/15 text-amber-300' :
                      'bg-rose-500/15 text-rose-300'
                    }`}>
                      {e.status}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-slate-500 dark:text-slate-400 hidden sm:table-cell">{e.group_label ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
