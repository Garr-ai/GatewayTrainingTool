import { useState, useEffect, useRef } from 'react'
import { api } from '../lib/apiClient'

type RosterRow = { id: string; full_name: string | null; email: string }

interface RosterPageProps {
  role: 'trainee' | 'trainer'
  title: string
  subtitle: string
}

export function RosterPage({ role, title, subtitle }: RosterPageProps) {
  const [rows, setRows] = useState<RosterRow[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  async function fetchRows(q: string) {
    setLoading(true)
    try {
      const data = await api.profiles.search({ role, search: q || undefined })
      setRows(data as RosterRow[])
    } catch (err) {
      console.error('fetchRows error:', (err as Error).message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchRows('')
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [role])

  function handleSearch(value: string) {
    setSearch(value)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => fetchRows(value), 300)
  }

  return (
    <div className="flex flex-col h-full min-h-0">
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 flex-shrink-0">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
          <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p>
        </div>
        <input
          type="search"
          placeholder="Search by name or email…"
          value={search}
          onChange={e => handleSearch(e.target.value)}
          className="w-full sm:w-64 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-gw-blue focus:outline-none focus:ring-1 focus:ring-gw-blue"
        />
      </header>

      <div className="mt-4 flex-1 min-h-0 overflow-auto">
        {loading ? (
          <p className="text-sm text-slate-500">Loading…</p>
        ) : rows.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-10 text-center">
            <p className="text-sm text-slate-600">
              {search ? `No ${title.toLowerCase()} match your search.` : `No ${title.toLowerCase()} found.`}
            </p>
          </div>
        ) : (
          <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-gw-dark">
                    <th className="px-4 py-3 font-medium text-white">Name</th>
                    <th className="px-4 py-3 font-medium text-white">Email</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(r => (
                    <tr key={r.id} className="border-b border-slate-100 hover:bg-slate-50">
                      <td className="px-4 py-3 font-medium text-gw-dark">{r.full_name ?? '—'}</td>
                      <td className="px-4 py-3 text-slate-600">{r.email}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {!search && (
              <p className="px-4 py-2 text-xs text-slate-400 border-t border-slate-100">
                Showing first 25 — use search to find more
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
