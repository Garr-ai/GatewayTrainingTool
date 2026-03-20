/**
 * pages/ClassDetailPage.tsx — Tabbed class detail view
 *
 * Receives a class name (reconstructed from the URL slug by ClassDetailView),
 * fetches the class record from the API, and renders a tabbed interface for
 * managing all aspects of that class.
 *
 * Tabs:
 *   overview      — Summary cards with class metadata (ClassOverviewSection)
 *   drills        — Drills and tests definition (ClassDrillsSection)
 *   schedule      — Per-group time slot management (ClassScheduleSection)
 *   trainers      — Trainer assignment and editing (ClassTrainersSection)
 *   students      — Enrollment management (ClassStudentsSection)
 *   dailyReports  — Daily report creation and viewing (ClassReportsSection mode="reports")
 *   hours         — Hour logging for payroll (ClassReportsSection mode="hours")
 *
 * Note: ClassReportsSection handles two tabs (dailyReports and hours) using
 * a `mode` prop to switch between its two sub-views, since both share the
 * same loaded state (trainers, enrollments, reports, and hours are all fetched once).
 *
 * If the class is not found (404 from the API), an error state is shown.
 */

import { useEffect, useState } from 'react'
import { api } from '../lib/apiClient'
import type { Class } from '../types'
import { ClassOverviewSection } from './ClassDetail/ClassOverviewSection'
import { ClassDrillsSection } from './ClassDetail/ClassDrillsSection'
import { ClassScheduleSection } from './ClassDetail/ClassScheduleSection'
import { ClassTrainersSection } from './ClassDetail/ClassTrainersSection'
import { ClassStudentsSection } from './ClassDetail/ClassStudentsSection'
import { ClassReportsSection } from './ClassDetail/ClassReportsSection'

interface ClassDetailPageProps {
  className: string  // Display name of the class (e.g. "BJ APR 01"), not the UUID
}

/** The available tab identifiers for the class detail page. */
type ClassDetailTab =
  | 'overview'
  | 'drills'
  | 'schedule'
  | 'trainers'
  | 'students'
  | 'dailyReports'
  | 'hours'

export function ClassDetailPage({ className }: ClassDetailPageProps) {
  // The full class record fetched from the API
  const [classData, setClassData] = useState<Class | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  // Which tab is currently active; defaults to overview on load
  const [activeTab, setActiveTab] = useState<ClassDetailTab>('overview')

  useEffect(() => {
    /**
     * Fetches the class by display name. The `getByName` endpoint performs
     * a case-sensitive exact match on the class name in the database.
     * Re-runs if `className` changes (e.g. if the route param changes).
     */
    async function loadClass() {
      setLoading(true)
      setError(null)
      try {
        const data = await api.classes.getByName(className)
        setClassData(data)
      } catch (err) {
        console.error('loadClass error:', (err as Error).message)
        setError('Unable to load class.')
        setClassData(null)
      } finally {
        setLoading(false)
      }
    }

    loadClass()
  }, [className])  // Re-fetch if the class name in the URL changes

  if (loading) {
    return <div className="text-sm text-slate-500">Loading class…</div>
  }

  if (error || !classData) {
    return (
      <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
        {error ?? 'Class not found.'}
      </div>
    )
  }

  const tabs: { id: ClassDetailTab; label: string }[] = [
    { id: 'overview', label: 'Overview' },
    { id: 'drills', label: 'Drills & tests' },
    { id: 'schedule', label: 'Schedule' },
    { id: 'trainers', label: 'Trainers' },
    { id: 'students', label: 'Students' },
    { id: 'dailyReports', label: 'Daily reports' },
    { id: 'hours', label: 'Logged hours' },
  ]

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="mb-4 flex flex-col sm:flex-row sm:items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">{classData.name}</h2>
          <p className="mt-0.5 text-xs text-slate-500">
            {classData.site} • {classData.province} • {classData.game_type ?? 'No game type'} •{' '}
            {classData.start_date} – {classData.end_date}
          </p>
          {classData.description && (
            <p className="mt-1 text-xs text-slate-500 max-w-xl">{classData.description}</p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:border-slate-400"
          >
            Edit class
          </button>
        </div>
      </header>

      <div className="flex-shrink-0 border-b border-slate-200 mb-3 overflow-x-auto">
        <nav className="-mb-px flex gap-2 text-xs whitespace-nowrap" aria-label="Class detail sections">
          {tabs.map(tab => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`inline-flex items-center rounded-t-lg border-b-2 px-3 py-2 font-medium ${
                activeTab === tab.id
                  ? 'border-gw-blue text-gw-blue bg-blue-50'
                  : 'border-transparent text-slate-500 hover:text-gw-dark hover:bg-slate-50'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* All tabs stay mounted (hidden via CSS) so switching tabs doesn't re-fetch data */}
      <div className="flex-1 min-h-0 overflow-auto">
        <div className={activeTab === 'overview' ? '' : 'hidden'}>
          <ClassOverviewSection classData={classData} />
        </div>
        <div className={activeTab === 'drills' ? '' : 'hidden'}>
          <ClassDrillsSection classId={classData.id} className={classData.name} />
        </div>
        <div className={activeTab === 'schedule' ? '' : 'hidden'}>
          <ClassScheduleSection classId={classData.id} className={classData.name} />
        </div>
        <div className={activeTab === 'trainers' ? '' : 'hidden'}>
          <ClassTrainersSection classId={classData.id} className={classData.name} />
        </div>
        <div className={activeTab === 'students' ? '' : 'hidden'}>
          <ClassStudentsSection classId={classData.id} className={classData.name} />
        </div>
        <div className={activeTab === 'dailyReports' ? '' : 'hidden'}>
          <ClassReportsSection classId={classData.id} className={classData.name} mode="reports" />
        </div>
        <div className={activeTab === 'hours' ? '' : 'hidden'}>
          <ClassReportsSection classId={classData.id} className={classData.name} mode="hours" />
        </div>
      </div>
    </div>
  )
}
