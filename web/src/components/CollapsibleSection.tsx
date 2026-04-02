import { useState, useEffect } from 'react'

interface CollapsibleSectionProps {
  title?: string
  summary?: string
  defaultOpen?: boolean
  mobileDefaultOpen?: boolean
  children: React.ReactNode
}

export function CollapsibleSection({
  title,
  summary,
  defaultOpen = true,
  mobileDefaultOpen = false,
  children,
}: CollapsibleSectionProps) {
  const [open, setOpen] = useState(defaultOpen)

  // On mobile, override default to collapsed
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)')
    if (mq.matches && !mobileDefaultOpen) setOpen(false)
  }, [mobileDefaultOpen])

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between gap-2 py-2 text-left"
      >
        <div className="flex items-center gap-2">
          {title && <span className="text-sm font-semibold text-slate-700">{title}</span>}
          {!open && summary && (
            <span className="text-xs text-slate-500 truncate max-w-xs">{summary}</span>
          )}
        </div>
        <svg
          width="14"
          height="14"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth="2"
          className={`shrink-0 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      <div
        className={`overflow-hidden transition-all duration-200 ${
          open ? 'max-h-[5000px] opacity-100' : 'max-h-0 opacity-0'
        }`}
      >
        {children}
      </div>
    </div>
  )
}
