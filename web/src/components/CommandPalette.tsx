import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useClasses } from '../contexts/ClassesContext'
import { classSlug } from '../lib/utils'

interface PaletteItem {
  id: string
  label: string
  description?: string
  path: string
  icon: string
}

const COORDINATOR_PAGES: PaletteItem[] = [
  { id: 'nav-dashboard', label: 'Dashboard', path: '/dashboard', icon: 'M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2V9z' },
  { id: 'nav-classes', label: 'Classes', path: '/classes', icon: 'M4 19.5A2.5 2.5 0 016.5 17H20M4 19.5A2.5 2.5 0 004 17V5a2 2 0 012-2h14a2 2 0 012 2v12a2.5 2.5 0 01-2.5 2.5H4z' },
  { id: 'nav-students', label: 'Students', path: '/students', icon: 'M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4-4v2M9 11a4 4 0 100-8 4 4 0 000 8z' },
  { id: 'nav-trainers', label: 'Trainers', path: '/trainers', icon: 'M16 21v-2a4 4 0 00-4-4H5a4 4 0 00-4-4v2M8.5 11a4 4 0 100-8 4 4 0 000 8zM20 8v6M23 11h-6' },
  { id: 'nav-reports', label: 'Reports', path: '/reports', icon: 'M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8zM14 2v6h6' },
  { id: 'nav-schedule', label: 'Schedule', path: '/schedule', icon: 'M19 4H5a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2V6a2 2 0 00-2-2zM16 2v4M8 2v4M3 10h18' },
  { id: 'nav-settings', label: 'Settings', path: '/settings', icon: 'M12 15a3 3 0 100-6 3 3 0 000 6z' },
]

const TRAINER_PAGES: PaletteItem[] = [
  { id: 'nav-dashboard', label: 'Dashboard', path: '/dashboard', icon: 'M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2V9z' },
  { id: 'nav-my-classes', label: 'My Classes', path: '/my-classes', icon: 'M4 19.5A2.5 2.5 0 016.5 17H20M4 19.5A2.5 2.5 0 004 17V5a2 2 0 012-2h14a2 2 0 012 2v12a2.5 2.5 0 01-2.5 2.5H4z' },
  { id: 'nav-reports', label: 'Reports', path: '/reports', icon: 'M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8zM14 2v6h6' },
  { id: 'nav-schedule', label: 'Schedule', path: '/schedule', icon: 'M19 4H5a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2V6a2 2 0 00-2-2zM16 2v4M8 2v4M3 10h18' },
  { id: 'nav-hours', label: 'Hours', path: '/hours', icon: 'M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10zM12 6v6l4 2' },
]

const STUDENT_PAGES: PaletteItem[] = [
  { id: 'nav-dashboard', label: 'Dashboard', path: '/dashboard', icon: 'M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2V9z' },
  { id: 'nav-settings', label: 'Settings', path: '/settings', icon: 'M12 15a3 3 0 100-6 3 3 0 000 6z' },
]

export function CommandPalette() {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()
  const { role } = useAuth()

  // Get classes for coordinator search
  let classItems: PaletteItem[] = []
  try {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    const { active, archived } = useClasses()
    classItems = [...active, ...archived].map(c => ({
      id: `class-${c.id}`,
      label: c.name,
      description: `${c.site} · ${c.province}`,
      path: `/classes/${classSlug(c.name)}`,
      icon: 'M4 19.5A2.5 2.5 0 016.5 17H20M4 19.5A2.5 2.5 0 004 17V5a2 2 0 012-2h14a2 2 0 012 2v12a2.5 2.5 0 01-2.5 2.5H4z',
    }))
  } catch {
    // ClassesContext not available (student/trainer) — just skip
  }

  const pages = role === 'coordinator'
    ? COORDINATOR_PAGES
    : role === 'trainer'
      ? TRAINER_PAGES
      : STUDENT_PAGES

  const allItems = useMemo(() => [...pages, ...classItems], [pages, classItems])

  const filtered = useMemo(() => {
    if (!query.trim()) return allItems.slice(0, 12)
    const q = query.toLowerCase()
    return allItems.filter(item =>
      item.label.toLowerCase().includes(q) ||
      (item.description?.toLowerCase().includes(q))
    ).slice(0, 12)
  }, [allItems, query])

  // Reset selection when filtered changes
  useEffect(() => { setSelectedIndex(0) }, [filtered])

  // Global keyboard shortcut
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setOpen(prev => !prev)
      }
      if (e.key === 'Escape' && open) {
        e.preventDefault()
        setOpen(false)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open])

  // Focus input when opened
  useEffect(() => {
    if (open) {
      setQuery('')
      setSelectedIndex(0)
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [open])

  const selectItem = useCallback((item: PaletteItem) => {
    setOpen(false)
    navigate(item.path)
  }, [navigate])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIndex(prev => Math.min(prev + 1, filtered.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIndex(prev => Math.max(prev - 1, 0))
    } else if (e.key === 'Enter' && filtered[selectedIndex]) {
      e.preventDefault()
      selectItem(filtered[selectedIndex])
    }
  }

  // Scroll selected item into view
  useEffect(() => {
    const el = listRef.current?.children[selectedIndex] as HTMLElement | undefined
    el?.scrollIntoView({ block: 'nearest' })
  }, [selectedIndex])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-[200] flex items-start justify-center pt-[15vh] bg-black/60 animate-backdrop-in px-4"
      onClick={() => setOpen(false)}
    >
      <div
        className="w-full max-w-lg bg-gw-surface border border-white/[0.08] rounded-[14px] shadow-2xl overflow-hidden animate-modal-in"
        onClick={e => e.stopPropagation()}
      >
        {/* Search input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-white/[0.06]">
          <svg className="w-5 h-5 text-slate-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search pages, classes…"
            className="flex-1 bg-transparent text-sm text-slate-200 placeholder:text-slate-500 outline-none"
          />
          <kbd className="hidden sm:inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-white/[0.06] border border-white/[0.08] text-[10px] font-medium text-slate-500">
            ESC
          </kbd>
        </div>

        {/* Results */}
        <div ref={listRef} className="max-h-[320px] overflow-y-auto py-2">
          {filtered.length === 0 ? (
            <p className="px-4 py-6 text-sm text-slate-500 text-center">No results found</p>
          ) : (
            filtered.map((item, i) => (
              <button
                key={item.id}
                type="button"
                onClick={() => selectItem(item)}
                onMouseEnter={() => setSelectedIndex(i)}
                className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors duration-75 ${
                  i === selectedIndex ? 'bg-gw-blue/10 text-slate-100' : 'text-slate-300 hover:bg-white/[0.03]'
                }`}
              >
                <svg className="w-4 h-4 shrink-0 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                  <path strokeLinecap="round" strokeLinejoin="round" d={item.icon} />
                </svg>
                <div className="flex-1 min-w-0">
                  <span className="text-sm font-medium">{item.label}</span>
                  {item.description && (
                    <span className="ml-2 text-xs text-slate-500">{item.description}</span>
                  )}
                </div>
                {i === selectedIndex && (
                  <span className="text-[10px] text-slate-500 shrink-0">Enter ↵</span>
                )}
              </button>
            ))
          )}
        </div>

        {/* Footer hint */}
        <div className="px-4 py-2 border-t border-white/[0.06] flex items-center gap-4 text-[10px] text-slate-600">
          <span>↑↓ navigate</span>
          <span>↵ select</span>
          <span>esc close</span>
        </div>
      </div>
    </div>
  )
}
