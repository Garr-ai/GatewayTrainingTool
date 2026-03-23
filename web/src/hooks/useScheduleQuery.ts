import { useState, useEffect, useCallback, useRef } from 'react'
import { api, type ScheduleRow, type ScheduleListParams } from '../lib/apiClient'
import type { Province } from '../types'

export interface ScheduleFilters {
  province: Province | ''
  site: string
  class_id: string
  archived: boolean
  game_type: string
  date_from: string
  date_to: string
  group_label: string
  search: string
}

export interface ScheduleSort {
  column: string
  direction: 'asc' | 'desc'
}

const DEFAULT_FILTERS: ScheduleFilters = {
  province: '',
  site: '',
  class_id: '',
  archived: false,
  game_type: '',
  date_from: '',
  date_to: '',
  group_label: '',
  search: '',
}

const DEFAULT_SORT: ScheduleSort = { column: 'slot_date', direction: 'asc' }
const PAGE_SIZE = 50

export function useScheduleQuery() {
  const [filters, setFilters] = useState<ScheduleFilters>(DEFAULT_FILTERS)
  const [sort, setSort] = useState<ScheduleSort>(DEFAULT_SORT)
  const [page, setPage] = useState(0)
  const [slots, setSlots] = useState<ScheduleRow[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)

  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [debouncedSearch, setDebouncedSearch] = useState('')

  useEffect(() => {
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current)
    searchTimerRef.current = setTimeout(() => {
      setDebouncedSearch(filters.search)
    }, 300)
    return () => {
      if (searchTimerRef.current) clearTimeout(searchTimerRef.current)
    }
  }, [filters.search])

  const fetchSlots = useCallback(async (
    f: ScheduleFilters,
    s: ScheduleSort,
    p: number,
    search: string,
  ) => {
    setLoading(true)
    try {
      const params: ScheduleListParams = {
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
      if (f.group_label) params.group_label = f.group_label
      if (search) params.search = search

      const result = await api.schedule.listAll(params)
      setSlots(result.data)
      setTotal(result.total)
    } catch (err) {
      console.error('useScheduleQuery fetch error:', (err as Error).message)
      setSlots([])
      setTotal(0)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchSlots(filters, sort, page, debouncedSearch)
  }, [
    filters.province,
    filters.site,
    filters.class_id,
    filters.archived,
    filters.game_type,
    filters.date_from,
    filters.date_to,
    filters.group_label,
    debouncedSearch,
    sort.column,
    sort.direction,
    page,
    fetchSlots,
  ])

  const updateFilter = useCallback(<K extends keyof ScheduleFilters>(key: K, value: ScheduleFilters[K]) => {
    setFilters(prev => ({ ...prev, [key]: value }))
    setPage(0)
  }, [])

  const toggleSort = useCallback((column: string) => {
    setSort(prev => ({
      column,
      direction: prev.column === column && prev.direction === 'asc' ? 'desc' : 'asc',
    }))
    setPage(0)
  }, [])

  const resetFilters = useCallback(() => {
    setFilters(DEFAULT_FILTERS)
    setSort(DEFAULT_SORT)
    setPage(0)
  }, [])

  return {
    slots,
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
  }
}
