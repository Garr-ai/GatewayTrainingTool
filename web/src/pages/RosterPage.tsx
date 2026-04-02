import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../lib/apiClient'
import { SkeletonTable } from '../components/Skeleton'
import { Pagination } from '../components/Pagination'

type RosterRow = { id: string; full_name: string | null; email: string }

interface RosterPageProps {
  role: 'trainee' | 'trainer'
  title: string
  subtitle: string
}

const PAGE_SIZE = 25

export function RosterPage({ role, title, subtitle }: RosterPageProps) {
  const navigate = useNavigate()
  const [rows, setRows] = useState<RosterRow[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(0)
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const fetchRows = useCallback(async (q: string, p: number) => {
    setLoading(true)
    try {
      const res = await api.profiles.searchPaginated({
        role,
        search: q || undefined,
        page: p,
        limit: PAGE_SIZE,
      })
      setRows(res.data as RosterRow[])
      setTotal(res.total)
    } catch (err) {
      console.error('fetchRows error:', (err as Error).message)
    } finally {
      setLoading(false)
    }
  }, [role])

  useEffect(() => {
    setPage(0)
    fetchRows('', 0)
  }, [role, fetchRows])

  function handleSearch(value: string) {
    setSearch(value)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      setPage(0)
      fetchRows(value, 0)
    }, 300)
  }

  function handlePageChange(newPage: number) {
    setPage(newPage)
    fetchRows(search, newPage)
  }

  const itemLabel = role === 'trainer' ? 'trainer' : 'student'

  return (
    <div className="flex flex-col h-full min-h-0">
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 flex-shrink-0">
        <div>
          <h2 className="text-xl font-bold text-slate-100">
            {title}
            {!loading && total > 0 && (
              <span className="ml-1.5 text-sm font-normal text-slate-500">({total})</span>
            )}
          </h2>
          <p className="mt-0.5 text-sm text-slate-300">{subtitle}</p>
        </div>
        <input
          type="search"
          placeholder="Search by name or email…"
          value={search}
          onChange={e => handleSearch(e.target.value)}
          className="w-full sm:w-64 bg-gw-elevated border border-white/10 rounded-md px-3 py-2 text-sm text-slate-200 placeholder:text-slate-500 outline-none focus:border-gw-blue/40 focus:ring-2 focus:ring-gw-blue/15"
        />
      </header>

      <div className="mt-4 flex-1 min-h-0 overflow-auto">
        {loading ? (
          <SkeletonTable rows={5} cols={2} />
        ) : rows.length === 0 ? (
          <div className="bg-gw-surface rounded-[10px] p-10 text-center">
            <p className="text-sm text-slate-300">
              {search ? `No ${title.toLowerCase()} match your search.` : `No ${title.toLowerCase()} found.`}
            </p>
          </div>
        ) : (
          <div className="bg-gw-surface rounded-[10px] overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="bg-white/[0.02] border-b border-white/[0.06]">
                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">Name</th>
                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">Email</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(r => (
                    <tr
                      key={r.id}
                      className={`border-b border-white/[0.03] hover:bg-gw-elevated transition-colors duration-100${role === 'trainee' ? ' cursor-pointer' : ''}`}
                      onClick={role === 'trainee' ? () => navigate(`/students/progress/${encodeURIComponent(r.email)}`) : undefined}
                    >
                      <td className="px-4 py-3 font-medium text-slate-200">{r.full_name ?? '—'}</td>
                      <td className="px-4 py-3 text-slate-400">{r.email}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="px-4 py-2 border-t border-white/[0.03]">
              <Pagination
                page={page}
                limit={PAGE_SIZE}
                total={total}
                onPageChange={handlePageChange}
                itemLabel={itemLabel}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
