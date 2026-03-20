import { useEffect, useState } from 'react'
import { api } from '../../lib/apiClient'
import type { ClassScheduleSlot, ClassTrainer } from '../../types'

interface ClassScheduleSectionProps {
  classId: string
  className: string
}

export function ClassScheduleSection({ classId, className }: ClassScheduleSectionProps) {
  const [slots, setSlots] = useState<ClassScheduleSlot[]>([])
  const [trainers, setTrainers] = useState<ClassTrainer[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [editingSlot, setEditingSlot] = useState<ClassScheduleSlot | null>(null)
  const [slotDate, setSlotDate] = useState('')
  const [startTime, setStartTime] = useState('')
  const [endTime, setEndTime] = useState('')
  const [notes, setNotes] = useState('')
  const [trainerId, setTrainerId] = useState<string>('')
  const [groupLabel, setGroupLabel] = useState('')
  const [saving, setSaving] = useState(false)

  async function loadSlots() {
    setLoading(true)
    setError(null)
    try {
      const data = await api.schedule.list(classId)
      setSlots(data)
    } catch (err) {
      console.error('loadSlots error:', (err as Error).message)
      setError('Unable to load schedule for this class.')
      setSlots([])
    } finally {
      setLoading(false)
    }
  }

  async function loadTrainers() {
    try {
      const data = await api.trainers.list(classId)
      setTrainers(data)
    } catch {
      // non-critical
    }
  }

  useEffect(() => {
    loadSlots()
    loadTrainers()
  }, [classId])

  function openAddForm() {
    setEditingSlot(null)
    setSlotDate('')
    setStartTime('')
    setEndTime('')
    setNotes('')
    setTrainerId('')
    setGroupLabel('')
    setFormOpen(true)
  }

  function openEditForm(slot: ClassScheduleSlot) {
    setEditingSlot(slot)
    setSlotDate(slot.slot_date)
    setStartTime(slot.start_time)
    setEndTime(slot.end_time)
    setNotes(slot.notes ?? '')
    setTrainerId(slot.trainer_id ?? '')
    setGroupLabel(slot.group_label ?? '')
    setFormOpen(true)
  }

  function closeForm() {
    setFormOpen(false)
    setEditingSlot(null)
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!slotDate || !startTime || !endTime) return
    setSaving(true)
    setError(null)

    const payload = {
      slot_date: slotDate,
      start_time: startTime,
      end_time: endTime,
      notes: notes.trim() || null,
      trainer_id: trainerId || null,
      group_label: groupLabel.trim() || null,
    }

    try {
      if (editingSlot) {
        await api.schedule.update(classId, editingSlot.id, payload)
      } else {
        await api.schedule.create(classId, payload)
      }
      closeForm()
      loadSlots()
    } catch (err) {
      console.error('saveSlot error:', (err as Error).message)
      setError((err as Error).message)
    } finally {
      setSaving(false)
    }
  }

  async function handleRemove(id: string) {
    try {
      await api.schedule.delete(classId, id)
      loadSlots()
    } catch (err) {
      console.error('removeSlot error:', (err as Error).message)
      setError((err as Error).message)
    }
  }

  function trainerName(id: string | null) {
    if (!id) return '—'
    return trainers.find(t => t.id === id)?.trainer_name ?? '—'
  }

  return (
    <section className="rounded-xl bg-white p-4 shadow-sm">
      <header className="flex items-center justify-between mb-3">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">Schedule</h3>
          <p className="mt-0.5 text-xs text-slate-500">
            Schedule trainers and student groups for different times. Assign trainers from the
            Trainers tab first.
          </p>
        </div>
        <button
          type="button"
          onClick={openAddForm}
          className="rounded-md bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-500"
        >
          + Add schedule slot
        </button>
      </header>

      {error && (
        <p className="mb-3 rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-700" role="alert">
          {error}
        </p>
      )}

      {formOpen && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg rounded-xl bg-white shadow-xl p-4">
            <header className="mb-3 flex items-center justify-between gap-3">
              <div>
                <h4 className="text-sm font-semibold text-slate-900">
                  {editingSlot ? 'Edit schedule slot' : 'Add schedule slot'}
                </h4>
                <p className="mt-0.5 text-[11px] text-slate-500">
                  Set date, time range, trainer, and student group for this slot.
                </p>
              </div>
              <button
                type="button"
                onClick={closeForm}
                className="rounded-md border border-slate-300 px-2 py-1 text-[11px] text-slate-700 hover:bg-slate-50"
              >
                Close
              </button>
            </header>

            <form onSubmit={handleSave} className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
              <div>
                <label className="block font-medium text-slate-700">
                  Date
                  <input
                    type="date"
                    value={slotDate}
                    onChange={e => setSlotDate(e.target.value)}
                    className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5 text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    required
                  />
                </label>
              </div>
              <div className="flex gap-2">
                <label className="flex-1 block font-medium text-slate-700">
                  Start time
                  <input
                    type="time"
                    value={startTime}
                    onChange={e => setStartTime(e.target.value)}
                    className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5 text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    required
                  />
                </label>
                <label className="flex-1 block font-medium text-slate-700">
                  End time
                  <input
                    type="time"
                    value={endTime}
                    onChange={e => setEndTime(e.target.value)}
                    className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5 text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    required
                  />
                </label>
              </div>
              <div>
                <label className="block font-medium text-slate-700">
                  Trainer
                  <select
                    value={trainerId}
                    onChange={e => setTrainerId(e.target.value)}
                    className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5 text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  >
                    <option value="">— None —</option>
                    {trainers.map(t => (
                      <option key={t.id} value={t.id}>
                        {t.trainer_name} ({t.role})
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <div>
                <label className="block font-medium text-slate-700">
                  Student group (A/B/C)
                  <input
                    type="text"
                    value={groupLabel}
                    onChange={e => setGroupLabel(e.target.value)}
                    className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5 text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    placeholder="e.g. A"
                  />
                </label>
              </div>
              <div className="md:col-span-2">
                <label className="block font-medium text-slate-700">
                  Notes
                  <textarea
                    value={notes}
                    onChange={e => setNotes(e.target.value)}
                    rows={2}
                    className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5 text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    placeholder="Optional notes"
                  />
                </label>
              </div>
              <div className="md:col-span-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={closeForm}
                  className="rounded-md border border-slate-300 px-3 py-1.5 text-[11px] text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-md bg-indigo-600 px-3 py-1.5 text-[11px] font-medium text-white hover:bg-indigo-500 disabled:opacity-60"
                >
                  {saving ? 'Saving…' : editingSlot ? 'Save changes' : 'Add slot'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {loading ? (
        <p className="text-xs text-slate-500">Loading schedule…</p>
      ) : slots.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-center text-xs text-slate-500">
          No schedule slots yet for <span className="font-medium text-slate-700">{className}</span>.
          Add slots to assign trainers and student groups to specific times.
        </div>
      ) : (
        <div className="rounded-lg border border-slate-200 overflow-hidden">
          <table className="w-full text-xs">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-3 py-2 text-left font-medium text-slate-900">Date</th>
                <th className="px-3 py-2 text-left font-medium text-slate-900">Start</th>
                <th className="px-3 py-2 text-left font-medium text-slate-900">End</th>
                <th className="px-3 py-2 text-left font-medium text-slate-900">Trainer</th>
                <th className="px-3 py-2 text-left font-medium text-slate-900">Group</th>
                <th className="px-3 py-2 text-left font-medium text-slate-900">Notes</th>
                <th className="px-3 py-2 text-right font-medium text-slate-900">Actions</th>
              </tr>
            </thead>
            <tbody>
              {slots.map(slot => (
                <tr
                  key={slot.id}
                  className="border-b border-slate-100 hover:bg-slate-50 cursor-pointer"
                  onClick={() => openEditForm(slot)}
                >
                  <td className="px-3 py-2 text-slate-900">{slot.slot_date}</td>
                  <td className="px-3 py-2 text-slate-600">{slot.start_time}</td>
                  <td className="px-3 py-2 text-slate-600">{slot.end_time}</td>
                  <td className="px-3 py-2 text-slate-600">{trainerName(slot.trainer_id)}</td>
                  <td className="px-3 py-2 text-slate-600">{slot.group_label ?? '—'}</td>
                  <td
                    className="px-3 py-2 text-slate-600 max-w-[120px] truncate"
                    title={slot.notes ?? undefined}
                  >
                    {slot.notes ?? '—'}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <button
                      type="button"
                      onClick={e => {
                        e.stopPropagation()
                        handleRemove(slot.id)
                      }}
                      className="rounded-md border border-slate-300 px-2 py-1 text-[11px] text-slate-700 hover:bg-slate-50"
                    >
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
