import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { PROVINCES } from '../types'
import type { Province } from '../types'

interface CreateClassModalProps {
  onClose: () => void
  onSuccess: () => void
}

export function CreateClassModal({ onClose, onSuccess }: CreateClassModalProps) {
  const [name, setName] = useState('')
  const [site, setSite] = useState('')
  const [province, setProvince] = useState<Province>('BC')
  const [gameType, setGameType] = useState('')
  const [startDate, setStartDate] = useState(() => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  })
  const [endDate, setEndDate] = useState('')
  const [description, setDescription] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (!name.trim()) {
      setError('Class name is required.')
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
    const { error: err } = await supabase.from('classes').insert({
      name: name.trim(),
      site: site.trim(),
      province,
      game_type: gameType.trim() || null,
      start_date: startDate,
      end_date: endDate,
      description: description.trim() || null,
    })

    setLoading(false)
    if (err) {
      setError(err.message)
      return
    }
    onSuccess()
    onClose()
  }

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
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
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
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
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
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
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
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
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
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
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
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
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
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
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
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-60"
            >
              {loading ? 'Creating…' : 'Create class'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
