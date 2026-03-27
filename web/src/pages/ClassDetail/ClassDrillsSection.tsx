/**
 * pages/ClassDetail/ClassDrillsSection.tsx — Drills and tests management tab
 *
 * Allows coordinators to define the drills and tests associated with a class.
 * These definitions are used as reference for assessment — actual student
 * drill results are tracked in daily reports.
 *
 * Features:
 *   - Lists all drills/tests for the class in a table (name, type, par time, target score, active)
 *   - Inline "Add drill / test" form (toggled by a button, collapses on save/cancel)
 *   - Edit existing drills inline (pre-fills the form)
 *   - Delete drills with confirmation dialog
 *   - Toggle active/inactive status directly from the table
 *   - `par_time_seconds` is the expected completion time for timed drills
 *   - `target_score` is the minimum passing score for scored tests
 *   - Both are optional; a drill can have neither, one, or both
 *
 * NaN guard: the form stores par time and target score as string inputs to allow
 * empty values (null). On save, they are converted to Number and NaN-guarded
 * before being sent to the API.
 */

import { useState } from 'react'
import { api } from '../../lib/apiClient'
import { useClassDetail } from '../../contexts/ClassDetailContext'
import { SkeletonTable } from '../../components/Skeleton'
import { ConfirmDialog } from '../../components/ConfirmDialog'
import { useToast } from '../../contexts/ToastContext'
import type { DrillType, ClassDrill } from '../../types'

interface ClassDrillsSectionProps {
  classId: string   // UUID of the class — used for all API calls
  className: string // Display name — used only in the empty-state message
}

export function ClassDrillsSection({ classId, className }: ClassDrillsSectionProps) {
  const { drills, loading, refreshDrills } = useClassDetail()
  const { toast } = useToast()
  const [error, setError] = useState<string | null>(null)
  // Controls visibility of the inline add/edit form
  const [formOpen, setFormOpen] = useState(false)
  // When editing, holds the drill being edited; null means "add" mode
  const [editingDrill, setEditingDrill] = useState<ClassDrill | null>(null)
  // Form field state — stored as strings to allow blank (→ null) inputs
  const [formName, setFormName] = useState('')
  const [formType, setFormType] = useState<DrillType>('drill')
  const [formParTime, setFormParTime] = useState('')
  const [formTargetScore, setFormTargetScore] = useState('')
  const [saving, setSaving] = useState(false)
  // Delete confirmation state
  const [deleteTarget, setDeleteTarget] = useState<ClassDrill | null>(null)

  function resetForm() {
    setFormName('')
    setFormParTime('')
    setFormTargetScore('')
    setFormType('drill')
    setEditingDrill(null)
    setFormOpen(false)
  }

  function openEditForm(drill: ClassDrill) {
    setEditingDrill(drill)
    setFormName(drill.name)
    setFormType(drill.type)
    setFormParTime(drill.par_time_seconds != null ? String(drill.par_time_seconds) : '')
    setFormTargetScore(drill.target_score != null ? String(drill.target_score) : '')
    setFormOpen(true)
    setError(null)
  }

  function openAddForm() {
    resetForm()
    setFormOpen(true)
    setError(null)
  }

  /**
   * Validates and submits the add/edit drill form.
   * Converts par time and target score from string to number, with NaN
   * falling back to null so the API receives proper null values.
   */
  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!formName.trim()) return
    setSaving(true)
    setError(null)

    const parSeconds = formParTime ? Number(formParTime) : null
    const target = formTargetScore ? Number(formTargetScore) : null

    const payload = {
      name: formName.trim(),
      type: formType,
      par_time_seconds: Number.isNaN(parSeconds) ? null : parSeconds,
      target_score: Number.isNaN(target) ? null : target,
    }

    try {
      if (editingDrill) {
        await api.drills.update(classId, editingDrill.id, payload)
        toast('Drill updated', 'success')
      } else {
        await api.drills.create(classId, payload)
        toast('Drill added', 'success')
      }
      resetForm()
      refreshDrills()
    } catch (err) {
      console.error('saveDrill error:', (err as Error).message)
      setError((err as Error).message)
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return
    try {
      await api.drills.delete(classId, deleteTarget.id)
      toast('Drill deleted', 'success')
      setDeleteTarget(null)
      refreshDrills()
    } catch (err) {
      console.error('deleteDrill error:', (err as Error).message)
      setError((err as Error).message)
      setDeleteTarget(null)
    }
  }

  async function handleToggleActive(drill: ClassDrill) {
    try {
      await api.drills.update(classId, drill.id, { active: !drill.active })
      refreshDrills()
    } catch (err) {
      console.error('toggleActive error:', (err as Error).message)
      setError((err as Error).message)
    }
  }

  return (
    <section className="rounded-xl bg-white p-4 shadow-sm">
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">
            Drills & tests
            {!loading && drills.length > 0 && (
              <span className="ml-1.5 text-slate-400 font-normal">({drills.length})</span>
            )}
          </h3>
          <p className="mt-0.5 text-xs text-slate-500">
            Define drills and tests, including scores and par times, for this class.
          </p>
        </div>
        <button
          type="button"
          onClick={() => formOpen ? resetForm() : openAddForm()}
          className="rounded-md bg-gw-blue px-3 py-1.5 text-xs font-medium text-white hover:bg-gw-blue-hover self-start sm:self-auto flex-shrink-0"
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
        <form onSubmit={handleSave} className="mb-4 rounded-lg border border-slate-200 bg-slate-50 p-3">
          <p className="text-xs font-medium text-slate-700 mb-2">
            {editingDrill ? `Editing: ${editingDrill.name}` : 'New drill / test'}
          </p>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-xs">
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
            <div className="md:col-span-4 flex justify-end items-end gap-2">
              <button
                type="button"
                onClick={resetForm}
                className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="rounded-md bg-gw-blue px-3 py-1.5 text-xs font-medium text-white hover:bg-gw-blue-hover disabled:opacity-60"
              >
                {saving ? 'Saving…' : editingDrill ? 'Update drill' : 'Save drill'}
              </button>
            </div>
          </div>
        </form>
      )}

      {loading ? (
        <SkeletonTable rows={3} cols={6} />
      ) : drills.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-center text-xs text-slate-500">
          No drills or tests defined yet for{' '}
          <span className="font-medium text-slate-700">{className}</span>.
        </div>
      ) : (
        <div className="rounded-lg border border-slate-200 overflow-x-auto">
          <table className="min-w-full text-xs">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-3 py-2 text-left font-medium text-slate-900">Name</th>
                <th className="px-3 py-2 text-left font-medium text-slate-900">Type</th>
                <th className="px-3 py-2 text-left font-medium text-slate-900 hidden sm:table-cell">Par time (sec)</th>
                <th className="px-3 py-2 text-left font-medium text-slate-900 hidden sm:table-cell">Target score</th>
                <th className="px-3 py-2 text-left font-medium text-slate-900">Active</th>
                <th className="px-3 py-2 text-right font-medium text-slate-900">Actions</th>
              </tr>
            </thead>
            <tbody>
              {drills.map(drill => (
                <tr key={drill.id} className="border-b border-slate-100 hover:bg-slate-50">
                  <td className="px-3 py-2 text-slate-900">{drill.name}</td>
                  <td className="px-3 py-2 text-slate-600 capitalize">{drill.type}</td>
                  <td className="px-3 py-2 text-slate-600 hidden sm:table-cell">{drill.par_time_seconds ?? '—'}</td>
                  <td className="px-3 py-2 text-slate-600 hidden sm:table-cell">{drill.target_score ?? '—'}</td>
                  <td className="px-3 py-2">
                    <button
                      type="button"
                      onClick={() => handleToggleActive(drill)}
                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${
                        drill.active
                          ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
                          : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                      }`}
                    >
                      {drill.active ? 'Active' : 'Inactive'}
                    </button>
                  </td>
                  <td className="px-3 py-2 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        type="button"
                        onClick={() => openEditForm(drill)}
                        className="rounded px-2 py-1 text-[11px] font-medium text-gw-blue hover:bg-blue-50"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeleteTarget(drill)}
                        className="rounded px-2 py-1 text-[11px] font-medium text-rose-600 hover:bg-rose-50"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete drill"
        message={`Are you sure you want to delete "${deleteTarget?.name}"? This action cannot be undone.`}
        confirmLabel="Delete"
        confirmVariant="danger"
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </section>
  )
}
