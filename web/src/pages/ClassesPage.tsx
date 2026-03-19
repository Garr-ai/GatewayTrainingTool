import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../lib/apiClient'
import type { Class } from '../types'
import { CreateClassModal } from '../components/CreateClassModal'
import { PROVINCES } from '../types'
import { useAuth } from '../contexts/AuthContext'

export function ClassesPage() {
  const { email, signOut } = useAuth()
  const [active, setActive] = useState<Class[]>([])
  const [archived, setArchived] = useState<Class[]>([])
  const [loading, setLoading] = useState(true)
  const [createOpen, setCreateOpen] = useState(false)

  async function fetchClasses() {
    setLoading(true)
    try {
      const [activeData, archivedData] = await Promise.all([
        api.classes.list({ archived: false }),
        api.classes.list({ archived: true }),
      ])
      setActive(activeData)
      setArchived(archivedData)
    } catch (err) {
      console.error('fetchClasses error:', (err as Error).message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchClasses()
  }, [])

  const navigate = useNavigate()

  function classSlug(name: string) {
    return name.trim().replace(/\s+/g, '-')
  }

  function provinceLabel(province: string) {
    return PROVINCES.find(p => p.value === province)?.label ?? province
  }

  async function handleArchive(c: Class, e: React.MouseEvent) {
    e.stopPropagation()
    if (!window.confirm(`Archive "${c.name}"? It will be hidden from the active list.`)) return
    try {
      await api.classes.archive(c.id)
      fetchClasses()
    } catch (err) {
      console.error('archive error:', (err as Error).message)
    }
  }

  async function handleUnarchive(c: Class) {
    try {
      await api.classes.unarchive(c.id)
      fetchClasses()
    } catch (err) {
      console.error('unarchive error:', (err as Error).message)
    }
  }

  async function handleDelete(c: Class) {
    if (!window.confirm(`Permanently delete "${c.name}"? This cannot be undone.`)) return
    try {
      await api.classes.delete(c.id)
      fetchClasses()
    } catch (err) {
      console.error('delete error:', (err as Error).message)
    }
  }

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
            className="inline-flex items-center rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500"
          >
            + Create class
          </button>
        </div>
      </header>

      <div className="mt-4 flex-1 min-h-0 overflow-auto flex flex-col gap-6">
        {loading ? (
          <p className="text-sm text-slate-500">Loading classes…</p>
        ) : (
          <>
            {/* Active classes */}
            <div>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                Active
              </h3>
              {active.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
                  <p className="text-sm text-slate-600">No active classes</p>
                  <p className="mt-1 text-xs text-slate-500">Create your first class to get started.</p>
                  <button
                    type="button"
                    onClick={() => setCreateOpen(true)}
                    className="mt-4 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500"
                  >
                    + Create class
                  </button>
                </div>
              ) : (
                <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                      <thead>
                        <tr className="border-b border-slate-200 bg-slate-50">
                          <th className="px-4 py-3 font-medium text-slate-900">Name</th>
                          <th className="px-4 py-3 font-medium text-slate-900">Site</th>
                          <th className="hidden sm:table-cell px-4 py-3 font-medium text-slate-900">Province</th>
                          <th className="hidden sm:table-cell px-4 py-3 font-medium text-slate-900">Game type</th>
                          <th className="hidden md:table-cell px-4 py-3 font-medium text-slate-900">Start</th>
                          <th className="hidden md:table-cell px-4 py-3 font-medium text-slate-900">End</th>
                          <th className="px-4 py-3" />
                        </tr>
                      </thead>
                      <tbody>
                        {active.map(c => (
                          <tr
                            key={c.id}
                            className="border-b border-slate-100 hover:bg-slate-50 cursor-pointer"
                            onClick={() => navigate(`/classes/${classSlug(c.name)}`)}
                          >
                            <td className="px-4 py-3 font-medium text-slate-900">{c.name}</td>
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
            {archived.length > 0 && (
              <div>
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Archived
                </h3>
                <div className="rounded-xl border border-slate-200 bg-white overflow-hidden opacity-80">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                      <thead>
                        <tr className="border-b border-slate-200 bg-slate-50">
                          <th className="px-4 py-3 font-medium text-slate-900">Name</th>
                          <th className="px-4 py-3 font-medium text-slate-900">Site</th>
                          <th className="hidden sm:table-cell px-4 py-3 font-medium text-slate-900">Province</th>
                          <th className="hidden md:table-cell px-4 py-3 font-medium text-slate-900">Start</th>
                          <th className="hidden md:table-cell px-4 py-3 font-medium text-slate-900">End</th>
                          <th className="px-4 py-3" />
                        </tr>
                      </thead>
                      <tbody>
                        {archived.map(c => (
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
    </div>
  )
}
