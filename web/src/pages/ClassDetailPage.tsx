import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { Class } from '../types'
import { ClassOverviewSection } from './ClassDetail/ClassOverviewSection'
import { ClassDrillsSection } from './ClassDetail/ClassDrillsSection'
import { ClassScheduleSection } from './ClassDetail/ClassScheduleSection'
import { ClassTrainersSection } from './ClassDetail/ClassTrainersSection'
import { ClassStudentsSection } from './ClassDetail/ClassStudentsSection'
import { ClassReportsSection } from './ClassDetail/ClassReportsSection'

interface ClassDetailPageProps {
  className: string
}

type ClassDetailTab =
  | 'overview'
  | 'drills'
  | 'schedule'
  | 'trainers'
  | 'students'
  | 'dailyReports'
  | 'hours'

export function ClassDetailPage({ className }: ClassDetailPageProps) {
  const [classData, setClassData] = useState<Class | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<ClassDetailTab>('overview')

  useEffect(() => {
    async function loadClass() {
      setLoading(true)
      setError(null)
      const { data, error } = await supabase
        .from('classes')
        .select('*')
        .eq('name', className)
        .single()

      if (error) {
        console.error('loadClass error:', error.message)
        setError('Unable to load class.')
        setClassData(null)
      } else {
        setClassData(data as Class)
      }
      setLoading(false)
    }

    loadClass()
  }, [className])

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
      <header className="mb-4 flex items-start justify-between gap-4">
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

      <div className="flex-shrink-0 border-b border-slate-200 mb-3">
        <nav className="-mb-px flex gap-2 text-xs" aria-label="Class detail sections">
          {tabs.map(tab => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`inline-flex items-center rounded-t-lg border-b-2 px-3 py-2 font-medium ${
                activeTab === tab.id
                  ? 'border-indigo-500 text-indigo-600 bg-slate-50'
                  : 'border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      <div className="flex-1 min-h-0 overflow-auto">
        {activeTab === 'overview' && <ClassOverviewSection classData={classData} />}
        {activeTab === 'drills' && (
          <ClassDrillsSection classId={classData.id} className={classData.name} />
        )}
        {activeTab === 'schedule' && (
          <ClassScheduleSection classId={classData.id} className={classData.name} />
        )}
        {activeTab === 'trainers' && (
          <ClassTrainersSection classId={classData.id} className={classData.name} />
        )}
        {activeTab === 'students' && (
          <ClassStudentsSection classId={classData.id} className={classData.name} />
        )}
        {activeTab === 'dailyReports' && (
          <ClassReportsSection
            classId={classData.id}
            className={classData.name}
            mode="reports"
          />
        )}
        {activeTab === 'hours' && (
          <ClassReportsSection classId={classData.id} className={classData.name} mode="hours" />
        )}
      </div>
    </div>
  )
}

