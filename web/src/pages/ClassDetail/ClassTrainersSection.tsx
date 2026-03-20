import { useEffect, useState } from 'react'
import { api } from '../../lib/apiClient'
import type { ClassTrainer, TrainerRole, Profile } from '../../types'

interface ClassTrainersSectionProps {
  classId: string
  className: string
}

export function ClassTrainersSection({ classId, className }: ClassTrainersSectionProps) {
  const [trainers, setTrainers] = useState<ClassTrainer[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [assignOpen, setAssignOpen] = useState(false)
  const [role, setRole] = useState<TrainerRole>('primary')
  const [searchTerm, setSearchTerm] = useState('')
  const [searchResults, setSearchResults] = useState<Pick<Profile, 'id' | 'full_name' | 'email'>[]>(
    [],
  )
  const [searchLoading, setSearchLoading] = useState(false)
  const [editingTrainer, setEditingTrainer] = useState<ClassTrainer | null>(null)
  const [editName, setEditName] = useState('')
  const [editEmail, setEditEmail] = useState('')
  const [editRole, setEditRole] = useState<TrainerRole>('primary')

  async function loadTrainers() {
    setLoading(true)
    setError(null)
    try {
      const data = await api.trainers.list(classId)
      setTrainers(data)
    } catch (err) {
      console.error('loadTrainers error:', (err as Error).message)
      setError('Unable to load trainers for this class.')
      setTrainers([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadTrainers()
  }, [classId])

  async function searchProfiles(term: string) {
    setSearchLoading(true)
    setError(null)
    try {
      const raw = await api.profiles.search({ role: 'trainer', search: term || undefined })
      const existingEmails = new Set(trainers.map(t => t.trainer_email.toLowerCase()))
      setSearchResults(raw.filter(p => !existingEmails.has(p.email.toLowerCase())))
    } catch (err) {
      console.error('searchTrainers error:', (err as Error).message)
      setError((err as Error).message)
      setSearchResults([])
    } finally {
      setSearchLoading(false)
    }
  }

  async function handleAssignTrainer(profile: Pick<Profile, 'id' | 'full_name' | 'email'>) {
    setError(null)
    try {
      await api.trainers.create(classId, {
        trainer_name: profile.full_name ?? profile.email,
        trainer_email: profile.email,
        role,
      })
      await loadTrainers()
      await searchProfiles(searchTerm)
    } catch (err) {
      console.error('createTrainer error:', (err as Error).message)
      setError((err as Error).message)
    }
  }

  function openEditTrainer(t: ClassTrainer) {
    setEditingTrainer(t)
    setEditName(t.trainer_name)
    setEditEmail(t.trainer_email)
    setEditRole(t.role)
  }

  async function handleSaveEdit(e: React.FormEvent) {
    e.preventDefault()
    if (!editingTrainer) return
    if (!editName.trim() || !editEmail.trim()) return
    setError(null)
    try {
      await api.trainers.update(classId, editingTrainer.id, {
        trainer_name: editName.trim(),
        trainer_email: editEmail.trim(),
        role: editRole,
      })
      setEditingTrainer(null)
      loadTrainers()
    } catch (err) {
      console.error('updateTrainer error:', (err as Error).message)
      setError((err as Error).message)
    }
  }

  async function handleRemove(id: string, name: string) {
    if (!window.confirm(`Remove ${name} from this class?`)) return
    try {
      await api.trainers.delete(classId, id)
      loadTrainers()
    } catch (err) {
      console.error('removeTrainer error:', (err as Error).message)
      setError((err as Error).message)
    }
  }

  return (
    <section className="rounded-xl bg-white p-4 shadow-sm">
      <header className="flex items-center justify-between mb-3">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">Trainers</h3>
          <p className="mt-0.5 text-xs text-slate-500">
            Assign primary and assistant trainers to this class.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setAssignOpen(true)
            searchProfiles('')
          }}
          className="rounded-md bg-indigo-600 px-3 py-2 text-xs font-medium text-white hover:bg-indigo-500"
        >
          + Assign trainer
        </button>
      </header>

      {error && (
        <p className="mb-3 rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-700" role="alert">
          {error}
        </p>
      )}

      {assignOpen && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md mx-2 max-h-[80vh] overflow-y-auto rounded-xl bg-white shadow-xl p-4">
            <header className="mb-3 flex items-center justify-between gap-3">
              <div>
                <h4 className="text-sm font-semibold text-slate-900">Assign trainer</h4>
                <p className="mt-0.5 text-[11px] text-slate-500">
                  Search existing trainer profiles and assign them to this class.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setAssignOpen(false)
                  setSearchTerm('')
                  setSearchResults([])
                }}
                className="rounded-md border border-slate-300 px-2 py-1 text-[11px] text-slate-700 hover:bg-slate-50"
              >
                Close
              </button>
            </header>

            <div className="mb-3 flex flex-col gap-2 text-xs sm:flex-row sm:items-center">
              <input
                type="search"
                value={searchTerm}
                onChange={e => {
                  const val = e.target.value
                  setSearchTerm(val)
                  searchProfiles(val)
                }}
                placeholder="Search trainers by name…"
                className="flex-1 rounded-md border border-slate-300 px-2 py-1.5 text-xs text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
              <select
                value={role}
                onChange={e => setRole(e.target.value as TrainerRole)}
                className="w-32 rounded-md border border-slate-300 px-2 py-1.5 text-xs text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              >
                <option value="primary">Primary</option>
                <option value="assistant">Assistant</option>
              </select>
            </div>

            <div className="max-h-64 overflow-auto rounded-lg border border-slate-200">
              {searchLoading ? (
                <p className="px-3 py-2 text-[11px] text-slate-500">Searching…</p>
              ) : searchResults.length === 0 ? (
                <p className="px-3 py-2 text-[11px] text-slate-500">No trainers found.</p>
              ) : (
                <ul className="divide-y divide-slate-200 text-xs">
                  {searchResults.map(p => (
                    <li
                      key={p.id}
                      className="flex cursor-pointer items-center justify-between px-3 py-2 hover:bg-slate-50"
                      onClick={() => handleAssignTrainer(p)}
                    >
                      <div>
                        <p className="font-medium text-slate-900">{p.full_name ?? p.email}</p>
                        <p className="text-[11px] text-slate-500">{p.email}</p>
                      </div>
                      <span className="text-[11px] text-indigo-600">Assign</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}

      {editingTrainer && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md mx-2 max-h-[80vh] overflow-y-auto rounded-xl bg-white shadow-xl p-4">
            <header className="mb-3 flex items-center justify-between gap-3">
              <div>
                <h4 className="text-sm font-semibold text-slate-900">Edit trainer</h4>
                <p className="mt-0.5 text-[11px] text-slate-500">
                  Update trainer details or role for this class.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEditingTrainer(null)}
                className="rounded-md border border-slate-300 px-2 py-1 text-[11px] text-slate-700 hover:bg-slate-50"
              >
                Close
              </button>
            </header>

            <form onSubmit={handleSaveEdit} className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
              <div className="md:col-span-2">
                <label className="block font-medium text-slate-700">
                  Trainer name
                  <input
                    type="text"
                    value={editName}
                    onChange={e => setEditName(e.target.value)}
                    className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5 text-xs text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    required
                  />
                </label>
              </div>
              <div>
                <label className="block font-medium text-slate-700">
                  Email
                  <input
                    type="email"
                    value={editEmail}
                    onChange={e => setEditEmail(e.target.value)}
                    className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5 text-xs text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    required
                  />
                </label>
              </div>
              <div>
                <label className="block font-medium text-slate-700">
                  Role
                  <select
                    value={editRole}
                    onChange={e => setEditRole(e.target.value as TrainerRole)}
                    className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5 text-xs text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  >
                    <option value="primary">Primary</option>
                    <option value="assistant">Assistant</option>
                  </select>
                </label>
              </div>
              <div className="md:col-span-3 flex justify-end items-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditingTrainer(null)}
                  className="rounded-md border border-slate-300 px-3 py-1.5 text-[11px] text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-md bg-indigo-600 px-3 py-1.5 text-[11px] font-medium text-white hover:bg-indigo-500"
                >
                  Save changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {loading ? (
        <p className="text-xs text-slate-500">Loading trainers…</p>
      ) : trainers.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-center text-xs text-slate-500">
          No trainers assigned yet for{' '}
          <span className="font-medium text-slate-700">{className}</span>.
        </div>
      ) : (
        <div className="rounded-lg border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-3 py-2 text-left font-medium text-slate-900">Name</th>
                  <th className="hidden sm:table-cell px-3 py-2 text-left font-medium text-slate-900">Email</th>
                  <th className="px-3 py-2 text-left font-medium text-slate-900">Role</th>
                  <th className="px-3 py-2 text-right font-medium text-slate-900">Actions</th>
                </tr>
              </thead>
              <tbody>
                {trainers.map(t => (
                  <tr
                    key={t.id}
                    className="border-b border-slate-100 hover:bg-slate-50 cursor-pointer"
                    onClick={() => openEditTrainer(t)}
                  >
                    <td className="px-3 py-2 text-slate-900">{t.trainer_name}</td>
                    <td className="hidden sm:table-cell px-3 py-2 text-slate-600">{t.trainer_email}</td>
                    <td className="px-3 py-2 text-slate-600 capitalize">{t.role}</td>
                    <td className="px-3 py-2 text-right">
                      <button
                        type="button"
                        onClick={e => {
                          e.stopPropagation()
                          handleRemove(t.id, t.trainer_name)
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
        </div>
      )}
    </section>
  )
}
