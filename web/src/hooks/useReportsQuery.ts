import { useState, useEffect, useCallback, useRef } from 'react'
import { api, type ReportRow, type ReportListParams } from '../lib/apiClient'
import type { Province } from '../types'

export interface ReportsFilters {
  province: Province | ''
  site: string
  class_id: string
  archived: boolean
  game_type: string
  date_from: string
  date_to: string
  search: string
  status: 'draft' | 'finalized' | ''
}

export interface ReportsSort {
  column: string
  direction: 'asc' | 'desc'
}

const DEFAULT_FILTERS: ReportsFilters = {
  province: '',
  site: '',
  class_id: '',
  archived: false,
  game_type: '',
  date_from: '',
  date_to: '',
  search: '',
  status: '',
}

const DEFAULT_SORT: ReportsSort = { column: 'report_date', direction: 'desc' }
const PAGE_SIZE = 50

export function useReportsQuery() {
  const [filters, setFilters] = useState<ReportsFilters>(DEFAULT_FILTERS)
  const [sort, setSort] = useState<ReportsSort>(DEFAULT_SORT)
  const [page, setPage] = useState(0)
  const [reports, setReports] = useState<ReportRow[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [refreshKey, setRefreshKey] = useState(0)

  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // The debounced search value that actually triggers fetches
  const [debouncedSearch, setDebouncedSearch] = useState('')

  // Debounce the search filter
  useEffect(() => {
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current)
    searchTimerRef.current = setTimeout(() => {
      setDebouncedSearch(filters.search)
    }, 300)
    return () => {
      if (searchTimerRef.current) clearTimeout(searchTimerRef.current)
    }
  }, [filters.search])

  const fetchReports = useCallback(async (
    f: ReportsFilters,
    s: ReportsSort,
    p: number,
    search: string,
  ) => {
    setLoading(true)
    try {
      const params: ReportListParams = {
        sort_by: s.column,
        sort_dir: s.direction,
        page: p,
        limit: PAGE_SIZE,
        archived: f.archived,
      }
      if (f.province) params.province = f.province
      if (f.site) params.site = f.site
      if (f.class_id) params.class_id = f.class_id
      if (f.game_type) params.game_type = f.game_type
      if (f.date_from) params.date_from = f.date_from
      if (f.date_to) params.date_to = f.date_to
      if (search) params.search = search
      if (f.status) params.status = f.status

      const result = await api.reports.listAll(params)
      setReports(result.data)
      setTotal(result.total)
    } catch (err) {
      console.error('useReportsQuery fetch error:', (err as Error).message)
      setReports([])
      setTotal(0)
    } finally {
      setLoading(false)
    }
  }, [])

  // Fetch on mount and whenever filters/sort/page/debouncedSearch change
  useEffect(() => {
    fetchReports(filters, sort, page, debouncedSearch)
  }, [
    filters.province,
    filters.site,
    filters.class_id,
    filters.archived,
    filters.game_type,
    filters.date_from,
    filters.date_to,
    filters.status,
    debouncedSearch,
    sort.column,
    sort.direction,
    page,
    fetchReports,
    refreshKey,
  ])

  const refetch = useCallback(() => setRefreshKey(k => k + 1), [])

  const updateFilter = useCallback(<K extends keyof ReportsFilters>(key: K, value: ReportsFilters[K]) => {
    setFilters(prev => ({ ...prev, [key]: value }))
    setPage(0) // Reset to first page on any filter change
  }, [])

  const toggleSort = useCallback((column: string) => {
    setSort(prev => ({
      column,
      direction: prev.column === column && prev.direction === 'desc' ? 'asc' : 'desc',
    }))
    setPage(0)
  }, [])

  const resetFilters = useCallback(() => {
    setFilters(DEFAULT_FILTERS)
    setSort(DEFAULT_SORT)
    setPage(0)
  }, [])

  return {
    reports,
    total,
    page,
    limit: PAGE_SIZE,
    loading,
    filters,
    sort,
    setFilter: updateFilter,
    setSort: toggleSort,
    setPage,
    resetFilters,
    refetch,
  }
}
