interface ClassDrillsSectionProps {
  className: string
}

export function ClassDrillsSection({ className }: ClassDrillsSectionProps) {
  return (
    <section className="rounded-xl bg-white p-4 shadow-sm">
      <header className="flex items-center justify-between mb-3">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">Drills & tests</h3>
          <p className="mt-0.5 text-xs text-slate-500">
            Define drills and tests, including scores and par times, for this class.
          </p>
        </div>
        <button
          type="button"
          className="rounded-md bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-500"
        >
          + Add drill / test
        </button>
      </header>

      <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-center text-xs text-slate-500">
        Drills and tests for <span className="font-medium text-slate-700">{className}</span> will be
        shown here.
      </div>
    </section>
  )
}

