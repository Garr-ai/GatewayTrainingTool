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

  const fieldClass = 'mt-1 w-full bg-gw-elevated border border-white/10 rounded-md px-2 py-1.5 text-xs text-slate-200 placeholder:text-slate-500 outline-none focus:border-gw-blue/40 focus:ring-2 focus:ring-gw-blue/15'

  return (
    <section className="bg-gw-surface rounded-[10px] p-4">
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            Drills & tests
            {!loading && drills.length > 0 && (
              <span className="ml-1.5 font-normal normal-case tracking-normal text-slate-500">({drills.length})</span>
            )}
          </h3>
          <p className="mt-0.5 text-xs text-slate-500">
            Define drills and tests, including scores and par times, for this class.
          </p>
        </div>
        <button
          type="button"
          onClick={() => formOpen ? resetForm() : openAddForm()}
          className="rounded-md bg-gradient-to-r from-gw-blue to-gw-teal text-white font-semibold px-3 py-1.5 text-xs hover:brightness-110 transition-all duration-150 self-start sm:self-auto flex-shrink-0"
        >
          {formOpen ? 'Cancel' : '+ Add drill / test'}
        </button>
      </header>

      {error && (
        <p className="mb-3 rounded-md bg-rose-500/10 border border-rose-500/25 px-3 py-2 text-xs text-rose-400" role="alert">
          {error}
        </p>
      )}

      {formOpen && (
        <form onSubmit={handleSave} className="mb-4 rounded-[10px] border border-white/[0.06] bg-gw-elevated p-3">
          <p className="text-xs font-medium text-slate-400 mb-2">
            {editingDrill ? `Editing: ${editingDrill.name}` : 'New drill / test'}
          </p>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-xs">
            <div className="md:col-span-2">
              <label className="block text-xs font-medium text-slate-400 mb-1">Name
                <input type="text" value={formName} onChange={e => setFormName(e.target.value)} className={fieldClass} placeholder="e.g. 60s chip pull" required />
              </label>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Type
                <select value={formType} onChange={e => setFormType(e.target.value as DrillType)} className={fieldClass}>
                  <option value="drill">Drill</option>
                  <option value="test">Test</option>
                </select>
              </label>
            </div>
            <div className="flex gap-2">
              <label className="flex-1 block text-xs font-medium text-slate-400 mb-1">Par time (sec)
                <input type="number" min={0} value={formParTime} onChange={e => setFormParTime(e.target.value)} className={fieldClass} placeholder="e.g. 60" />
              </label>
              <label className="flex-1 block text-xs font-medium text-slate-400 mb-1">Target score
                <input type="number" min={0} value={formTargetScore} onChange={e => setFormTargetScore(e.target.value)} className={fieldClass} placeholder="e.g. 80" />
              </label>
            </div>
            <div className="md:col-span-4 flex justify-end items-end gap-2">
              <button type="button" onClick={resetForm} className="rounded-md bg-gw-surface text-slate-200 border border-white/10 px-3 py-1.5 text-xs font-semibold hover:bg-gw-elevated transition-colors duration-150">Cancel</button>
              <button type="submit" disabled={saving} className="rounded-md bg-gradient-to-r from-gw-blue to-gw-teal text-white px-3 py-1.5 text-xs font-semibold hover:brightness-110 transition-all duration-150 disabled:opacity-50">
                {saving ? 'Saving…' : editingDrill ? 'Update drill' : 'Save drill'}
              </button>
            </div>
          </div>
        </form>
      )}

      {loading ? (
        <SkeletonTable rows={3} cols={6} />
      ) : drills.length === 0 ? (
        <div className="bg-gw-elevated rounded-[10px] px-4 py-6 text-center text-xs text-slate-500">
          No drills or tests defined yet for <span className="font-medium text-slate-300">{className}</span>.
        </div>
      ) : (
        <div className="bg-gw-elevated rounded-[10px] overflow-x-auto">
          <table className="min-w-full text-xs">
            <thead>
              <tr className="bg-white/[0.02] border-b border-white/[0.06]">
                <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Name</th>
                <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Type</th>
                <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 hidden sm:table-cell">Par time (sec)</th>
                <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 hidden sm:table-cell">Target score</th>
                <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Active</th>
                <th className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">Actions</th>
              </tr>
            </thead>
            <tbody>
              {drills.map(drill => (
                <tr key={drill.id} className="border-b border-white/[0.03] hover:bg-gw-surface transition-colors duration-100">
                  <td className="px-3 py-2 text-slate-200">{drill.name}</td>
                  <td className="px-3 py-2 text-slate-400 capitalize">{drill.type}</td>
                  <td className="px-3 py-2 text-slate-400 hidden sm:table-cell">{drill.par_time_seconds ?? '—'}</td>
                  <td className="px-3 py-2 text-slate-400 hidden sm:table-cell">{drill.target_score ?? '—'}</td>
                  <td className="px-3 py-2">
                    <button
                      type="button"
                      onClick={() => handleToggleActive(drill)}
                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium transition-colors ${
                        drill.active
                          ? 'bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/25'
                          : 'bg-white/[0.06] text-slate-500 hover:bg-white/10'
                      }`}
                    >
                      {drill.active ? 'Active' : 'Inactive'}
                    </button>
                  </td>
                  <td className="px-3 py-2 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button type="button" onClick={() => openEditForm(drill)} className="rounded px-2 py-1 text-[11px] font-medium text-gw-blue hover:bg-gw-blue/10 transition-colors">Edit</button>
                      <button type="button" onClick={() => setDeleteTarget(drill)} className="rounded px-2 py-1 text-[11px] font-medium text-rose-400 hover:bg-rose-500/10 transition-colors">Delete</button>
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
