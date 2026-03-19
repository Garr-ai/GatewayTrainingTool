import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../lib/apiClient'
import type { Class } from '../types'
import { CreateClassModal } from '../components/CreateClassModal'
import { PROVINCES } from '../types'
import { useAuth } from '../contexts/AuthContext'

export function ClassesPage() {
  const { email, signOut } = useAuth()
  const [classes, setClasses] = useState<Class[]>([])
  const [loading, setLoading] = useState(true)

  const [createOpen, setCreateOpen] = useState(false)

  async function fetchClasses() {
    setLoading(true)
    try {
      const data = await api.classes.list()
      setClasses(data)
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

  return (
    <div className="flex flex-col h-full min-h-0">
      <header className="flex items-center justify-between gap-4 flex-shrink-0">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Classes</h2>
          <p className="mt-0.5 text-xs text-slate-500">Create and manage training classes</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-slate-600">{email}</span>
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

      <div className="mt-4 flex-1 min-h-0 overflow-auto">
        {loading ? (
          <p className="text-sm text-slate-500">Loading classes…</p>
        ) : classes.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
            <p className="text-sm text-slate-600">No classes yet</p>
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
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50">
                  <th className="px-4 py-3 font-medium text-slate-900">Name</th>
                  <th className="px-4 py-3 font-medium text-slate-900">Site</th>
                  <th className="px-4 py-3 font-medium text-slate-900">Province</th>
                  <th className="px-4 py-3 font-medium text-slate-900">Game type</th>
                  <th className="px-4 py-3 font-medium text-slate-900">Start</th>
                  <th className="px-4 py-3 font-medium text-slate-900">End</th>
                </tr>
              </thead>
              <tbody>
                {classes.map(c => (
                  <tr
                    key={c.id}
                    className="border-b border-slate-100 hover:bg-slate-50 cursor-pointer"
                    onClick={() => navigate(`/classes/${classSlug(c.name)}`)}
                  >
                    <td className="px-4 py-3 font-medium text-slate-900">{c.name}</td>
                    <td className="px-4 py-3 text-slate-600">{c.site}</td>
                    <td className="px-4 py-3 text-slate-600">{provinceLabel(c.province)}</td>
                    <td className="px-4 py-3 text-slate-600">{c.game_type ?? '—'}</td>
                    <td className="px-4 py-3 text-slate-600">{c.start_date}</td>
                    <td className="px-4 py-3 text-slate-600">{c.end_date}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {createOpen && (
        <CreateClassModal onClose={() => setCreateOpen(false)} onSuccess={fetchClasses} />
      )}
    </div>
  )
}
