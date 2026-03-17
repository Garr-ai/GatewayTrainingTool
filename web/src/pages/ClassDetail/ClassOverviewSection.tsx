import type { Class } from '../../types'

interface ClassOverviewSectionProps {
  classData: Class
}

export function ClassOverviewSection({ classData }: ClassOverviewSectionProps) {
  return (
    <section className="grid grid-cols-1 md:grid-cols-3 gap-3">
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

      <div className="rounded-xl bg-white p-4 shadow-sm">
        <h3 className="text-sm font-semibold text-slate-900 mb-1">Trainers</h3>
        <p className="text-xs text-slate-500">
          Trainer assignments will appear here once configured.
        </p>
      </div>

      <div className="rounded-xl bg-white p-4 shadow-sm">
        <h3 className="text-sm font-semibold text-slate-900 mb-1">Students & schedule</h3>
        <p className="text-xs text-slate-500">
          Student counts and next scheduled session will appear here.
        </p>
      </div>
    </section>
  )
}

