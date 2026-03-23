const WIDTHS = ['w-full', 'w-3/4', 'w-1/2', 'w-5/6']

export function SkeletonText({ className = '' }: { className?: string }) {
  return <div className={`h-3 rounded bg-slate-200 animate-pulse ${className}`} />
}

export function SkeletonCard({ lines = 3 }: { lines?: number }) {
  return (
    <div className="rounded-xl bg-white p-4 shadow-sm">
      <div className="h-4 w-1/3 rounded bg-slate-200 animate-pulse mb-3" />
      {Array.from({ length: lines }, (_, i) => (
        <div key={i} className={`h-3 rounded bg-slate-200 animate-pulse mt-2 ${WIDTHS[i % WIDTHS.length]}`} />
      ))}
    </div>
  )
}

export function SkeletonTable({ rows = 5, cols = 4 }: { rows?: number; cols?: number }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
      <div className="bg-slate-100 px-4 py-3 flex gap-4">
        {Array.from({ length: cols }, (_, i) => (
          <div key={i} className="h-3 w-20 rounded bg-slate-200 animate-pulse" />
        ))}
      </div>
      {Array.from({ length: rows }, (_, r) => (
        <div key={r} className="border-t border-slate-100 px-4 py-3 flex gap-4">
          {Array.from({ length: cols }, (_, c) => (
            <div
              key={c}
              className={`h-3 rounded bg-slate-200 animate-pulse ${c === 0 ? 'w-[30%]' : 'w-[15%]'}`}
            />
          ))}
        </div>
      ))}
    </div>
  )
}
