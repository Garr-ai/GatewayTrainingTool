/**
 * components/CreateClassModal.tsx — Modal form for creating a new training class
 *
 * Renders a modal dialog with a form containing all required and optional fields
 * for a new class. On successful creation, calls `onSuccess` (which typically
 * re-fetches the class list) and then calls `onClose`.
 *
 * Validation rules (client-side, mirrored on the backend):
 *   - Class name is required and must not contain `. , ? / \` characters
 *     (these break the URL slug system used to navigate to class detail pages)
 *   - Site and province are required
 *   - Both start and end dates are required, and end must be >= start
 *
 * The modal uses ARIA attributes (role="dialog", aria-modal, aria-labelledby)
 * for accessibility.
 */

import { useState } from 'react'
import { api } from '../lib/apiClient'
import { PROVINCES } from '../types'
import type { Province } from '../types'

interface CreateClassModalProps {
  onClose: () => void    // Called when the user cancels or after successful creation
  onSuccess: () => void  // Called after the class is created so the parent can refresh its list
}

export function CreateClassModal({ onClose, onSuccess }: CreateClassModalProps) {
  const [name, setName] = useState('')
  const [site, setSite] = useState('')
  // Province defaults to BC — the most common training location
  const [province, setProvince] = useState<Province>('BC')
  const [gameType, setGameType] = useState('')
  // Start date defaults to today so the coordinator only needs to adjust end date
  const [startDate, setStartDate] = useState(() => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  })
  const [endDate, setEndDate] = useState('')
  const [description, setDescription] = useState('')
  const [loading, setLoading] = useState(false)  // True while the API call is in flight
  const [error, setError] = useState('')          // Validation or API error shown to the user

  /**
   * Validates the form and POSTs a new class to the API.
   * Calls onSuccess (to refresh the class list) then onClose on success.
   * On error, sets the `error` state which renders an alert inside the form.
   */
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    const trimmedName = name.trim()
    if (!trimmedName) {
      setError('Class name is required.')
      return
    }
    // Disallow characters that would break the URL slug (classSlug in utils.ts
    // converts spaces to hyphens; these characters cause ambiguity or broken URLs)
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
      await api.classes.create({
        name: trimmedName,
        site: site.trim(),
        province,
        game_type: gameType.trim() || null,
        start_date: startDate,
        end_date: endDate,
        description: description.trim() || null,
      })
      onSuccess()
      onClose()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }

  const inputClass =
    'mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-gw-blue focus:outline-none focus:ring-1 focus:ring-gw-blue'

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="create-class-title"
    >
      <div className="w-full max-w-md rounded-xl bg-white shadow-xl">
        <div className="border-b border-slate-200 px-5 py-4">
          <h2 id="create-class-title" className="text-lg font-semibold text-slate-900">
            Create class
          </h2>
          <p className="mt-0.5 text-xs text-slate-500">
            Add a new training class. Required fields are marked.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4 p-5">
          <div>
            <label htmlFor="class-name" className="block text-sm font-medium text-slate-700">
              Class name <span className="text-rose-500">*</span>
            </label>
            <input
              id="class-name"
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
              <label htmlFor="class-site" className="block text-sm font-medium text-slate-700">
                Site <span className="text-rose-500">*</span>
              </label>
              <input
                id="class-site"
                type="text"
                value={site}
                onChange={e => setSite(e.target.value)}
                placeholder="e.g. GVE, SLE, GVB"
                className={inputClass}
              />
            </div>
            <div>
              <label htmlFor="class-province" className="block text-sm font-medium text-slate-700">
                Province <span className="text-rose-500">*</span>
              </label>
              <select
                id="class-province"
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
            <label htmlFor="class-game" className="block text-sm font-medium text-slate-700">
              Game type
            </label>
            <input
              id="class-game"
              type="text"
              value={gameType}
              onChange={e => setGameType(e.target.value)}
              placeholder="e.g. Blackjack, Poker"
              className={inputClass}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="class-start" className="block text-sm font-medium text-slate-700">
                Start date <span className="text-rose-500">*</span>
              </label>
              <input
                id="class-start"
                type="date"
                value={startDate}
                onChange={e => setStartDate(e.target.value)}
                className={inputClass}
                required
              />
            </div>
            <div>
              <label htmlFor="class-end" className="block text-sm font-medium text-slate-700">
                End date <span className="text-rose-500">*</span>
              </label>
              <input
                id="class-end"
                type="date"
                value={endDate}
                onChange={e => setEndDate(e.target.value)}
                className={inputClass}
                required
              />
            </div>
          </div>

          <div>
            <label htmlFor="class-desc" className="block text-sm font-medium text-slate-700">
              Description
            </label>
            <textarea
              id="class-desc"
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
              {loading ? 'Creating…' : 'Create class'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
