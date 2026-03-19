import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../lib/apiClient'
import type { ClassScheduleSlot } from '../types'
import { classSlug, formatTime } from '../lib/utils'

type ScheduleRow = ClassScheduleSlot & { classes: { id: string; name: string; site: string } }

export function SchedulePage() {
  const [slots, setSlots] = useState<ScheduleRow[]>([])
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  useEffect(() => {
    async function load() {
      try {
        const data = await api.schedule.listAll()
        setSlots(data as ScheduleRow[])
      } catch (err) {
        console.error('fetchSchedule error:', (err as Error).message)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  // Group slots by date
  const grouped = slots.reduce<Record<string, ScheduleRow[]>>((acc, s) => {
    ;(acc[s.slot_date] ??= []).push(s)
    return acc
  }, {})

  const dates = Object.keys(grouped).sort()

  return (
    <div className="flex flex-col h-full min-h-0">
      <header className="flex-shrink-0">
        <h2 className="text-lg font-semibold text-slate-900">Schedule</h2>
        <p className="mt-0.5 text-xs text-slate-500">Upcoming sessions across all active classes</p>
      </header>

      <div className="mt-4 flex-1 min-h-0 overflow-auto flex flex-col gap-4">
        {loading ? (
          <p className="text-sm text-slate-500">Loading…</p>
        ) : dates.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-10 text-center">
            <p className="text-sm text-slate-600">No upcoming sessions.</p>
            <p className="mt-1 text-xs text-slate-500">Schedule slots appear here once added inside a class.</p>
          </div>
        ) : (
          dates.map(date => (
            <div key={date}>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                {new Date(date + 'T00:00:00').toLocaleDateString('en-CA', {
                  weekday: 'long',
                  month: 'long',
                  day: 'numeric',
                  year: 'numeric',
                })}
              </h3>
              <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 bg-gw-dark">
                        <th className="px-4 py-3 font-medium text-white">Class</th>
                        <th className="px-4 py-3 font-medium text-white">Time</th>
                        <th className="hidden sm:table-cell px-4 py-3 font-medium text-white">Group</th>
                        <th className="hidden md:table-cell px-4 py-3 font-medium text-white">Notes</th>
                      </tr>
                    </thead>
                    <tbody>
                      {grouped[date].map(s => (
                        <tr
                          key={s.id}
                          className="border-b border-slate-100 hover:bg-slate-50 cursor-pointer"
                          onClick={() => navigate(`/classes/${classSlug(s.classes.name)}`)}
                        >
                          <td className="px-4 py-3 font-medium text-gw-dark">{s.classes.name}</td>
                          <td className="px-4 py-3 text-slate-600 whitespace-nowrap">
                            {formatTime(s.start_time)} – {formatTime(s.end_time)}
                          </td>
                          <td className="hidden sm:table-cell px-4 py-3 text-slate-600">{s.group_label ?? '—'}</td>
                          <td className="hidden md:table-cell px-4 py-3 text-slate-500 max-w-xs truncate">{s.notes ?? '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
