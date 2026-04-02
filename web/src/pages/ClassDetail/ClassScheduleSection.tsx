/**
 * pages/ClassDetail/ClassScheduleSection.tsx — Schedule slot management tab
 *
 * Allows coordinators to create, edit, and delete time-slot entries for a class.
 * Schedule slots define when a specific trainer will work with a specific student
 * group (A, B, C) on a given date and time range.
 *
 * The component fetches both schedule slots and trainers in parallel on mount:
 *   - Slots are the primary data (the schedule table)
 *   - Trainers are loaded so the slot form can offer a "Trainer" dropdown; this
 *     is non-critical and failures are silently ignored
 *
 * The form is rendered as a full-screen modal overlay (not inline) since it needs
 * to be accessible above the table without shifting layout.
 *
 * Clicking a row in the schedule table opens the edit form pre-populated with
 * that slot's data. Clicking the Remove button deletes without a confirmation
 * dialog (low-stakes operation compared to deleting a class or report).
 *
 * The `trainerName` helper resolves a `trainer_id` (class_trainers.id) to a
 * display name for the schedule table, falling back to em-dash if not found.
 */

import { useState } from 'react'
import { api } from '../../lib/apiClient'
import { useClassDetail } from '../../contexts/ClassDetailContext'
import { SkeletonTable } from '../../components/Skeleton'
import type { ClassScheduleSlot } from '../../types'

interface ClassScheduleSectionProps {
  classId: string   // UUID of the class
  className: string // Display name — used in the empty-state message
}

export function ClassScheduleSection({ classId, className }: ClassScheduleSectionProps) {
  const { schedule: slots, trainers, loading, refreshSchedule } = useClassDetail()
  const [error, setError] = useState<string | null>(null)
  // Controls the slot form modal (both add and edit use the same form)
  const [formOpen, setFormOpen] = useState(false)
  // Null when adding a new slot; set to the slot being edited when in edit mode
  const [editingSlot, setEditingSlot] = useState<ClassScheduleSlot | null>(null)
  // Form field state
  const [slotDate, setSlotDate] = useState('')
  const [startTime, setStartTime] = useState('')
  const [endTime, setEndTime] = useState('')
  const [notes, setNotes] = useState('')
  const [trainerId, setTrainerId] = useState<string>('')
  const [groupLabel, setGroupLabel] = useState('')
  const [saving, setSaving] = useState(false)

  /** Resets form fields and opens the modal in "add new slot" mode. */
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

  /** Pre-fills the form with an existing slot's data and opens it in "edit" mode. */
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

  /** Closes the modal and clears the editing state. */
  function closeForm() {
    setFormOpen(false)
    setEditingSlot(null)
  }

  /**
   * Handles both create and update depending on whether `editingSlot` is set.
   * Empty string fields are converted to null before sending to the API.
   */
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
      refreshSchedule()
    } catch (err) {
      console.error('saveSlot error:', (err as Error).message)
      setError((err as Error).message)
    } finally {
      setSaving(false)
    }
  }

  /** Deletes a schedule slot without confirmation (low-risk action). */
  async function handleRemove(id: string) {
    try {
      await api.schedule.delete(classId, id)
      refreshSchedule()
    } catch (err) {
      console.error('removeSlot error:', (err as Error).message)
      setError((err as Error).message)
    }
  }

  /**
   * Resolves a trainer ID to a display name for the schedule table.
   * Returns em-dash if no trainer is assigned or the ID can't be found.
   */
  function trainerName(id: string | null) {
    if (!id) return '—'
    return trainers.find(t => t.id === id)?.trainer_name ?? '—'
  }

  const fieldClass = 'mt-1 w-full bg-gw-elevated border border-white/10 rounded-md px-2 py-1.5 text-xs text-slate-200 placeholder:text-slate-500 outline-none focus:border-gw-blue/40 focus:ring-2 focus:ring-gw-blue/15'

  return (
    <section className="bg-gw-surface rounded-[10px] p-4">
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">Schedule</h3>
          <p className="mt-0.5 text-xs text-slate-500">
            Schedule trainers and student groups for different times. Assign trainers from the Trainers tab first.
          </p>
        </div>
        <button type="button" onClick={openAddForm} className="rounded-md bg-gradient-to-r from-gw-blue to-gw-teal text-white font-semibold px-3 py-1.5 text-xs hover:brightness-110 transition-all duration-150 self-start sm:self-auto flex-shrink-0">
          + Add schedule slot
        </button>
      </header>

      {error && (
        <p className="mb-3 rounded-md bg-rose-500/10 border border-rose-500/25 px-3 py-2 text-xs text-rose-400" role="alert">
          {error}
        </p>
      )}

      {formOpen && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-lg bg-gw-surface border border-white/[0.08] rounded-[14px] shadow-2xl p-4">
            <header className="mb-3 flex items-center justify-between gap-3">
              <div>
                <h4 className="text-sm font-bold text-slate-100">{editingSlot ? 'Edit schedule slot' : 'Add schedule slot'}</h4>
                <p className="mt-0.5 text-[11px] text-slate-500">Set date, time range, trainer, and student group for this slot.</p>
              </div>
              <button type="button" onClick={closeForm} className="w-7 h-7 rounded-md bg-white/[0.06] text-slate-500 hover:text-slate-300 flex items-center justify-center transition-colors" aria-label="Close">
                <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </header>

            <form onSubmit={handleSave} className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Date
                  <input type="date" value={slotDate} onChange={e => setSlotDate(e.target.value)} className={fieldClass} required />
                </label>
              </div>
              <div className="flex gap-2">
                <label className="flex-1 block text-xs font-medium text-slate-400 mb-1">Start time
                  <input type="time" value={startTime} onChange={e => setStartTime(e.target.value)} className={fieldClass} required />
                </label>
                <label className="flex-1 block text-xs font-medium text-slate-400 mb-1">End time
                  <input type="time" value={endTime} onChange={e => setEndTime(e.target.value)} className={fieldClass} required />
                </label>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Trainer
                  <select value={trainerId} onChange={e => setTrainerId(e.target.value)} className={fieldClass}>
                    <option value="">— None —</option>
                    {trainers.map(t => (
                      <option key={t.id} value={t.id}>{t.trainer_name} ({t.role})</option>
                    ))}
                  </select>
                </label>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Student group (A/B/C)
                  <input type="text" value={groupLabel} onChange={e => setGroupLabel(e.target.value)} className={fieldClass} placeholder="e.g. A" />
                </label>
              </div>
              <div className="md:col-span-2">
                <label className="block text-xs font-medium text-slate-400 mb-1">Notes
                  <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} className={fieldClass} placeholder="Optional notes" />
                </label>
              </div>
              <div className="md:col-span-2 flex justify-end gap-2">
                <button type="button" onClick={closeForm} className="rounded-md bg-gw-surface text-slate-200 border border-white/10 px-3 py-1.5 text-[11px] font-semibold hover:bg-gw-elevated transition-colors">Cancel</button>
                <button type="submit" disabled={saving} className="rounded-md bg-gradient-to-r from-gw-blue to-gw-teal text-white px-3 py-1.5 text-[11px] font-semibold hover:brightness-110 transition-all disabled:opacity-60">
                  {saving ? 'Saving…' : editingSlot ? 'Save changes' : 'Add slot'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {loading ? (
        <SkeletonTable rows={3} cols={7} />
      ) : slots.length === 0 ? (
        <div className="bg-gw-elevated rounded-[10px] px-4 py-6 text-center text-xs text-slate-500">
          No schedule slots yet for <span className="font-medium text-slate-300">{className}</span>.
          Add slots to assign trainers and student groups to specific times.
        </div>
      ) : (
        <div className="bg-gw-elevated rounded-[10px] overflow-x-auto">
          <table className="min-w-full text-xs">
            <thead>
              <tr className="bg-white/[0.02] border-b border-white/[0.06]">
                <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Date</th>
                <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Start</th>
                <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">End</th>
                <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Trainer</th>
                <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Group</th>
                <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Notes</th>
                <th className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">Actions</th>
              </tr>
            </thead>
            <tbody>
              {slots.map(slot => (
                <tr key={slot.id} className="border-b border-white/[0.03] hover:bg-gw-surface cursor-pointer transition-colors duration-100" onClick={() => openEditForm(slot)}>
                  <td className="px-3 py-2 text-slate-200">{slot.slot_date}</td>
                  <td className="px-3 py-2 text-slate-400">{slot.start_time}</td>
                  <td className="px-3 py-2 text-slate-400">{slot.end_time}</td>
                  <td className="px-3 py-2 text-slate-400">{trainerName(slot.trainer_id)}</td>
                  <td className="px-3 py-2 text-slate-400">{slot.group_label ?? '—'}</td>
                  <td className="px-3 py-2 text-slate-400 max-w-[120px] truncate" title={slot.notes ?? undefined}>{slot.notes ?? '—'}</td>
                  <td className="px-3 py-2 text-right">
                    <button type="button" onClick={e => { e.stopPropagation(); handleRemove(slot.id) }} className="rounded-md bg-rose-500/15 text-rose-400 border border-rose-500/25 px-2 py-1 text-[11px] font-medium hover:bg-rose-500/20 transition-colors">Remove</button>
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
