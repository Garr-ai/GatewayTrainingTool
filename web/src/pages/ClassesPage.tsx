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

const provinceBadge: Record<string, string> = {
  BC: 'bg-blue-500/15 text-blue-300',
  AB: 'bg-orange-400/15 text-orange-300',
  ON: 'bg-purple-500/15 text-purple-300',
}

const inputClass = 'bg-gw-elevated border border-white/10 rounded-md px-3 py-1.5 text-xs text-slate-200 placeholder:text-slate-500 outline-none focus:border-gw-blue/40 focus:ring-2 focus:ring-gw-blue/15'
const labelClass = 'text-xs font-medium text-slate-400 mb-1 block'

export function ClassesPage() {
  const { email, signOut } = useAuth()
  const { toast } = useToast()
  const { active, archived, loading, refresh: fetchClasses } = useClasses()
  const [createOpen, setCreateOpen] = useState(false)
  const [confirmState, setConfirmState] = useState<{
    title: string
    message: string
    confirmLabel: string
    confirmVariant: 'danger' | 'primary'
    onConfirm: () => void
  } | null>(null)

  const [province, setProvince] = useState('')
  const [site, setSite] = useState('')
  const [gameType, setGameType] = useState('')
  const [search, setSearch] = useState('')

  const navigate = useNavigate()

  const allClasses = useMemo(() => [...active, ...archived], [active, archived])

  const siteOptions = useMemo(() => {
    const source = province ? allClasses.filter(c => c.province === province) : allClasses
    return [...new Set(source.map(c => c.site))].sort()
  }, [allClasses, province])

  const gameTypeOptions = useMemo(() => {
    return [...new Set(allClasses.map(c => c.game_type).filter((g): g is string => g != null))].sort()
  }, [allClasses])

  const hasFilters = province !== '' || site !== '' || gameType !== '' || search !== ''

  function resetFilters() {
    setProvince(''); setSite(''); setGameType(''); setSearch('')
  }

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

  async function handleUnarchive(c: Class) {
    try {
      await api.classes.unarchive(c.id)
      fetchClasses()
      toast('Class restored', 'success')
    } catch (err) {
      toast((err as Error).message, 'error')
    }
  }

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

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Page header */}
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 flex-shrink-0">
        <div>
          <h2 className="text-xl font-bold text-slate-100">Classes</h2>
          <p className="mt-0.5 text-sm text-slate-300">Create and manage training classes</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="hidden sm:inline text-xs text-slate-500">{email}</span>
          <button
            type="button"
            onClick={signOut}
            className="text-gw-blue underline underline-offset-2 hover:text-blue-300 transition-colors duration-150 text-xs"
          >
            Sign out
          </button>
          <button
            type="button"
            onClick={() => setCreateOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-md bg-gradient-to-r from-gw-blue to-gw-teal text-white font-semibold px-4 py-2 text-sm hover:brightness-110 transition-all duration-150"
          >
            + Create class
          </button>
        </div>
      </header>

      {/* Filter bar */}
      {!loading && (
        <div className="mt-4 bg-gw-surface rounded-[10px] p-3 flex-shrink-0">
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <label className={labelClass}>Province</label>
              <select
                value={province}
                onChange={e => { setProvince(e.target.value); setSite('') }}
                className={inputClass}
              >
                <option value="">All provinces</option>
                {PROVINCES.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
              </select>
            </div>
            <div>
              <label className={labelClass}>Site</label>
              <select value={site} onChange={e => setSite(e.target.value)} className={inputClass}>
                <option value="">All sites</option>
                {siteOptions.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className={labelClass}>Game type</label>
              <select value={gameType} onChange={e => setGameType(e.target.value)} className={inputClass}>
                <option value="">All game types</option>
                {gameTypeOptions.map(g => <option key={g} value={g}>{g}</option>)}
              </select>
            </div>
            <div>
              <label className={labelClass}>Search</label>
              <input
                type="text"
                placeholder="Filter by name…"
                value={search}
                onChange={e => setSearch(e.target.value)}
                className={inputClass}
              />
            </div>
            {hasFilters && (
              <button
                type="button"
                onClick={resetFilters}
                className="text-xs text-gw-blue underline underline-offset-2 hover:text-blue-300 transition-colors"
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
          <div className="bg-gw-surface rounded-[10px] p-8 text-center">
            <p className="text-sm text-slate-300">No classes match your filters</p>
            <button
              type="button"
              onClick={resetFilters}
              className="mt-3 text-xs text-gw-blue underline underline-offset-2 hover:text-blue-300 transition-colors"
            >
              Reset filters
            </button>
          </div>
        ) : (
          <>
            {/* Active classes */}
            <div>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">Active</h3>
              {filteredActive.length === 0 ? (
                <div className="bg-gw-surface rounded-[10px] p-8 text-center">
                  <p className="text-sm text-slate-300">No active classes</p>
                  <p className="mt-1 text-xs text-slate-500">Create your first class to get started.</p>
                  <button
                    type="button"
                    onClick={() => setCreateOpen(true)}
                    className="mt-4 inline-flex items-center gap-1.5 rounded-md bg-gradient-to-r from-gw-blue to-gw-teal text-white font-semibold px-4 py-2 text-sm hover:brightness-110 transition-all duration-150"
                  >
                    + Create class
                  </button>
                </div>
              ) : (
                <div className="bg-gw-surface rounded-[10px] overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                      <thead>
                        <tr className="bg-white/[0.02] border-b border-white/[0.06]">
                          <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">Name</th>
                          <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">Site</th>
                          <th className="hidden sm:table-cell px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">Province</th>
                          <th className="hidden sm:table-cell px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">Game type</th>
                          <th className="hidden md:table-cell px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">Start</th>
                          <th className="hidden md:table-cell px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">End</th>
                          <th className="px-4 py-3" />
                        </tr>
                      </thead>
                      <tbody>
                        {filteredActive.map(c => (
                          <tr
                            key={c.id}
                            className="border-b border-white/[0.03] hover:bg-gw-elevated cursor-pointer transition-colors duration-100"
                            onClick={() => navigate(`/classes/${classSlug(c.name)}`)}
                          >
                            <td className="px-4 py-3 font-medium text-slate-200">{c.name}</td>
                            <td className="px-4 py-3 text-slate-400">{c.site}</td>
                            <td className="hidden sm:table-cell px-4 py-3">
                              <span className={`text-xs font-medium px-2.5 py-0.5 rounded-full ${provinceBadge[c.province] ?? 'bg-white/10 text-slate-400'}`}>
                                {provinceLabel(c.province)}
                              </span>
                            </td>
                            <td className="hidden sm:table-cell px-4 py-3 text-slate-400">{c.game_type ?? '—'}</td>
                            <td className="hidden md:table-cell px-4 py-3 text-slate-400">{c.start_date}</td>
                            <td className="hidden md:table-cell px-4 py-3 text-slate-400">{c.end_date}</td>
                            <td className="px-4 py-3 text-right">
                              <button
                                type="button"
                                onClick={e => handleArchive(c, e)}
                                className="rounded-md bg-gw-surface text-slate-300 border border-white/10 px-2 py-1 text-xs font-medium hover:bg-gw-elevated transition-colors duration-150"
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
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">Archived</h3>
                <div className="bg-gw-surface rounded-[10px] overflow-hidden opacity-75">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                      <thead>
                        <tr className="bg-white/[0.02] border-b border-white/[0.06]">
                          <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">Name</th>
                          <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">Site</th>
                          <th className="hidden sm:table-cell px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">Province</th>
                          <th className="hidden md:table-cell px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">Start</th>
                          <th className="hidden md:table-cell px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">End</th>
                          <th className="px-4 py-3" />
                        </tr>
                      </thead>
                      <tbody>
                        {filteredArchived.map(c => (
                          <tr key={c.id} className="border-b border-white/[0.03]">
                            <td className="px-4 py-3 font-medium text-slate-400">{c.name}</td>
                            <td className="px-4 py-3 text-slate-500">{c.site}</td>
                            <td className="hidden sm:table-cell px-4 py-3 text-slate-500">{provinceLabel(c.province)}</td>
                            <td className="hidden md:table-cell px-4 py-3 text-slate-500">{c.start_date}</td>
                            <td className="hidden md:table-cell px-4 py-3 text-slate-500">{c.end_date}</td>
                            <td className="px-4 py-3 text-right">
                              <div className="flex items-center justify-end gap-2">
                                <button
                                  type="button"
                                  onClick={() => handleUnarchive(c)}
                                  className="rounded-md bg-gw-surface text-slate-300 border border-white/10 px-2 py-1 text-xs font-medium hover:bg-gw-elevated transition-colors duration-150"
                                >
                                  Unarchive
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDelete(c)}
                                  className="rounded-md bg-rose-500/15 text-rose-400 border border-rose-500/25 px-2 py-1 text-xs font-medium hover:bg-rose-500/20 transition-colors duration-150"
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
