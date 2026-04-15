# Trainer Schedule Write Access — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow trainers to add, edit, and delete single schedule slots for their own assigned classes via the self-service API and trainer class detail UI.

**Architecture:** Three new self-service endpoints in `selfService.ts` follow the existing drills write pattern (validateTrainerAccess + archived check + Supabase CRUD). The frontend upgrades `TrainerScheduleSection` from read-only to full CRUD, matching the style of `TrainerDrillsSection`. The context exposes `setSchedule` for optimistic UI updates.

**Tech Stack:** Express + TypeScript (backend), React 19 + TypeScript + Tailwind CSS (frontend), Supabase/PostgreSQL (DB), Vite (build)

---

## File Map

| File | Change |
|------|--------|
| `server/src/routes/selfService.ts` | Add POST, PUT, DELETE endpoints for `/me/my-classes/:classId/schedule` |
| `web/src/lib/apiClient.ts` | Add `createScheduleSlot`, `updateScheduleSlot`, `deleteScheduleSlot` to `api.selfService` |
| `web/src/contexts/TrainerClassDetailContext.tsx` | Expose `setSchedule` in context interface and Provider value |
| `web/src/pages/TrainerClassDetail/TrainerScheduleSection.tsx` | Full rewrite: add form, edit, delete, confirm dialog |

---

## Task 1: Backend — POST endpoint (create slot)

**Files:**
- Modify: `server/src/routes/selfService.ts` (append after the drills write section, around line 1297 — after the `// ─── Role request status ─` comment block start, but actually after the last drill delete endpoint at ~line 1296)

- [ ] **Step 1: Append the POST endpoint to `selfService.ts`**

Add this block immediately after the closing `})` of `selfServiceRouter.delete('/me/my-classes/:classId/drills/:drillId', ...)` (after line ~1296) and before the `// ─── Role request status ────` comment:

```typescript
// ─── Schedule Write Endpoints ─────────────────────────────────────────────────

selfServiceRouter.post('/me/my-classes/:classId/schedule', writeLimiter, async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.userEmail) { res.status(401).json({ error: 'No email associated with this account' }); return }
    const classId = req.params.classId as string
    await validateTrainerAccess(req.userEmail, classId)

    const { data: cls } = await supabase.from('classes').select('archived').eq('id', classId).single()
    if (cls?.archived) { res.status(400).json({ error: 'Cannot add schedule slots for archived classes' }); return }

    const { slot_date, start_time, end_time, notes, group_label } = req.body
    if (!slot_date || !start_time || !end_time) {
      res.status(400).json({ error: 'slot_date, start_time, and end_time are required' })
      return
    }

    const { data, error } = await supabase
      .from('class_schedule_slots')
      .insert({
        class_id: classId,
        slot_date,
        start_time,
        end_time,
        notes: notes ?? null,
        group_label: group_label ?? null,
      })
      .select()
      .single()
    if (error) throw error
    res.status(201).json(data)
  } catch (err) {
    if ((err as Error & { status?: number }).status === 403) { res.status(403).json({ error: (err as Error).message }); return }
    next(err)
  }
})
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd /home/gtse8/GatewayTrainingTool/server && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
cd /home/gtse8/GatewayTrainingTool
git add server/src/routes/selfService.ts
git commit -m "feat: trainer can create schedule slots via self-service API"
```

---

## Task 2: Backend — PUT endpoint (update slot)

**Files:**
- Modify: `server/src/routes/selfService.ts` (append after Task 1's POST endpoint)

- [ ] **Step 1: Append the PUT endpoint**

Add immediately after the closing `})` of the POST endpoint added in Task 1:

```typescript
selfServiceRouter.put('/me/my-classes/:classId/schedule/:slotId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.userEmail) { res.status(401).json({ error: 'No email associated with this account' }); return }
    const classId = req.params.classId as string
    const slotId = req.params.slotId as string
    await validateTrainerAccess(req.userEmail, classId)

    const { data: cls } = await supabase.from('classes').select('archived').eq('id', classId).single()
    if (cls?.archived) { res.status(400).json({ error: 'Cannot modify schedule slots for archived classes' }); return }

    const { slot_date, start_time, end_time, notes, group_label } = req.body
    const { data, error } = await supabase
      .from('class_schedule_slots')
      .update({
        slot_date,
        start_time,
        end_time,
        notes: notes ?? null,
        group_label: group_label ?? null,
      })
      .eq('id', slotId)
      .eq('class_id', classId)
      .select()
      .single()
    if (error) {
      if (error.code === 'PGRST116') { res.status(404).json({ error: 'Schedule slot not found' }); return }
      throw error
    }
    res.json(data)
  } catch (err) {
    if ((err as Error & { status?: number }).status === 403) { res.status(403).json({ error: (err as Error).message }); return }
    next(err)
  }
})
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd /home/gtse8/GatewayTrainingTool/server && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
cd /home/gtse8/GatewayTrainingTool
git add server/src/routes/selfService.ts
git commit -m "feat: trainer can update schedule slots via self-service API"
```

---

## Task 3: Backend — DELETE endpoint (delete slot)

**Files:**
- Modify: `server/src/routes/selfService.ts` (append after Task 2's PUT endpoint)

- [ ] **Step 1: Append the DELETE endpoint**

Add immediately after the closing `})` of the PUT endpoint added in Task 2:

```typescript
selfServiceRouter.delete('/me/my-classes/:classId/schedule/:slotId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.userEmail) { res.status(401).json({ error: 'No email associated with this account' }); return }
    const classId = req.params.classId as string
    const slotId = req.params.slotId as string
    await validateTrainerAccess(req.userEmail, classId)

    const { data: cls } = await supabase.from('classes').select('archived').eq('id', classId).single()
    if (cls?.archived) { res.status(400).json({ error: 'Cannot modify schedule slots for archived classes' }); return }

    const { data: existing, error: fetchError } = await supabase
      .from('class_schedule_slots')
      .select('id')
      .eq('id', slotId)
      .eq('class_id', classId)
      .single()
    if (fetchError || !existing) { res.status(404).json({ error: 'Schedule slot not found' }); return }

    const { error } = await supabase.from('class_schedule_slots').delete().eq('id', slotId)
    if (error) throw error
    res.status(204).send()
  } catch (err) {
    if ((err as Error & { status?: number }).status === 403) { res.status(403).json({ error: (err as Error).message }); return }
    next(err)
  }
})
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd /home/gtse8/GatewayTrainingTool/server && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
cd /home/gtse8/GatewayTrainingTool
git add server/src/routes/selfService.ts
git commit -m "feat: trainer can delete schedule slots via self-service API"
```

---

## Task 4: Frontend — API client methods

**Files:**
- Modify: `web/src/lib/apiClient.ts`

- [ ] **Step 1: Add three methods to `api.selfService`**

In `web/src/lib/apiClient.ts`, find the `deleteDrill` line inside `api.selfService` (around line 595):

```typescript
    deleteDrill: (classId: string, drillId: string) =>
      req<{ deactivated: true; drill: ClassDrill } | void>(`/me/my-classes/${classId}/drills/${drillId}`, { method: 'DELETE' }),
```

Add the following three methods immediately after it (before the `// Cross-class reads` comment):

```typescript
    // Class-scoped writes — schedule slots
    createScheduleSlot: (classId: string, body: { slot_date: string; start_time: string; end_time: string; notes?: string | null; group_label?: string | null }) =>
      req<ClassScheduleSlot>(`/me/my-classes/${classId}/schedule`, { method: 'POST', body: JSON.stringify(body) }),
    updateScheduleSlot: (classId: string, slotId: string, body: { slot_date: string; start_time: string; end_time: string; notes?: string | null; group_label?: string | null }) =>
      req<ClassScheduleSlot>(`/me/my-classes/${classId}/schedule/${slotId}`, { method: 'PUT', body: JSON.stringify(body) }),
    deleteScheduleSlot: (classId: string, slotId: string) =>
      req<void>(`/me/my-classes/${classId}/schedule/${slotId}`, { method: 'DELETE' }),
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd /home/gtse8/GatewayTrainingTool/web && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
cd /home/gtse8/GatewayTrainingTool
git add web/src/lib/apiClient.ts
git commit -m "feat: add createScheduleSlot, updateScheduleSlot, deleteScheduleSlot to api.selfService"
```

---

## Task 5: Frontend — expose `setSchedule` from context

**Files:**
- Modify: `web/src/contexts/TrainerClassDetailContext.tsx`

- [ ] **Step 1: Add `setSchedule` to the context interface**

In `TrainerClassDetailContext.tsx`, find the `TrainerClassDetailContextValue` interface. It currently ends with:

```typescript
  setReports: React.Dispatch<React.SetStateAction<ClassDailyReport[]>>
  setTrainerHours: React.Dispatch<React.SetStateAction<ClassLoggedHours[]>>
  setStudentHours: React.Dispatch<React.SetStateAction<ClassLoggedHours[]>>
  setDrills: React.Dispatch<React.SetStateAction<ClassDrill[]>>
```

Add `setSchedule` after `setDrills`:

```typescript
  setReports: React.Dispatch<React.SetStateAction<ClassDailyReport[]>>
  setTrainerHours: React.Dispatch<React.SetStateAction<ClassLoggedHours[]>>
  setStudentHours: React.Dispatch<React.SetStateAction<ClassLoggedHours[]>>
  setDrills: React.Dispatch<React.SetStateAction<ClassDrill[]>>
  setSchedule: React.Dispatch<React.SetStateAction<ClassScheduleSlot[]>>
```

- [ ] **Step 2: Expose `setSchedule` in the Provider's value prop**

Find the `<TrainerClassDetailContext.Provider value={{` block. It currently includes:

```typescript
      setReports, setTrainerHours, setStudentHours, setDrills,
```

Change it to:

```typescript
      setReports, setTrainerHours, setStudentHours, setDrills, setSchedule,
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd /home/gtse8/GatewayTrainingTool/web && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
cd /home/gtse8/GatewayTrainingTool
git add web/src/contexts/TrainerClassDetailContext.tsx
git commit -m "feat: expose setSchedule from TrainerClassDetailContext"
```

---

## Task 6: Frontend — upgrade TrainerScheduleSection to full CRUD

**Files:**
- Modify: `web/src/pages/TrainerClassDetail/TrainerScheduleSection.tsx`

- [ ] **Step 1: Replace the file contents entirely**

```typescript
import { useState } from 'react'
import { api } from '../../lib/apiClient'
import { useTrainerClassDetail } from '../../contexts/TrainerClassDetailContext'
import { SkeletonTable } from '../../components/Skeleton'
import { EmptyState } from '../../components/EmptyState'
import { ConfirmDialog } from '../../components/ConfirmDialog'
import { useToast } from '../../contexts/ToastContext'
import type { ClassScheduleSlot } from '../../types'

export function TrainerScheduleSection() {
  const { classId, classInfo, schedule, loading, refreshSchedule, setSchedule } = useTrainerClassDetail()
  const { toast } = useToast()

  const [formOpen, setFormOpen] = useState(false)
  const [editingSlot, setEditingSlot] = useState<ClassScheduleSlot | null>(null)
  const [formDate, setFormDate] = useState('')
  const [formStart, setFormStart] = useState('')
  const [formEnd, setFormEnd] = useState('')
  const [formGroup, setFormGroup] = useState('')
  const [formNotes, setFormNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<ClassScheduleSlot | null>(null)

  const archived = classInfo?.archived ?? false

  function resetForm() {
    setFormDate('')
    setFormStart('')
    setFormEnd('')
    setFormGroup('')
    setFormNotes('')
    setEditingSlot(null)
    setFormOpen(false)
  }

  function openEditForm(slot: ClassScheduleSlot) {
    setEditingSlot(slot)
    setFormDate(slot.slot_date)
    setFormStart(slot.start_time)
    setFormEnd(slot.end_time)
    setFormGroup(slot.group_label ?? '')
    setFormNotes(slot.notes ?? '')
    setFormOpen(true)
  }

  function openAddForm() {
    setEditingSlot(null)
    setFormDate('')
    setFormStart('')
    setFormEnd('')
    setFormGroup('')
    setFormNotes('')
    setFormOpen(true)
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!formDate || !formStart || !formEnd) return
    setSaving(true)

    const body = {
      slot_date: formDate,
      start_time: formStart,
      end_time: formEnd,
      group_label: formGroup.trim() || null,
      notes: formNotes.trim() || null,
    }

    try {
      if (editingSlot) {
        await api.selfService.updateScheduleSlot(classId, editingSlot.id, body)
        toast('Slot updated', 'success')
      } else {
        await api.selfService.createScheduleSlot(classId, body)
        toast('Slot added', 'success')
      }
      resetForm()
      refreshSchedule()
    } catch (err) {
      toast((err as Error).message, 'error')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return
    const prev = schedule
    setSchedule(s => s.filter(slot => slot.id !== deleteTarget.id))
    setDeleteTarget(null)
    toast('Slot deleted', 'success')
    try {
      await api.selfService.deleteScheduleSlot(classId, deleteTarget.id)
    } catch (err) {
      toast((err as Error).message, 'error')
      setSchedule(prev)
    }
  }

  const fieldClass = 'mt-1 w-full bg-slate-100 dark:bg-gw-elevated border border-slate-200 dark:border-white/10 rounded-md px-2 py-1.5 text-xs text-slate-700 dark:text-slate-200 placeholder:text-slate-500 outline-none focus:border-gw-blue/40 focus:ring-2 focus:ring-gw-blue/15'

  return (
    <section className="bg-white dark:bg-gw-surface rounded-[10px] p-4">
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Schedule
            {!loading && schedule.length > 0 && (
              <span className="ml-1.5 font-normal normal-case tracking-normal text-slate-500">({schedule.length} slots)</span>
            )}
          </h3>
          <p className="mt-0.5 text-xs text-slate-500">All scheduled sessions for this class.</p>
        </div>
        {!archived && (
          <button
            type="button"
            onClick={() => formOpen ? resetForm() : openAddForm()}
            className="rounded-md bg-gradient-to-r from-gw-blue to-gw-teal text-white font-semibold px-3 py-1.5 text-xs hover:brightness-110 transition-all duration-150 self-start sm:self-auto flex-shrink-0"
          >
            {formOpen ? 'Cancel' : '+ Add slot'}
          </button>
        )}
      </header>

      {formOpen && (
        <form onSubmit={handleSave} className="mb-4 rounded-[10px] border border-slate-200 dark:border-white/[0.06] bg-slate-100 dark:bg-gw-elevated p-3">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-2">
            {editingSlot ? `Editing slot — ${editingSlot.slot_date}` : 'New schedule slot'}
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 text-xs">
            <div>
              <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Date
                <input type="date" value={formDate} onChange={e => setFormDate(e.target.value)} className={fieldClass} required />
              </label>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Start time
                <input type="time" value={formStart} onChange={e => setFormStart(e.target.value)} className={fieldClass} required />
              </label>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">End time
                <input type="time" value={formEnd} onChange={e => setFormEnd(e.target.value)} className={fieldClass} required />
              </label>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Group label <span className="font-normal">(optional)</span>
                <input type="text" value={formGroup} onChange={e => setFormGroup(e.target.value)} className={fieldClass} placeholder="e.g. Group A" />
              </label>
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Notes <span className="font-normal">(optional)</span>
                <input type="text" value={formNotes} onChange={e => setFormNotes(e.target.value)} className={fieldClass} placeholder="Any notes for this session…" />
              </label>
            </div>
            <div className="md:col-span-3 flex justify-end gap-2">
              <button type="button" onClick={resetForm} className="rounded-md bg-white dark:bg-gw-surface text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-white/10 px-3 py-1.5 text-xs font-semibold hover:bg-slate-100 dark:hover:bg-gw-elevated transition-colors duration-150">Cancel</button>
              <button type="submit" disabled={saving} className="rounded-md bg-gradient-to-r from-gw-blue to-gw-teal text-white px-3 py-1.5 text-xs font-semibold hover:brightness-110 transition-all duration-150 disabled:opacity-50">
                {saving ? 'Saving…' : editingSlot ? 'Update slot' : 'Save slot'}
              </button>
            </div>
          </div>
        </form>
      )}

      {loading ? (
        <SkeletonTable rows={5} cols={5} />
      ) : schedule.length === 0 ? (
        <div className="bg-slate-100 dark:bg-gw-elevated rounded-[10px]">
          <EmptyState title="No schedule yet" description="No schedule slots have been added to this class." variant="neutral" />
        </div>
      ) : (
        <div className="bg-slate-100 dark:bg-gw-elevated rounded-[10px] overflow-x-auto">
          <table className="min-w-full text-xs">
            <thead>
              <tr className="bg-white/[0.02] border-b border-slate-200 dark:border-white/[0.06]">
                <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Date</th>
                <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Time</th>
                <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 hidden sm:table-cell">Group</th>
                <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 hidden md:table-cell">Notes</th>
                {!archived && <th className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">Actions</th>}
              </tr>
            </thead>
            <tbody>
              {schedule.map(slot => (
                <tr key={slot.id} className="border-b border-white/[0.03] hover:bg-white dark:bg-gw-surface transition-colors duration-100">
                  <td className="px-3 py-2 text-slate-700 dark:text-slate-200 font-medium">{slot.slot_date}</td>
                  <td className="px-3 py-2 text-slate-500 dark:text-slate-400">{slot.start_time}–{slot.end_time}</td>
                  <td className="px-3 py-2 text-slate-500 dark:text-slate-400 hidden sm:table-cell">{slot.group_label ?? '—'}</td>
                  <td className="px-3 py-2 text-slate-400 dark:text-slate-500 hidden md:table-cell">{slot.notes ?? '—'}</td>
                  {!archived && (
                    <td className="px-3 py-2 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button type="button" onClick={() => openEditForm(slot)} className="rounded px-2 py-1 text-[11px] font-medium text-gw-blue hover:bg-gw-blue/10 transition-colors">Edit</button>
                        <button type="button" onClick={() => setDeleteTarget(slot)} className="rounded px-2 py-1 text-[11px] font-medium text-rose-400 hover:bg-rose-500/10 transition-colors">Delete</button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete slot"
        message={`Delete the slot on ${deleteTarget?.slot_date} (${deleteTarget?.start_time}–${deleteTarget?.end_time})?`}
        confirmLabel="Delete"
        confirmVariant="danger"
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </section>
  )
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd /home/gtse8/GatewayTrainingTool/web && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
cd /home/gtse8/GatewayTrainingTool
git add web/src/pages/TrainerClassDetail/TrainerScheduleSection.tsx
git commit -m "feat: trainer schedule section — add, edit, delete slots"
```

---

## Task 7: Manual verification

- [ ] **Step 1: Start both servers**

Terminal 1 (backend):
```bash
cd /home/gtse8/GatewayTrainingTool/server && npm run dev
```

Terminal 2 (frontend):
```bash
cd /home/gtse8/GatewayTrainingTool/web && npm run dev
```

- [ ] **Step 2: Log in as a trainer and navigate to a class**

Go to `http://localhost:5173`, sign in with a trainer account, navigate to My Classes → pick a class → Schedule tab.

Expected: "+ Add slot" button visible in the section header.

- [ ] **Step 3: Add a slot**

Click "+ Add slot", fill in a date, start time, end time, and click "Save slot".

Expected: form closes, new slot appears in the table (list refreshed from server).

- [ ] **Step 4: Edit a slot**

Click "Edit" on the new slot, change the time, click "Update slot".

Expected: table updates with the new time.

- [ ] **Step 5: Delete a slot**

Click "Delete" on the slot, confirm in the dialog.

Expected: slot disappears immediately (optimistic update), stays gone.

- [ ] **Step 6: Verify archived class blocks writes**

Find a class marked as archived. Navigate to its Schedule tab as a trainer.

Expected: no "+ Add slot" button, no Edit/Delete buttons in rows.

- [ ] **Step 7: Verify a trainer cannot modify another class's slots**

Attempt a direct PUT/DELETE API call with a `classId` the trainer is not assigned to.

Expected: 403 response from the server.
