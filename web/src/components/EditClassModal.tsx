/**
 * components/EditClassModal.tsx — Modal form for editing an existing training class
 *
 * Renders a modal dialog with a form pre-filled from the existing class data.
 * On successful update, calls `onSuccess` with the updated class object
 * (so the parent can update its state) and then calls `onClose`.
 *
 * Validation rules are identical to CreateClassModal:
 *   - Class name is required and must not contain `. , ? / \` characters
 *   - Site and province are required
 *   - Both start and end dates are required, and end must be >= start
 */

import { useState } from 'react'
import { api } from '../lib/apiClient'
import { useToast } from '../contexts/ToastContext'
import { PROVINCES } from '../types'
import type { Province, Class } from '../types'

interface EditClassModalProps {
  classData: Class                        // The class being edited, used to pre-fill all fields
  onClose: () => void                     // Called when the user cancels or after successful update
  onSuccess: (updated: Class) => void     // Called with the updated class so the parent can refresh
}

export function EditClassModal({ classData, onClose, onSuccess }: EditClassModalProps) {
  const { toast } = useToast()
  const [name, setName] = useState(classData.name)
  const [site, setSite] = useState(classData.site)
  const [province, setProvince] = useState<Province>(classData.province)
  const [gameType, setGameType] = useState(classData.game_type ?? '')
  const [startDate, setStartDate] = useState(classData.start_date)
  const [endDate, setEndDate] = useState(classData.end_date)
  const [description, setDescription] = useState(classData.description ?? '')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  /**
   * Validates the form and PUTs the updated class to the API.
   * Calls onSuccess (with the returned class) then onClose on success.
   */
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    const trimmedName = name.trim()
    if (!trimmedName) {
      setError('Class name is required.')
      return
    }
    if (/[.,?/#\\]/.test(trimmedName)) {
      setError('Class name cannot contain characters like . , ? / or \\')
      return
    }
    if (!site.trim()) {
      setError('Site is required.')
      return
    }
    if (!startDate || !endDate) {
      setError('Start and end dates are required.')
      return
    }
    if (new Date(endDate) < new Date(startDate)) {
      setError('End date must be on or after start date.')
      return
    }

    setLoading(true)
    try {
      const updated = await api.classes.update(classData.id, {
        name: trimmedName,
        site: site.trim(),
        province,
        game_type: gameType.trim() || null,
        start_date: startDate,
        end_date: endDate,
        description: description.trim() || null,
      })
      onSuccess(updated)
      toast('Class updated', 'success')
      onClose()
    } catch (err) {
      setError((err as Error).message)
      toast((err as Error).message, 'error')
    } finally {
      setLoading(false)
    }
  }

  const inputClass =
    'mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-gw-blue focus:outline-none focus:ring-1 focus:ring-gw-blue'

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 animate-backdrop-in"
      role="dialog"
      aria-modal="true"
      aria-labelledby="edit-class-title"
    >
      <div className="w-full max-w-md rounded-xl bg-white shadow-xl animate-modal-in">
        <div className="border-b border-slate-200 px-5 py-4">
          <h2 id="edit-class-title" className="text-lg font-semibold text-slate-900">
            Edit class
          </h2>
          <p className="mt-0.5 text-xs text-slate-500">
            Update class details.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4 p-5">
          <div>
            <label htmlFor="edit-class-name" className="block text-sm font-medium text-slate-700">
              Class name <span className="text-rose-500">*</span>
            </label>
            <input
              id="edit-class-name"
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. BJ-APR-01"
              className={inputClass}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="edit-class-site" className="block text-sm font-medium text-slate-700">
                Site <span className="text-rose-500">*</span>
              </label>
              <input
                id="edit-class-site"
                type="text"
                value={site}
                onChange={e => setSite(e.target.value)}
                placeholder="e.g. GVE, SLE, GVB"
                className={inputClass}
              />
            </div>
            <div>
              <label htmlFor="edit-class-province" className="block text-sm font-medium text-slate-700">
                Province <span className="text-rose-500">*</span>
              </label>
              <select
                id="edit-class-province"
                value={province}
                onChange={e => setProvince(e.target.value as Province)}
                className={inputClass}
              >
                {PROVINCES.map(({ value, label }) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label htmlFor="edit-class-game" className="block text-sm font-medium text-slate-700">
              Game type
            </label>
            <input
              id="edit-class-game"
              type="text"
              value={gameType}
              onChange={e => setGameType(e.target.value)}
              placeholder="e.g. Blackjack, Poker"
              className={inputClass}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="edit-class-start" className="block text-sm font-medium text-slate-700">
                Start date <span className="text-rose-500">*</span>
              </label>
              <input
                id="edit-class-start"
                type="date"
                value={startDate}
                onChange={e => setStartDate(e.target.value)}
                className={inputClass}
                required
              />
            </div>
            <div>
              <label htmlFor="edit-class-end" className="block text-sm font-medium text-slate-700">
                End date <span className="text-rose-500">*</span>
              </label>
              <input
                id="edit-class-end"
                type="date"
                value={endDate}
                onChange={e => setEndDate(e.target.value)}
                className={inputClass}
                required
              />
            </div>
          </div>

          <div>
            <label htmlFor="edit-class-desc" className="block text-sm font-medium text-slate-700">
              Description
            </label>
            <textarea
              id="edit-class-desc"
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Optional notes"
              rows={2}
              className={inputClass}
            />
          </div>

          {error && (
            <p className="rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-700" role="alert">
              {error}
            </p>
          )}

          <div className="flex gap-2 justify-end border-t border-slate-200 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="rounded-lg bg-gw-blue px-4 py-2 text-sm font-medium text-white hover:bg-gw-blue-hover disabled:opacity-60"
            >
              {loading ? 'Saving…' : 'Save changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
