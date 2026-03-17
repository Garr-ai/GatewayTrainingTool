interface ClassReportsSectionProps {
  className: string
}

export function ClassReportsSection({ className }: ClassReportsSectionProps) {
  return (
    <section className="space-y-3">
      <div className="rounded-xl bg-white p-4 shadow-sm">
        <header className="flex items-center justify-between mb-3">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">Daily reports</h3>
            <p className="mt-0.5 text-xs text-slate-500">
              Capture daily notes and operational reports for this class.
            </p>
          </div>
          <button
            type="button"
            className="rounded-md bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-500"
          >
            + Add daily report
          </button>
        </header>

        <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-center text-xs text-slate-500">
          Daily reports for <span className="font-medium text-slate-700">{className}</span> will be
          listed here.
        </div>
      </div>

      <div className="rounded-xl bg-white p-4 shadow-sm">
        <header className="flex items-center justify-between mb-3">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">Logged hours</h3>
            <p className="mt-0.5 text-xs text-slate-500">
              Track hours for trainers and students for payroll purposes.
            </p>
          </div>
          <button
            type="button"
            className="rounded-md bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-500"
          >
            + Log hours
          </button>
        </header>

        <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-center text-xs text-slate-500">
          Logged hours for <span className="font-medium text-slate-700">{className}</span> will be
          listed here.
        </div>
      </div>
    </section>
  )
}

