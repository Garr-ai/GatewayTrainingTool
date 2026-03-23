/**
 * pages/ClassesPage.tsx — Class management list page (coordinator only)
 *
 * Shows two tables:
 *   1. Active classes — clickable rows that navigate to the class detail page
 *   2. Archived classes — shown below with unarchive and delete actions
 *
 * Both lists are fetched in parallel on mount. Archive, unarchive, and delete
 * actions refresh both lists via `fetchClasses()`.
 *
 * The "Create class" button opens the CreateClassModal, which calls
 * `fetchClasses()` via `onSuccess` on successful creation.
 *
 * Navigation to a class detail page uses the `classSlug` utility to convert
 * the class name to a URL-safe slug (e.g. "BJ APR 01" → "BJ-APR-01").
 *
 * A filter bar above the tables allows filtering by province, site, game type,
 * and a free-text search on class name. Filters apply to both active and
 * archived lists.
 */

import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../lib/apiClient'
import type { Class } from '../types'
import { PROVINCES } from '../types'
import { CreateClassModal } from '../components/CreateClassModal'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { useAuth } from '../contexts/AuthContext'
import { useClasses } from '../contexts/ClassesContext'
import { useToast } from '../contexts/ToastContext'
import { classSlug, provinceLabel } from '../lib/utils'
import { SkeletonTable } from '../components/Skeleton'

export function ClassesPage() {
  const { email, signOut } = useAuth()
  const { toast } = useToast()
  // Classes are cached in context — no local fetch needed
  const { active, archived, loading, refresh: fetchClasses } = useClasses()
  // Controls visibility of the CreateClassModal
  const [createOpen, setCreateOpen] = useState(false)
  const [confirmState, setConfirmState] = useState<{
    title: string
    message: string
    confirmLabel: string
    confirmVariant: 'danger' | 'primary'
    onConfirm: () => void
  } | null>(null)

  // Filter state
  const [province, setProvince] = useState('')
  const [site, setSite] = useState('')
  const [gameType, setGameType] = useState('')
  const [search, setSearch] = useState('')

  const navigate = useNavigate()

  const allClasses = useMemo(() => [...active, ...archived], [active, archived])

  /** Unique sites derived from all classes, optionally narrowed by selected province. */
  const siteOptions = useMemo(() => {
    const source = province
      ? allClasses.filter(c => c.province === province)
      : allClasses
    return [...new Set(source.map(c => c.site))].sort()
  }, [allClasses, province])

  /** Unique non-null game types derived from all classes. */
  const gameTypeOptions = useMemo(() => {
    return [...new Set(allClasses.map(c => c.game_type).filter((g): g is string => g != null))].sort()
  }, [allClasses])

  const hasFilters = province !== '' || site !== '' || gameType !== '' || search !== ''

  function resetFilters() {
    setProvince('')
    setSite('')
    setGameType('')
    setSearch('')
  }

  /** Apply all active filters to a list of classes. */
  function applyFilters(classes: Class[]): Class[] {
    let result = classes
    if (province) result = result.filter(c => c.province === province)
    if (site) result = result.filter(c => c.site === site)
    if (gameType) result = result.filter(c => c.game_type === gameType)
    if (search) {
      const q = search.toLowerCase()
      result = result.filter(c => c.name.toLowerCase().includes(q))
    }
    return result
  }

  const filteredActive = useMemo(() => applyFilters(active), [active, province, site, gameType, search])
  const filteredArchived = useMemo(() => applyFilters(archived), [archived, province, site, gameType, search])

  /**
   * Archives a class (soft-delete — it moves to the archived list).
   * `e.stopPropagation()` prevents the row click from navigating to the class detail.
   */
  function handleArchive(c: Class, e: React.MouseEvent) {
    e.stopPropagation()
    setConfirmState({
      title: 'Archive class',
      message: `Archive "${c.name}"? It will be hidden from the active list.`,
      confirmLabel: 'Archive',
      confirmVariant: 'primary',
      onConfirm: async () => {
        setConfirmState(null)
        try {
          await api.classes.archive(c.id)
          fetchClasses()
          toast('Class archived', 'success')
        } catch (err) {
          toast((err as Error).message, 'error')
        }
      }
    })
  }

  /** Moves an archived class back to the active list. */
  async function handleUnarchive(c: Class) {
    try {
      await api.classes.unarchive(c.id)
      fetchClasses()
      toast('Class restored', 'success')
    } catch (err) {
      toast((err as Error).message, 'error')
    }
  }

  /** Permanently deletes a class. Only available for archived classes. */
  function handleDelete(c: Class) {
    setConfirmState({
      title: 'Delete class',
      message: `Permanently delete "${c.name}"? This cannot be undone.`,
      confirmLabel: 'Delete',
      confirmVariant: 'danger',
      onConfirm: async () => {
        setConfirmState(null)
        try {
          await api.classes.delete(c.id)
          fetchClasses()
          toast('Class deleted', 'success')
        } catch (err) {
          toast((err as Error).message, 'error')
        }
      }
    })
  }

  const selectClass = "rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-700 focus:border-gw-blue focus:outline-none focus:ring-1 focus:ring-gw-blue"

  return (
    <div className="flex flex-col h-full min-h-0">
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 flex-shrink-0">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Classes</h2>
          <p className="mt-0.5 text-xs text-slate-500">Create and manage training classes</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="hidden sm:inline text-xs text-slate-600">{email}</span>
          <button
            type="button"
            onClick={signOut}
            className="rounded-md border border-slate-300 px-2 py-1 text-[11px] text-slate-700 hover:border-slate-400"
          >
            Sign out
          </button>
          <button
            type="button"
            onClick={() => setCreateOpen(true)}
            className="inline-flex items-center rounded-lg bg-gw-blue px-4 py-2 text-sm font-medium text-white hover:bg-gw-blue-hover"
          >
            + Create class
          </button>
        </div>
      </header>

      {/* Filter bar */}
      {!loading && (
        <div className="mt-4 rounded-xl border border-slate-200 bg-white p-3 flex-shrink-0">
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <label className="block text-[11px] font-medium text-slate-600">Province</label>
              <select
                value={province}
                onChange={e => { setProvince(e.target.value); setSite('') }}
                className={selectClass}
              >
                <option value="">All provinces</option>
                {PROVINCES.map(p => (
                  <option key={p.value} value={p.value}>{p.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-medium text-slate-600">Site</label>
              <select
                value={site}
                onChange={e => setSite(e.target.value)}
                className={selectClass}
              >
                <option value="">All sites</option>
                {siteOptions.map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-medium text-slate-600">Game type</label>
              <select
                value={gameType}
                onChange={e => setGameType(e.target.value)}
                className={selectClass}
              >
                <option value="">All game types</option>
                {gameTypeOptions.map(g => (
                  <option key={g} value={g}>{g}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-medium text-slate-600">Search</label>
              <input
                type="text"
                placeholder="Filter by name..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className={selectClass}
              />
            </div>

            {hasFilters && (
              <button
                type="button"
                onClick={resetFilters}
                className="text-xs text-gw-dark hover:underline"
              >
                Reset
              </button>
            )}
          </div>
        </div>
      )}

      <div className="mt-4 flex-1 min-h-0 overflow-auto flex flex-col gap-6">
        {loading ? (
          <SkeletonTable rows={5} cols={6} />
        ) : filteredActive.length === 0 && filteredArchived.length === 0 && hasFilters ? (
          <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
            <p className="text-sm text-slate-600">No classes match your filters</p>
            <button
              type="button"
              onClick={resetFilters}
              className="mt-3 text-xs text-gw-dark hover:underline"
            >
              Reset filters
            </button>
          </div>
        ) : (
          <>
            {/* Active classes */}
            <div>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                Active
              </h3>
              {filteredActive.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
                  <p className="text-sm text-slate-600">No active classes</p>
                  <p className="mt-1 text-xs text-slate-500">Create your first class to get started.</p>
                  <button
                    type="button"
                    onClick={() => setCreateOpen(true)}
                    className="mt-4 rounded-lg bg-gw-blue px-4 py-2 text-sm font-medium text-white hover:bg-gw-blue-hover"
                  >
                    + Create class
                  </button>
                </div>
              ) : (
                <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                      <thead>
                        <tr className="border-b border-slate-200 bg-gw-dark">
                          <th className="px-4 py-3 font-medium text-white">Name</th>
                          <th className="px-4 py-3 font-medium text-white">Site</th>
                          <th className="hidden sm:table-cell px-4 py-3 font-medium text-white">Province</th>
                          <th className="hidden sm:table-cell px-4 py-3 font-medium text-white">Game type</th>
                          <th className="hidden md:table-cell px-4 py-3 font-medium text-white">Start</th>
                          <th className="hidden md:table-cell px-4 py-3 font-medium text-white">End</th>
                          <th className="px-4 py-3" />
                        </tr>
                      </thead>
                      <tbody>
                        {filteredActive.map(c => (
                          <tr
                            key={c.id}
                            className="border-b border-slate-100 hover:bg-blue-50 cursor-pointer"
                            onClick={() => navigate(`/classes/${classSlug(c.name)}`)}
                          >
                            <td className="px-4 py-3 font-medium text-gw-dark">{c.name}</td>
                            <td className="px-4 py-3 text-slate-600">{c.site}</td>
                            <td className="hidden sm:table-cell px-4 py-3 text-slate-600">{provinceLabel(c.province)}</td>
                            <td className="hidden sm:table-cell px-4 py-3 text-slate-600">{c.game_type ?? '—'}</td>
                            <td className="hidden md:table-cell px-4 py-3 text-slate-600">{c.start_date}</td>
                            <td className="hidden md:table-cell px-4 py-3 text-slate-600">{c.end_date}</td>
                            <td className="px-4 py-3 text-right">
                              <button
                                type="button"
                                onClick={e => handleArchive(c, e)}
                                className="rounded-md border border-slate-300 px-2 py-1 text-[11px] text-slate-600 hover:bg-slate-50"
                              >
                                Archive
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>

            {/* Archived classes */}
            {filteredArchived.length > 0 && (
              <div>
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Archived
                </h3>
                <div className="rounded-xl border border-slate-200 bg-white overflow-hidden opacity-80">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                      <thead>
                        <tr className="border-b border-slate-200 bg-slate-100">
                          <th className="px-4 py-3 font-medium text-slate-600">Name</th>
                          <th className="px-4 py-3 font-medium text-slate-600">Site</th>
                          <th className="hidden sm:table-cell px-4 py-3 font-medium text-slate-600">Province</th>
                          <th className="hidden md:table-cell px-4 py-3 font-medium text-slate-600">Start</th>
                          <th className="hidden md:table-cell px-4 py-3 font-medium text-slate-600">End</th>
                          <th className="px-4 py-3" />
                        </tr>
                      </thead>
                      <tbody>
                        {filteredArchived.map(c => (
                          <tr key={c.id} className="border-b border-slate-100">
                            <td className="px-4 py-3 font-medium text-slate-500">{c.name}</td>
                            <td className="px-4 py-3 text-slate-400">{c.site}</td>
                            <td className="hidden sm:table-cell px-4 py-3 text-slate-400">{provinceLabel(c.province)}</td>
                            <td className="hidden md:table-cell px-4 py-3 text-slate-400">{c.start_date}</td>
                            <td className="hidden md:table-cell px-4 py-3 text-slate-400">{c.end_date}</td>
                            <td className="px-4 py-3 text-right">
                              <div className="flex items-center justify-end gap-2">
                                <button
                                  type="button"
                                  onClick={() => handleUnarchive(c)}
                                  className="rounded-md border border-slate-300 px-2 py-1 text-[11px] text-slate-600 hover:bg-slate-50"
                                >
                                  Unarchive
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDelete(c)}
                                  className="rounded-md border border-rose-200 px-2 py-1 text-[11px] text-rose-600 hover:bg-rose-50"
                                >
                                  Delete
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {createOpen && (
        <CreateClassModal onClose={() => setCreateOpen(false)} onSuccess={fetchClasses} />
      )}

      <ConfirmDialog
        open={confirmState !== null}
        title={confirmState?.title ?? ''}
        message={confirmState?.message ?? ''}
        confirmLabel={confirmState?.confirmLabel}
        confirmVariant={confirmState?.confirmVariant}
        onConfirm={confirmState?.onConfirm ?? (() => {})}
        onCancel={() => setConfirmState(null)}
      />
    </div>
  )
}
