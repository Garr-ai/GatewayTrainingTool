import { useState, useEffect, useCallback } from 'react'
import { api } from '../lib/apiClient'
import type { PayrollRow, Province } from '../types'

export interface PayrollFilters {
  province: Province | ''
  site: string
  class_id: string
  date_from: string
  date_to: string
}

const DEFAULT_FILTERS: PayrollFilters = {
  province: '',
  site: '',
  class_id: '',
  date_from: '',
  date_to: '',
}

const PAGE_SIZE = 50

export function usePayrollQuery(personType: 'trainer' | 'student') {
  const [filters, setFilters] = useState<PayrollFilters>(DEFAULT_FILTERS)
  const [page, setPage] = useState(0)
  const [rows, setRows] = useState<PayrollRow[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)

  const fetchData = useCallback(async (f: PayrollFilters, p: number) => {
    setLoading(true)
    try {
      const params = {
        page: p,
        limit: PAGE_SIZE,
        ...(f.province ? { province: f.province } : {}),
        ...(f.site ? { site: f.site } : {}),
        ...(f.class_id ? { class_id: f.class_id } : {}),
        ...(f.date_from ? { date_from: f.date_from } : {}),
        ...(f.date_to ? { date_to: f.date_to } : {}),
      }
      const fn = personType === 'trainer' ? api.payroll.trainers : api.payroll.students
      const result = await fn(params)
      setRows(result.data)
      setTotal(result.total)
    } catch (err) {
      console.error('usePayrollQuery fetch error:', (err as Error).message)
      setRows([])
      setTotal(0)
    } finally {
      setLoading(false)
    }
  }, [personType])

  useEffect(() => {
    fetchData(filters, page)
  }, [
    filters.province,
    filters.site,
    filters.class_id,
    filters.date_from,
    filters.date_to,
    page,
    fetchData,
  ])

  const updateFilter = useCallback(<K extends keyof PayrollFilters>(key: K, value: PayrollFilters[K]) => {
    setFilters(prev => ({ ...prev, [key]: value }))
    setPage(0)
  }, [])

  const resetFilters = useCallback(() => {
    setFilters(DEFAULT_FILTERS)
    setPage(0)
  }, [])

  async function exportCsv() {
    const params = {
      ...(filters.province ? { province: filters.province } : {}),
      ...(filters.site ? { site: filters.site } : {}),
      ...(filters.class_id ? { class_id: filters.class_id } : {}),
      ...(filters.date_from ? { date_from: filters.date_from } : {}),
      ...(filters.date_to ? { date_to: filters.date_to } : {}),
    }
    if (personType === 'trainer') {
      await api.payroll.trainersCsv(params)
    } else {
      await api.payroll.studentsCsv(params)
    }
  }

  return {
    rows,
    total,
    page,
    limit: PAGE_SIZE,
    loading,
    filters,
    setFilter: updateFilter,
    setPage,
    resetFilters,
    exportCsv,
  }
}
