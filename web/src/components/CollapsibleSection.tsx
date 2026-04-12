import { useState } from 'react'

interface CollapsibleSectionProps {
  label: string
  defaultOpen?: boolean
  children: React.ReactNode
}

export function CollapsibleSection({ label, defaultOpen = false, children }: CollapsibleSectionProps) {
  const [open, setOpen] = useState(defaultOpen)

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 text-xs font-medium text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 transition-colors mb-2 md:hidden"
      >
        <svg
          width="12"
          height="12"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth="2"
          className={`transition-transform duration-150 ${open ? 'rotate-90' : ''}`}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
        </svg>
        {label}
      </button>
      <div className={`${open ? 'block' : 'hidden'} md:block`}>
        {children}
      </div>
    </div>
  )
}
