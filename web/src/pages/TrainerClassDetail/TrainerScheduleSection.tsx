import { useTrainerClassDetail } from '../../contexts/TrainerClassDetailContext'
import { EmptyState } from '../../components/EmptyState'
import { SkeletonTable } from '../../components/Skeleton'

export function TrainerScheduleSection() {
  const { schedule, loading } = useTrainerClassDetail()

  return (
    <section className="bg-gw-surface rounded-[10px] p-4">
      <header className="mb-3">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
          Schedule
          {!loading && schedule.length > 0 && (
            <span className="ml-1.5 font-normal normal-case tracking-normal text-slate-500">({schedule.length} slots)</span>
          )}
        </h3>
        <p className="mt-0.5 text-xs text-slate-500">All scheduled sessions for this class.</p>
      </header>

      {loading ? (
        <SkeletonTable rows={5} cols={5} />
      ) : schedule.length === 0 ? (
        <div className="bg-gw-elevated rounded-[10px]">
          <EmptyState title="No schedule yet" description="No schedule slots have been added to this class." variant="neutral" />
        </div>
      ) : (
        <div className="bg-gw-elevated rounded-[10px] overflow-x-auto">
          <table className="min-w-full text-xs">
            <thead>
              <tr className="bg-white/[0.02] border-b border-white/[0.06]">
                <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Date</th>
                <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Time</th>
                <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 hidden sm:table-cell">Group</th>
                <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 hidden md:table-cell">Notes</th>
              </tr>
            </thead>
            <tbody>
              {schedule.map(slot => (
                <tr key={slot.id} className="border-b border-white/[0.03] hover:bg-gw-surface transition-colors duration-100">
                  <td className="px-3 py-2 text-slate-200 font-medium">{slot.slot_date}</td>
                  <td className="px-3 py-2 text-slate-400">{slot.start_time}–{slot.end_time}</td>
                  <td className="px-3 py-2 text-slate-400 hidden sm:table-cell">{slot.group_label ?? '—'}</td>
                  <td className="px-3 py-2 text-slate-500 hidden md:table-cell">{slot.notes ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
