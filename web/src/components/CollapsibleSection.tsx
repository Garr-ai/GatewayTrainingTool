import { useState, useEffect } from 'react'

interface CollapsibleSectionProps {
  title?: string
  summary?: string
  defaultOpen?: boolean
  collapseOnMobileMount?: boolean
  children: React.ReactNode
}

export function CollapsibleSection({
  title,
  summary,
  defaultOpen = true,
  collapseOnMobileMount = true,
  children,
}: CollapsibleSectionProps) {
  const [open, setOpen] = useState(defaultOpen)

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)')
    const handleChange = (e: MediaQueryListEvent | MediaQueryList) => {
      if (e.matches && collapseOnMobileMount) setOpen(false)
      else if (!e.matches) setOpen(defaultOpen)
    }
    handleChange(mq)
    mq.addEventListener('change', handleChange)
    return () => mq.removeEventListener('change', handleChange)
  }, [collapseOnMobileMount, defaultOpen])

  return (
    <div>
      <button
        type="button"
        aria-expanded={open}
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
      <div className={`grid transition-all duration-200 ${open ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}>
        <div className="overflow-hidden">
          {children}
        </div>
      </div>
    </div>
  )
}
