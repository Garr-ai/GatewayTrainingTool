/**
 * contexts/ClassesContext.tsx — Cached classes list context
 *
 * Stores the active and archived class lists in React context so they
 * persist across navigation (e.g. going to a class detail page and back
 * no longer re-fetches the full list).
 *
 * The cache is invalidated on any mutation (create, archive, unarchive, delete)
 * by calling `refresh()`. The initial fetch happens once on first mount.
 */

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react'
import { api } from '../lib/apiClient'
import type { Class } from '../types'

interface ClassesContextValue {
  active: Class[]
  archived: Class[]
  loading: boolean
  /** Re-fetches both lists from the API (call after any mutation). */
  refresh: () => Promise<void>
}

const ClassesContext = createContext<ClassesContextValue | null>(null)

export function ClassesProvider({ children }: { children: ReactNode }) {
  const [active, setActive] = useState<Class[]>([])
  const [archived, setArchived] = useState<Class[]>([])
  const [loading, setLoading] = useState(true)
  const [fetched, setFetched] = useState(false)

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const [activeData, archivedData] = await Promise.all([
        api.classes.list({ archived: false }),
        api.classes.list({ archived: true }),
      ])
      setActive(activeData)
      setArchived(archivedData)
    } catch (err) {
      console.error('ClassesContext fetch error:', (err as Error).message)
    } finally {
      setLoading(false)
      setFetched(true)
    }
  }, [])

  // Fetch once on first mount
  useEffect(() => {
    if (!fetched) refresh()
  }, [fetched, refresh])

  return (
    <ClassesContext.Provider value={{ active, archived, loading, refresh }}>
      {children}
    </ClassesContext.Provider>
  )
}

export function useClasses() {
  const ctx = useContext(ClassesContext)
  if (!ctx) throw new Error('useClasses must be used within ClassesProvider')
  return ctx
}
