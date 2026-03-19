import { useEffect, useState } from 'react'
import { api } from '../../lib/apiClient'
import type { ClassDrill, DrillType } from '../../types'

interface ClassDrillsSectionProps {
  classId: string
  className: string
}

export function ClassDrillsSection({ classId, className }: ClassDrillsSectionProps) {
  const [drills, setDrills] = useState<ClassDrill[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [formName, setFormName] = useState('')
  const [formType, setFormType] = useState<DrillType>('drill')
  const [formParTime, setFormParTime] = useState('')
  const [formTargetScore, setFormTargetScore] = useState('')
  const [saving, setSaving] = useState(false)

  async function loadDrills() {
    setLoading(true)
    setError(null)
    try {
      const data = await api.drills.list(classId)
      setDrills(data)
    } catch (err) {
      console.error('loadDrills error:', (err as Error).message)
      setError('Unable to load drills for this class.')
      setDrills([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadDrills()
  }, [classId])

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!formName.trim()) return
    setSaving(true)
    setError(null)

    const parSeconds = formParTime ? Number(formParTime) : null
    const target = formTargetScore ? Number(formTargetScore) : null

    try {
      await api.drills.create(classId, {
        name: formName.trim(),
        type: formType,
        par_time_seconds: Number.isNaN(parSeconds) ? null : parSeconds,
        target_score: Number.isNaN(target) ? null : target,
      })
      setFormName('')
      setFormParTime('')
      setFormTargetScore('')
      setFormType('drill')
      setFormOpen(false)
      loadDrills()
    } catch (err) {
      console.error('createDrill error:', (err as Error).message)
      setError((err as Error).message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="rounded-xl bg-white p-4 shadow-sm">
      <header className="flex items-center justify-between mb-3">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">Drills & tests</h3>
          <p className="mt-0.5 text-xs text-slate-500">
            Define drills and tests, including scores and par times, for this class.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setFormOpen(o => !o)}
          className="rounded-md bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-500"
        >
          {formOpen ? 'Cancel' : '+ Add drill / test'}
        </button>
      </header>

      {error && (
        <p className="mb-3 rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-700" role="alert">
          {error}
        </p>
      )}

      {formOpen && (
        <form onSubmit={handleSave} className="mb-4 grid grid-cols-1 md:grid-cols-4 gap-3 text-xs">
          <div className="md:col-span-2">
            <label className="block font-medium text-slate-700">
              Name
              <input
                type="text"
                value={formName}
                onChange={e => setFormName(e.target.value)}
                className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5 text-xs text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                placeholder="e.g. 60s chip pull"
                required
              />
            </label>
          </div>
          <div>
            <label className="block font-medium text-slate-700">
              Type
              <select
                value={formType}
                onChange={e => setFormType(e.target.value as DrillType)}
                className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5 text-xs text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              >
                <option value="drill">Drill</option>
                <option value="test">Test</option>
              </select>
            </label>
          </div>
          <div className="flex gap-2">
            <label className="flex-1 block font-medium text-slate-700">
              Par time (sec)
              <input
                type="number"
                min={0}
                value={formParTime}
                onChange={e => setFormParTime(e.target.value)}
                className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5 text-xs text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                placeholder="e.g. 60"
              />
            </label>
            <label className="flex-1 block font-medium text-slate-700">
              Target score
              <input
                type="number"
                min={0}
                value={formTargetScore}
                onChange={e => setFormTargetScore(e.target.value)}
                className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5 text-xs text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                placeholder="e.g. 80"
              />
            </label>
          </div>
          <div className="md:col-span-4 flex justify-end items-end">
            <button
              type="submit"
              disabled={saving}
              className="rounded-md bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-500 disabled:opacity-60"
            >
              {saving ? 'Saving…' : 'Save drill'}
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <p className="text-xs text-slate-500">Loading drills…</p>
      ) : drills.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-center text-xs text-slate-500">
          No drills or tests defined yet for{' '}
          <span className="font-medium text-slate-700">{className}</span>.
        </div>
      ) : (
        <div className="rounded-lg border border-slate-200 overflow-hidden">
          <table className="w-full text-xs">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-3 py-2 text-left font-medium text-slate-900">Name</th>
                <th className="px-3 py-2 text-left font-medium text-slate-900">Type</th>
                <th className="px-3 py-2 text-left font-medium text-slate-900">Par time (sec)</th>
                <th className="px-3 py-2 text-left font-medium text-slate-900">Target score</th>
                <th className="px-3 py-2 text-left font-medium text-slate-900">Active</th>
              </tr>
            </thead>
            <tbody>
              {drills.map(drill => (
                <tr key={drill.id} className="border-b border-slate-100">
                  <td className="px-3 py-2 text-slate-900">{drill.name}</td>
                  <td className="px-3 py-2 text-slate-600 capitalize">{drill.type}</td>
                  <td className="px-3 py-2 text-slate-600">{drill.par_time_seconds ?? '—'}</td>
                  <td className="px-3 py-2 text-slate-600">{drill.target_score ?? '—'}</td>
                  <td className="px-3 py-2 text-slate-600">{drill.active ? 'Yes' : 'No'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
