# Student Failure, Global Search, and Report Comments — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add student failure tracking, global Cmd+K search for students/trainers/reports, and coordinator feedback comments on daily reports.

**Architecture:** Three independent feature sets sharing one migration file. Student failure extends the enrollment status domain and wires auto-fail logic into both trainer and coordinator report handlers. Global search adds a role-aware Express endpoint and extends CommandPalette with debounced API results. Report comments add a single nullable column to `class_daily_reports` and a coordinator-only textarea in the shared edit form.

**Tech Stack:** Express + TypeScript (backend), React + Tailwind (frontend), Supabase JS client (DB queries), React Router v6.

---

## File Map

| File | Change |
|------|--------|
| `server/src/migrations/008_failed_status_and_coordinator_notes.sql` | Create — DB migration |
| `server/src/lib/autoFail.ts` | Create — shared auto-fail helper |
| `server/src/routes/search.ts` | Create — global search router |
| `server/src/routes/selfService.ts` | Modify — auto-fail calls in report POST/PUT + PATCH enrollment endpoint |
| `server/src/routes/reports.ts` | Modify — auto-fail calls in report POST/PUT + coordinator_notes in PUT |
| `server/src/routes/index.ts` | Modify — mount search router |
| `web/src/types/index.ts` | Modify — EnrollmentStatus + ClassDailyReport.coordinator_notes |
| `web/src/lib/apiClient.ts` | Modify — ReportBody.coordinator_notes + SearchResults type + api.search + updateEnrollmentStatus |
| `web/src/contexts/TrainerClassDetailContext.tsx` | Modify — expose setEnrollments |
| `web/src/pages/TrainerClassDetail/TrainerStudentsSection.tsx` | Modify — Fail/Unfail buttons + updated badge |
| `web/src/pages/ClassDetail/ClassStudentsSection.tsx` | Modify — Fail/Unfail buttons + updated badge + remove waitlist option |
| `web/src/components/ReportEditForm.tsx` | Modify — coordinator_notes field + canEditCoordinatorNotes prop |
| `web/src/pages/ClassDetail/ClassReportsSection.tsx` | Modify — pass canEditCoordinatorNotes + coordinator_notes to form |
| `web/src/pages/TrainerClassDetail/TrainerReportsSection.tsx` | Modify — pass canEditCoordinatorNotes={false} to form |
| `web/src/components/CommandPalette.tsx` | Modify — debounced API search + grouped results |

---

## Task 1: DB Migration

**Files:**
- Create: `server/src/migrations/008_failed_status_and_coordinator_notes.sql`

- [ ] **Step 1: Write migration file**

```sql
-- Migration 008: Add 'failed' enrollment status and coordinator_notes on reports
-- Run this in the Supabase SQL editor.

-- 1. Update enrollment status check constraint to include 'failed', remove 'waitlist'.
--    Supabase creates the constraint named <table>_<column>_check by default.
--    Use DROP CONSTRAINT IF EXISTS with the likely name, then add the new one.
ALTER TABLE class_enrollments
  DROP CONSTRAINT IF EXISTS class_enrollments_status_check;

ALTER TABLE class_enrollments
  ADD CONSTRAINT class_enrollments_status_check
    CHECK (status IN ('enrolled', 'dropped', 'failed'));

-- 2. Add coordinator_notes column to class_daily_reports.
ALTER TABLE class_daily_reports
  ADD COLUMN IF NOT EXISTS coordinator_notes text;
```

- [ ] **Step 2: Run migration in Supabase SQL editor**

Open the Supabase project → SQL Editor → paste the file contents → Run.
Expected: success with no rows returned. If the `DROP CONSTRAINT` fails with "constraint does not exist", query `information_schema.table_constraints` to find the real constraint name and adjust.

- [ ] **Step 3: Commit**

```bash
git add server/src/migrations/008_failed_status_and_coordinator_notes.sql
git commit -m "db: add failed enrollment status and coordinator_notes column"
```

---

## Task 2: Type Updates

**Files:**
- Modify: `web/src/types/index.ts:91` — EnrollmentStatus
- Modify: `web/src/types/index.ts:139-156` — ClassDailyReport

- [ ] **Step 1: Update EnrollmentStatus**

In `web/src/types/index.ts`, change line 91:

```ts
// Before
export type EnrollmentStatus = 'enrolled' | 'waitlist' | 'dropped'

// After
export type EnrollmentStatus = 'enrolled' | 'dropped' | 'failed'
```

- [ ] **Step 2: Add coordinator_notes to ClassDailyReport**

In `web/src/types/index.ts`, add the field to `ClassDailyReport` after `override_live_hours_total`:

```ts
  override_live_hours_total: number | null  // Manual override for live floor hours total
  coordinator_notes: string | null           // Feedback left by coordinator (trainer sees read-only)
  created_at: string
```

- [ ] **Step 3: Check for TypeScript errors caused by the EnrollmentStatus change**

```bash
cd /home/gtse8/GatewayTrainingTool/web && npx tsc --noEmit 2>&1 | head -30
```

Expected: any errors referencing `'waitlist'` — note the files; they will be fixed in Task 9.

- [ ] **Step 4: Commit**

```bash
git add web/src/types/index.ts
git commit -m "types: add failed enrollment status and coordinator_notes to ClassDailyReport"
```

---

## Task 3: Auto-Fail Helper

**Files:**
- Create: `server/src/lib/autoFail.ts`

- [ ] **Step 1: Write the helper**

```ts
// server/src/lib/autoFail.ts
// Shared helper: auto-fail enrolled students who have coming_back_next_day = false
// in the given report's progress rows.

import { supabase } from './supabase'
import { logAudit } from './audit'

export async function autoFailNotComingBack(
  classId: string,
  reportId: string,
  userId: string,
  ip: string | undefined,
): Promise<void> {
  // Find enrollment_ids where the student is not coming back
  const { data: failedProgress, error: progressError } = await supabase
    .from('class_daily_report_trainee_progress')
    .select('enrollment_id')
    .eq('report_id', reportId)
    .eq('coming_back_next_day', false)
  if (progressError) throw progressError

  const ids = (failedProgress ?? []).map((p: { enrollment_id: string }) => p.enrollment_id)
  if (ids.length === 0) return

  // Only update currently enrolled students (not already dropped/failed)
  const { data: updated, error: updateError } = await supabase
    .from('class_enrollments')
    .update({ status: 'failed' })
    .in('id', ids)
    .eq('class_id', classId)
    .eq('status', 'enrolled')
    .select('id')
  if (updateError) throw updateError

  for (const row of updated ?? []) {
    await logAudit({
      userId,
      action: 'UPDATE',
      tableName: 'class_enrollments',
      recordId: (row as { id: string }).id,
      metadata: { class_id: classId, reason: 'auto_fail_not_coming_back', report_id: reportId },
      ipAddress: ip,
    })
  }
}
```

- [ ] **Step 2: Verify it compiles**

```bash
cd /home/gtse8/GatewayTrainingTool/server && npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add server/src/lib/autoFail.ts
git commit -m "feat: add autoFailNotComingBack helper"
```

---

## Task 4: Auto-Fail in Trainer Report Handlers

**Files:**
- Modify: `server/src/routes/selfService.ts`

The trainer POST handler is at line 564 and PUT handler at line 676. Both end with `logAudit(...)` then `res.json(report)` / `res.status(201).json(report)`. The auto-fail call goes immediately after the progress rows are re-inserted and before `logAudit`.

- [ ] **Step 1: Import autoFailNotComingBack in selfService.ts**

At the top of `server/src/routes/selfService.ts`, add:

```ts
import { autoFailNotComingBack } from '../lib/autoFail'
```

(Add after the existing `import { logAudit } from '../lib/audit'` line.)

- [ ] **Step 2: Add auto-fail call to trainer report POST handler**

In `selfService.ts`, inside the POST `/me/my-classes/:classId/reports` handler, after the drill_times insert block (after `if (dtError) throw dtError`) and before the `logAudit(...)` call, add:

```ts
    // Auto-fail students who are not coming back
    await autoFailNotComingBack(classId, reportId, req.userId!, req.ip)
```

The exact insertion point is between the closing `}` of the `if (drill_times.length > 0)` block and `await logAudit({`. In the current file this is around line 659.

- [ ] **Step 3: Add auto-fail call to trainer report PUT handler**

In `selfService.ts`, inside the PUT `/me/my-classes/:classId/reports/:reportId` handler, after the drill_times delete-and-replace block (after `if (dtError) throw dtError`) and before `logAudit(...)`, add the same line:

```ts
    // Auto-fail students who are not coming back
    await autoFailNotComingBack(classId, reportId, req.userId!, req.ip)
```

The insertion point is between `if (dtError) throw dtError` (around line 775) and `await logAudit({` (around line 778).

- [ ] **Step 4: Verify no TypeScript errors**

```bash
cd /home/gtse8/GatewayTrainingTool/server && npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add server/src/routes/selfService.ts
git commit -m "feat: auto-fail students not coming back on trainer report save"
```

---

## Task 5: Auto-Fail in Coordinator Report Handlers + Coordinator Notes

**Files:**
- Modify: `server/src/routes/reports.ts`

The coordinator POST handler is around line 244 and PUT around line 371.

- [ ] **Step 1: Import autoFailNotComingBack in reports.ts**

Add to the top of `server/src/routes/reports.ts`:

```ts
import { autoFailNotComingBack } from '../lib/autoFail'
```

(Add after `import { logAudit } from '../lib/audit'`.)

- [ ] **Step 2: Add auto-fail call to coordinator report POST handler**

In `reports.ts`, inside `POST /classes/:classId/reports`, after the drill_times insert block (after `if (dtError) throw dtError`, around line 338) and before `await logAudit({`, add:

```ts
    // Auto-fail students who are not coming back
    await autoFailNotComingBack(req.params.classId, reportId, req.userId!, req.ip)
```

- [ ] **Step 3: Add auto-fail call to coordinator report PUT handler**

In `reports.ts`, inside `PUT /classes/:classId/reports/:id`, after the drill_times delete-and-replace block (after `if (dtError) throw dtError`, around line 480) and before `await logAudit({`, add:

```ts
    // Auto-fail students who are not coming back
    await autoFailNotComingBack(req.params.classId, reportId, req.userId!, req.ip)
```

- [ ] **Step 4: Accept coordinator_notes in PUT handler**

In `reports.ts`, inside `PUT /classes/:classId/reports/:id`, add `coordinator_notes` to the destructured body:

```ts
    const {
      report_date,
      group_label,
      // ... existing fields ...
      override_live_hours_total,
      coordinator_notes,          // ← add this line
      trainer_ids = [],
```

Add `coordinator_notes: coordinator_notes ?? null` to the `.update({...})` call's object, alongside the other fields:

```ts
      override_live_hours_total: override_live_hours_total ?? null,
      coordinator_notes: coordinator_notes ?? null,   // ← add this line
    })
```

- [ ] **Step 5: Verify no TypeScript errors**

```bash
cd /home/gtse8/GatewayTrainingTool/server && npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add server/src/routes/reports.ts
git commit -m "feat: auto-fail on coordinator report save; accept coordinator_notes on report PUT"
```

---

## Task 6: PATCH Enrollment Endpoint + API Client Methods

**Files:**
- Modify: `server/src/routes/selfService.ts`
- Modify: `web/src/lib/apiClient.ts`

- [ ] **Step 1: Add PATCH enrollment endpoint to selfService.ts**

After the schedule write endpoints section (after the `DELETE /me/my-classes/:classId/schedule/:slotId` handler) and before the `// ─── Cross-class Read Endpoints ───` comment, add:

```ts
// ─── Enrollment Write Endpoints ──────────────────────────────────────────────

selfServiceRouter.patch('/me/my-classes/:classId/enrollments/:enrollmentId', writeLimiter, async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.userEmail) { res.status(401).json({ error: 'No email associated with this account' }); return }
    const classId = req.params.classId as string
    const enrollmentId = req.params.enrollmentId as string
    await validateTrainerAccess(req.userEmail, classId)

    const { data: cls } = await supabase.from('classes').select('archived').eq('id', classId).single()
    if (cls?.archived) { res.status(400).json({ error: 'Cannot modify data for archived classes' }); return }

    const { status } = req.body as { status?: string }
    if (!status || !['enrolled', 'failed'].includes(status)) {
      res.status(400).json({ error: 'status must be "enrolled" or "failed"' })
      return
    }

    const { data, error } = await supabase
      .from('class_enrollments')
      .update({ status })
      .eq('id', enrollmentId)
      .eq('class_id', classId)
      .select()
      .single()
    if (error) {
      if (error.code === 'PGRST116') { res.status(404).json({ error: 'Enrollment not found' }); return }
      throw error
    }

    await logAudit({
      userId: req.userId!,
      action: 'UPDATE',
      tableName: 'class_enrollments',
      recordId: enrollmentId,
      metadata: { class_id: classId, status, updated_by: 'trainer' },
      ipAddress: req.ip,
    })

    res.json(data)
  } catch (err) {
    if ((err as Error & { status?: number }).status === 403) { res.status(403).json({ error: (err as Error).message }); return }
    next(err)
  }
})
```

- [ ] **Step 2: Add SearchResults type and api.search to apiClient.ts**

At the end of the type definitions near the top of `apiClient.ts` (after the `StudentReportView` import block), add after the existing interface definitions:

```ts
export interface SearchResults {
  students: Array<{ id: string; name: string; email: string; classId: string; className: string }>
  trainers: Array<{ id: string; name: string; email: string }>
  reports: Array<{ id: string; classId: string; className: string; reportDate: string }>
}
```

Add to `web/src/lib/apiClient.ts` imports at the top:
```ts
// (no new import needed — SearchResults is defined in apiClient.ts itself)
```

- [ ] **Step 3: Add updateEnrollmentStatus and api.search to apiClient.ts**

In `apiClient.ts`, at the end of the `selfService` object (after `deleteScheduleSlot`), add:

```ts
    // Class-scoped writes — enrollments (trainer manual fail/unfail)
    updateEnrollmentStatus: (classId: string, enrollmentId: string, body: { status: 'enrolled' | 'failed' }) =>
      req<ClassEnrollment>(`/me/my-classes/${classId}/enrollments/${enrollmentId}`, { method: 'PATCH', body: JSON.stringify(body) }),
```

In `apiClient.ts`, add a top-level `search` property on the exported `api` object (after `roleRequests`):

```ts
  search: {
    query: (q: string) => req<SearchResults>(`/search?q=${encodeURIComponent(q)}`),
  },
```

- [ ] **Step 4: Add coordinator_notes to ReportBody**

In `apiClient.ts`, in the `ReportBody` interface (around line 161), add:

```ts
  coordinator_notes?: string | null
```

(After `override_live_hours_total?: number | null` and before `trainer_ids`.)

- [ ] **Step 5: Verify no TypeScript errors**

```bash
cd /home/gtse8/GatewayTrainingTool/server && npx tsc --noEmit 2>&1 | head -10
cd /home/gtse8/GatewayTrainingTool/web && npx tsc --noEmit 2>&1 | head -10
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add server/src/routes/selfService.ts web/src/lib/apiClient.ts
git commit -m "feat: PATCH enrollment status endpoint + updateEnrollmentStatus + api.search + coordinator_notes in ReportBody"
```

---

## Task 7: Expose setEnrollments from TrainerClassDetailContext

**Files:**
- Modify: `web/src/contexts/TrainerClassDetailContext.tsx`

- [ ] **Step 1: Add setEnrollments to the context interface**

In `TrainerClassDetailContext.tsx`, in the `TrainerClassDetailContextValue` interface, add after the `setSchedule` line:

```ts
  setEnrollments: React.Dispatch<React.SetStateAction<ClassEnrollment[]>>
```

- [ ] **Step 2: Add setEnrollments to the provider value object**

In `TrainerClassDetailContext.tsx`, in the `<TrainerClassDetailContext.Provider value={{...}}>` object, add `setEnrollments` alongside the other setters:

```ts
      setReports, setTrainerHours, setStudentHours, setDrills, setSchedule, setEnrollments,
```

- [ ] **Step 3: Verify no TypeScript errors**

```bash
cd /home/gtse8/GatewayTrainingTool/web && npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add web/src/contexts/TrainerClassDetailContext.tsx
git commit -m "feat: expose setEnrollments from TrainerClassDetailContext"
```

---

## Task 8: TrainerStudentsSection — Fail/Unfail Buttons

**Files:**
- Modify: `web/src/pages/TrainerClassDetail/TrainerStudentsSection.tsx`

- [ ] **Step 1: Rewrite TrainerStudentsSection with Fail/Unfail support**

Replace the entire file with:

```tsx
import { useState } from 'react'
import { api } from '../../lib/apiClient'
import { useTrainerClassDetail } from '../../contexts/TrainerClassDetailContext'
import { useToast } from '../../contexts/ToastContext'
import { EmptyState } from '../../components/EmptyState'
import { SkeletonTable } from '../../components/Skeleton'
import type { ClassEnrollment } from '../../types'

export function TrainerStudentsSection() {
  const { classId, classInfo, enrollments, loading, setEnrollments, refreshEnrollments } = useTrainerClassDetail()
  const { toast } = useToast()
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  const archived = classInfo?.archived ?? false

  async function handleToggleFail(enrollment: ClassEnrollment) {
    if (actionLoading) return
    const newStatus = enrollment.status === 'failed' ? 'enrolled' : 'failed'
    const prev = enrollments
    setEnrollments(es => es.map(e => e.id === enrollment.id ? { ...e, status: newStatus } : e))
    toast(newStatus === 'failed' ? 'Student marked as failed' : 'Student reinstated', 'success')
    setActionLoading(enrollment.id)
    try {
      await api.selfService.updateEnrollmentStatus(classId, enrollment.id, { status: newStatus })
      refreshEnrollments()
    } catch (err) {
      toast((err as Error).message, 'error')
      setEnrollments(prev)
    } finally {
      setActionLoading(null)
    }
  }

  return (
    <section className="bg-white dark:bg-gw-surface rounded-[10px] p-4">
      <header className="mb-3">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
          Enrolled students
          {!loading && enrollments.length > 0 && (
            <span className="ml-1.5 font-normal normal-case tracking-normal text-slate-500">({enrollments.length})</span>
          )}
        </h3>
        <p className="mt-0.5 text-xs text-slate-500">Students enrolled in this class.</p>
      </header>

      {loading ? (
        <SkeletonTable rows={4} cols={5} />
      ) : enrollments.length === 0 ? (
        <div className="bg-slate-100 dark:bg-gw-elevated rounded-[10px]">
          <EmptyState title="No students enrolled" description="No students are currently enrolled in this class." variant="neutral" />
        </div>
      ) : (
        <div className="bg-slate-100 dark:bg-gw-elevated rounded-[10px] overflow-x-auto">
          <table className="min-w-full text-xs">
            <thead>
              <tr className="bg-white/[0.02] border-b border-slate-200 dark:border-white/[0.06]">
                <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Name</th>
                <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 hidden sm:table-cell">Email</th>
                <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Status</th>
                <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 hidden sm:table-cell">Group</th>
                {!archived && <th className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">Actions</th>}
              </tr>
            </thead>
            <tbody>
              {enrollments.map(e => (
                <tr key={e.id} className="border-b border-white/[0.03] hover:bg-white dark:bg-gw-surface transition-colors duration-100">
                  <td className="px-3 py-2 text-slate-700 dark:text-slate-200">{e.student_name}</td>
                  <td className="px-3 py-2 text-slate-500 dark:text-slate-400 hidden sm:table-cell">{e.student_email}</td>
                  <td className="px-3 py-2">
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium ${
                      e.status === 'enrolled' ? 'bg-emerald-500/15 text-emerald-300' :
                      e.status === 'failed'   ? 'bg-rose-500/15 text-rose-400' :
                      'bg-slate-500/15 text-slate-400'
                    }`}>
                      {e.status}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-slate-500 dark:text-slate-400 hidden sm:table-cell">{e.group_label ?? '—'}</td>
                  {!archived && (
                    <td className="px-3 py-2 text-right">
                      {(e.status === 'enrolled' || e.status === 'failed') && (
                        <button
                          type="button"
                          onClick={() => handleToggleFail(e)}
                          disabled={actionLoading === e.id}
                          className={`rounded px-2 py-1 text-[11px] font-medium transition-colors disabled:opacity-50 ${
                            e.status === 'failed'
                              ? 'text-emerald-400 hover:bg-emerald-500/10'
                              : 'text-rose-400 hover:bg-rose-500/10'
                          }`}
                        >
                          {e.status === 'failed' ? 'Unfail' : 'Fail'}
                        </button>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
```

- [ ] **Step 2: Verify no TypeScript errors**

```bash
cd /home/gtse8/GatewayTrainingTool/web && npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add web/src/pages/TrainerClassDetail/TrainerStudentsSection.tsx
git commit -m "feat: trainer can fail/unfail students from students tab"
```

---

## Task 9: ClassStudentsSection — Fail/Unfail Buttons

**Files:**
- Modify: `web/src/pages/ClassDetail/ClassStudentsSection.tsx`

Four changes: (1) remove 'waitlist' from status dropdowns, (2) update status badge to show 'failed' in rose, (3) add Fail/Unfail button in each row, (4) add `handleToggleFail` function.

- [ ] **Step 1: Remove waitlist option from the enroll-student status dropdown**

In `ClassStudentsSection.tsx`, find the status `<select>` inside the `enrollOpen` modal (around line 325):

```tsx
// Remove this option:
<option value="waitlist">Waitlist</option>
```

The select should now only have:
```tsx
<select value={status} onChange={e => setStatus(e.target.value as EnrollmentStatus)} className={`w-28 ${fieldClass}`}>
  <option value="enrolled">Enrolled</option>
  <option value="dropped">Dropped</option>
</select>
```

- [ ] **Step 2: Remove waitlist option from the edit-enrollment status dropdown**

Find the edit modal's status `<select>` and remove the same waitlist option from it, keeping only `enrolled` and `dropped`.

- [ ] **Step 3: Update status badge**

Find the status badge span (around line 43-48 in the original `TrainerStudentsSection.tsx`; the coordinator version is in a similar location in the table rows). Update the className logic to:

```tsx
className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium ${
  e.status === 'enrolled' ? 'bg-emerald-500/15 text-emerald-300' :
  e.status === 'failed'   ? 'bg-rose-500/15 text-rose-400' :
  'bg-slate-500/15 text-slate-400'
}`}
```

- [ ] **Step 4: Add handleToggleFail function**

Add the following function alongside the other handlers (`handleEnrollStudent`, `handleSaveEdit`, `handleRemove`):

```tsx
async function handleToggleFail(enrollment: ClassEnrollment) {
  const newStatus: EnrollmentStatus = enrollment.status === 'failed' ? 'enrolled' : 'failed'
  const prev = students
  setEnrollments(s => s.map(e => e.id === enrollment.id ? { ...e, status: newStatus } : e))
  toast(newStatus === 'failed' ? 'Student marked as failed' : 'Student reinstated', 'success')
  try {
    await api.enrollments.update(classId, enrollment.id, {
      status: newStatus,
      group_label: enrollment.group_label,
    })
    refreshEnrollments()
  } catch (err) {
    console.error('toggleFail error:', (err as Error).message)
    toast((err as Error).message, 'error')
    setEnrollments(prev)
  }
}
```

- [ ] **Step 5: Add Actions column to the table**

In the table header, add a right-aligned Actions column (check whether `classInfo.archived` is accessible — it should be via `useClassDetail()`; if not, use `classInfo?.archived ?? false` from the context):

```tsx
{!archived && <th className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">Actions</th>}
```

Add `const archived = classInfo?.archived ?? false` near the top of the component. Check what `useClassDetail()` exposes — use whatever provides classInfo.

In each table row, add the Actions cell after the last `<td>`:

```tsx
{!archived && (
  <td className="px-3 py-2 text-right">
    {(e.status === 'enrolled' || e.status === 'failed') && (
      <button
        type="button"
        onClick={() => handleToggleFail(e)}
        className={`rounded px-2 py-1 text-[11px] font-medium transition-colors ${
          e.status === 'failed'
            ? 'text-emerald-400 hover:bg-emerald-500/10'
            : 'text-rose-400 hover:bg-rose-500/10'
        }`}
      >
        {e.status === 'failed' ? 'Unfail' : 'Fail'}
      </button>
    )}
  </td>
)}
```

- [ ] **Step 6: Verify no TypeScript errors**

```bash
cd /home/gtse8/GatewayTrainingTool/web && npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add web/src/pages/ClassDetail/ClassStudentsSection.tsx
git commit -m "feat: coordinator can fail/unfail students; remove waitlist status option"
```

---

## Task 10: ReportEditForm — Coordinator Notes

**Files:**
- Modify: `web/src/components/ReportEditForm.tsx`
- Modify: `web/src/pages/ClassDetail/ClassReportsSection.tsx`
- Modify: `web/src/pages/TrainerClassDetail/TrainerReportsSection.tsx`

- [ ] **Step 1: Add canEditCoordinatorNotes prop to ReportEditForm**

In `ReportEditForm.tsx`, add to `ReportEditFormProps`:

```ts
  canEditCoordinatorNotes: boolean
```

- [ ] **Step 2: Add coordinator_notes state to ReportEditForm**

In `ReportEditForm.tsx`, add state for coordinator notes. Find where `useState` is called for the other form fields and add:

```ts
  const [coordinatorNotes, setCoordinatorNotes] = useState(report?.coordinator_notes ?? '')
```

Also, in the `useEffect` that initialises form state from `report`, add:

```ts
    setCoordinatorNotes(report?.coordinator_notes ?? '')
```

- [ ] **Step 3: Include coordinator_notes in the onSave body**

In `ReportEditForm.tsx`, find the `body` object assembled before calling `onSave(body)`. Add:

```ts
    coordinator_notes: canEditCoordinatorNotes ? (coordinatorNotes.trim() || null) : undefined,
```

(Only coordinators send the field; when `canEditCoordinatorNotes` is false, `undefined` means the field is not in the body and the trainer's PUT handler ignores it.)

- [ ] **Step 4: Render coordinator notes field**

In the JSX, add a "Coordinator feedback" section near the bottom of the form (before the submit buttons), using the existing `fieldClass` variable:

```tsx
{/* Coordinator feedback — editable by coordinator, read-only for trainer */}
{(canEditCoordinatorNotes || report?.coordinator_notes) && (
  <CollapsibleSection title="Coordinator feedback" defaultOpen={!!(report?.coordinator_notes)}>
    {canEditCoordinatorNotes ? (
      <textarea
        value={coordinatorNotes}
        onChange={e => setCoordinatorNotes(e.target.value)}
        rows={3}
        placeholder="Leave feedback for the trainer…"
        className={fieldClass}
      />
    ) : (
      <p className="text-xs text-slate-500 dark:text-slate-400 italic border-l-2 border-slate-300 dark:border-white/20 pl-3">
        {report?.coordinator_notes}
      </p>
    )}
  </CollapsibleSection>
)}
```

- [ ] **Step 5: Update ClassReportsSection.tsx**

In `ClassReportsSection.tsx`, add `canEditCoordinatorNotes={true}` to the `<ReportEditForm>` render:

```tsx
<ReportEditForm
  report={editingReportFull}
  trainers={trainers}
  enrollments={enrollments}
  drills={drills}
  hours={hours}
  defaultGame={editingReportFull?.game ?? defaultGameType ?? ''}
  onSave={handleSaveFromForm}
  onCancel={() => { setReportFormOpen(false); setEditingReportFull(null) }}
  canDelete={!!editingReportFull}
  onDelete={editingReportFull ? () => handleRemoveReport(editingReportFull.id) : undefined}
  canEditCoordinatorNotes={true}
/>
```

- [ ] **Step 6: Update TrainerReportsSection.tsx**

In `TrainerReportsSection.tsx`, add `canEditCoordinatorNotes={false}` to the `<ReportEditForm>` render:

```tsx
<ReportEditForm
  report={editingReport}
  trainers={trainers}
  enrollments={activeEnr}
  drills={drills}
  hours={[...trainerHours, ...studentHours]}
  defaultGame={classInfo?.game_type ?? ''}
  onSave={handleSaveFromForm}
  onCancel={() => { setMode('list'); setEditingReport(null) }}
  canDelete={false}
  canEditCoordinatorNotes={false}
/>
```

- [ ] **Step 7: Update the handleSaveFromForm in ClassReportsSection to pass coordinator_notes**

The `onSave` handler in `ClassReportsSection.tsx` calls `api.reports.update(...)` with the body provided by `ReportEditForm`. Since `coordinator_notes` is now part of `ReportBody`, no additional changes are needed — it flows through automatically.

- [ ] **Step 8: Verify no TypeScript errors**

```bash
cd /home/gtse8/GatewayTrainingTool/web && npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors.

- [ ] **Step 9: Commit**

```bash
git add web/src/components/ReportEditForm.tsx web/src/pages/ClassDetail/ClassReportsSection.tsx web/src/pages/TrainerClassDetail/TrainerReportsSection.tsx
git commit -m "feat: coordinator can add feedback notes to daily reports; trainers see them read-only"
```

---

## Task 11: Global Search — Backend

**Files:**
- Create: `server/src/routes/search.ts`
- Modify: `server/src/routes/index.ts`

- [ ] **Step 1: Write search.ts**

```ts
/**
 * server/src/routes/search.ts — Global search endpoint
 *
 * GET /search?q=<term>
 * Auth: any authenticated user (requireAuth applied upstream)
 * Role-aware scoping:
 *   coordinator — searches all students, trainers, and reports in the system
 *   trainer     — searches only within classes where they appear in class_trainers
 *
 * Returns at most 5 results per category. Empty categories return [].
 */

import { Router, type Request, type Response, type NextFunction } from 'express'
import { supabase } from '../lib/supabase'

export const searchRouter = Router()

searchRouter.get('/search', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const q = (req.query.q as string | undefined)?.trim() ?? ''
    if (q.length < 2) {
      res.json({ students: [], trainers: [], reports: [] })
      return
    }

    const isCoordinator = req.userRole === 'coordinator'
    const trainerEmail = req.userEmail!

    // Resolve trainer's class IDs (trainer scope only)
    let trainerClassIds: string[] = []
    if (!isCoordinator) {
      const { data: trainerRows } = await supabase
        .from('class_trainers')
        .select('class_id')
        .eq('trainer_email', trainerEmail)
      trainerClassIds = (trainerRows ?? []).map((r: { class_id: string }) => r.class_id)
      if (trainerClassIds.length === 0) {
        res.json({ students: [], trainers: [], reports: [] })
        return
      }
    }

    // Student search — match student_name in class_enrollments
    const studentQuery = supabase
      .from('class_enrollments')
      .select('id, student_name, student_email, class_id, classes!inner(name)')
      .ilike('student_name', `%${q}%`)
      .limit(5)
    if (!isCoordinator) studentQuery.in('class_id', trainerClassIds)
    const { data: studentRows } = await studentQuery

    // Trainer search — coordinator only, match trainer_name in class_trainers
    let trainerRows: Array<{ id: string; trainer_name: string; trainer_email: string }> = []
    if (isCoordinator) {
      const { data } = await supabase
        .from('class_trainers')
        .select('id, trainer_name, trainer_email')
        .ilike('trainer_name', `%${q}%`)
        .limit(5)
      // Deduplicate by email
      const seen = new Set<string>()
      for (const r of data ?? []) {
        if (!seen.has(r.trainer_email)) {
          seen.add(r.trainer_email)
          trainerRows.push(r as { id: string; trainer_name: string; trainer_email: string })
        }
      }
      trainerRows = trainerRows.slice(0, 5)
    }

    // Report search — match class name
    const reportQuery = supabase
      .from('class_daily_reports')
      .select('id, class_id, report_date, classes!inner(name)')
      .ilike('classes.name', `%${q}%`)
      .order('report_date', { ascending: false })
      .limit(5)
    if (!isCoordinator) reportQuery.in('class_id', trainerClassIds)
    const { data: reportRows } = await reportQuery

    res.json({
      students: (studentRows ?? []).map((r: Record<string, unknown>) => ({
        id: r.id,
        name: r.student_name,
        email: r.student_email,
        classId: r.class_id,
        className: (r.classes as { name: string } | null)?.name ?? '',
      })),
      trainers: trainerRows.map(r => ({
        id: r.id,
        name: r.trainer_name,
        email: r.trainer_email,
      })),
      reports: (reportRows ?? []).map((r: Record<string, unknown>) => ({
        id: r.id,
        classId: r.class_id,
        className: (r.classes as { name: string } | null)?.name ?? '',
        reportDate: r.report_date,
      })),
    })
  } catch (err) {
    next(err)
  }
})
```

- [ ] **Step 2: Mount search router in routes/index.ts**

In `server/src/routes/index.ts`, add the import:

```ts
import { searchRouter } from './search'
```

And mount it alongside `selfServiceRouter` (before `requireCoordinator`):

```ts
// Self-service routes are accessible to all authenticated users (trainers and trainees)
router.use(selfServiceRouter)
router.use(searchRouter)       // ← add this line

// Everything below this line requires coordinator role
router.use(requireCoordinator as Router)
```

- [ ] **Step 3: Verify no TypeScript errors**

```bash
cd /home/gtse8/GatewayTrainingTool/server && npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add server/src/routes/search.ts server/src/routes/index.ts
git commit -m "feat: global search endpoint — students, trainers, reports by name"
```

---

## Task 12: CommandPalette — API Search

**Files:**
- Modify: `web/src/components/CommandPalette.tsx`

The current palette uses only local `filtered` items. This task adds debounced API search that runs when `query.length >= 2`, and renders API results below the local results, grouped.

- [ ] **Step 1: Add imports and state to CommandPalette**

Add these imports at the top of `CommandPalette.tsx`:

```ts
import { useEffect, useCallback } from 'react'  // already imported; just add useCallback if not there
import { api } from '../lib/apiClient'
import type { SearchResults } from '../lib/apiClient'
```

Add state inside the `CommandPalette` function:

```ts
  const [searchResults, setSearchResults] = useState<SearchResults>({ students: [], trainers: [], reports: [] })
  const [searchLoading, setSearchLoading] = useState(false)
```

- [ ] **Step 2: Add debounced API search effect**

Add this effect after the existing effects in `CommandPalette`:

```ts
  // Debounced API search — fires 300ms after query changes when query >= 2 chars
  useEffect(() => {
    if (query.trim().length < 2) {
      setSearchResults({ students: [], trainers: [], reports: [] })
      return
    }
    setSearchLoading(true)
    const timer = setTimeout(async () => {
      try {
        const results = await api.search.query(query.trim())
        setSearchResults(results)
      } catch {
        setSearchResults({ students: [], trainers: [], reports: [] })
      } finally {
        setSearchLoading(false)
      }
    }, 300)
    return () => clearTimeout(timer)
  }, [query])
```

- [ ] **Step 3: Add navigation helper for search results**

Add a `navigateToResult` callback below the `selectItem` function:

```ts
  const navigateToResult = useCallback((type: 'student' | 'trainer' | 'report', item: Record<string, string>) => {
    setOpen(false)
    if (type === 'student') {
      // Navigate to the class detail — coordinator goes to /classes/:slug, trainer to /my-classes/:classId
      const path = role === 'coordinator'
        ? `/classes/${classSlug(item.className)}`
        : `/my-classes/${item.classId}`
      navigate(path)
    } else if (type === 'trainer') {
      navigate('/trainers')
    } else if (type === 'report') {
      // Navigate to coordinator reports page filtered to this class
      const path = role === 'coordinator'
        ? `/reports?class_id=${item.classId}`
        : `/my-classes/${item.classId}`
      navigate(path)
    }
  }, [navigate, role])
```

- [ ] **Step 4: Update the keyboard navigation to include API results**

The current `handleKeyDown` and `selectedIndex` track a flat `filtered` list. API results are shown in separate sections below and are click-navigable but not keyboard-navigable (to keep the change minimal). The `selectedIndex` continues to track only local `filtered` items.

- [ ] **Step 5: Render API results below local results**

In the JSX, replace the results `<div ref={listRef}...>` section to append the API results groups after the existing `filtered.map(...)` block:

```tsx
        {/* Results */}
        <div ref={listRef} className="max-h-[400px] overflow-y-auto py-2">
          {/* Local page/class shortcuts */}
          {filtered.length === 0 && query.trim().length < 2 ? (
            <p className="px-4 py-6 text-sm text-slate-400 dark:text-slate-500 text-center">No results found</p>
          ) : (
            filtered.map((item, i) => (
              <button
                key={item.id}
                type="button"
                onClick={() => selectItem(item)}
                onMouseEnter={() => setSelectedIndex(i)}
                className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors duration-75 ${
                  i === selectedIndex ? 'bg-gw-blue/10 text-slate-900 dark:text-slate-100' : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/[0.03]'
                }`}
              >
                <svg className="w-4 h-4 shrink-0 text-slate-400 dark:text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                  <path strokeLinecap="round" strokeLinejoin="round" d={item.icon} />
                </svg>
                <div className="flex-1 min-w-0">
                  <span className="text-sm font-medium">{item.label}</span>
                  {item.description && (
                    <span className="ml-2 text-xs text-slate-400 dark:text-slate-500">{item.description}</span>
                  )}
                </div>
                {i === selectedIndex && (
                  <span className="text-[10px] text-slate-400 dark:text-slate-500 shrink-0">Enter ↵</span>
                )}
              </button>
            ))
          )}

          {/* API search results — shown when query >= 2 chars */}
          {query.trim().length >= 2 && (
            <>
              {searchLoading && (
                <p className="px-4 py-2 text-xs text-slate-400 dark:text-slate-500">Searching…</p>
              )}

              {!searchLoading && searchResults.students.length > 0 && (
                <div className="mt-1">
                  <p className="px-4 py-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">Students</p>
                  {searchResults.students.map(s => (
                    <button key={`student-${s.id}-${s.classId}`} type="button" onClick={() => navigateToResult('student', s)}
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-left text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/[0.03] transition-colors duration-75">
                      <div className="flex-1 min-w-0">
                        <span className="text-sm font-medium">{s.name}</span>
                        <span className="ml-2 text-xs text-slate-400 dark:text-slate-500">{s.className}</span>
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {!searchLoading && searchResults.trainers.length > 0 && (
                <div className="mt-1">
                  <p className="px-4 py-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">Trainers</p>
                  {searchResults.trainers.map(t => (
                    <button key={`trainer-${t.id}`} type="button" onClick={() => navigateToResult('trainer', t)}
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-left text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/[0.03] transition-colors duration-75">
                      <div className="flex-1 min-w-0">
                        <span className="text-sm font-medium">{t.name}</span>
                        <span className="ml-2 text-xs text-slate-400 dark:text-slate-500">{t.email}</span>
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {!searchLoading && searchResults.reports.length > 0 && (
                <div className="mt-1">
                  <p className="px-4 py-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">Reports</p>
                  {searchResults.reports.map(r => (
                    <button key={`report-${r.id}`} type="button" onClick={() => navigateToResult('report', r)}
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-left text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/[0.03] transition-colors duration-75">
                      <div className="flex-1 min-w-0">
                        <span className="text-sm font-medium">{r.className}</span>
                        <span className="ml-2 text-xs text-slate-400 dark:text-slate-500">{r.reportDate}</span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
```

Also update the placeholder text:

```tsx
placeholder="Search pages, classes, students…"
```

And increase `max-h` from `[320px]` to `[400px]` to accommodate more results.

- [ ] **Step 6: Reset search results when palette closes**

In the effect that resets state when `open` changes to `false`, add:

```ts
    if (open) {
      setQuery('')
      setSelectedIndex(0)
      setSearchResults({ students: [], trainers: [], reports: [] })   // ← add this
      setTimeout(() => inputRef.current?.focus(), 50)
    }
```

- [ ] **Step 7: Verify no TypeScript errors**

```bash
cd /home/gtse8/GatewayTrainingTool/web && npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors.

- [ ] **Step 8: Commit**

```bash
git add web/src/components/CommandPalette.tsx
git commit -m "feat: global search in CommandPalette — students, trainers, reports via API"
```

---

## Self-Review

**Spec coverage check:**

| Spec requirement | Task |
|-----------------|------|
| Add 'failed' to enrollment status | Tasks 1, 2 |
| Remove 'waitlist' from status | Tasks 1, 2, 9 |
| Auto-fail on trainer report save | Tasks 3, 4 |
| Auto-fail on coordinator report save | Tasks 3, 5 |
| Trainer manual fail/unfail | Tasks 6, 8 |
| Coordinator manual fail/unfail | Task 9 |
| Report pre-population excludes failed | No change needed — existing `status === 'enrolled'` filter handles it |
| coordinator_notes DB column | Task 1 |
| coordinator_notes on report PUT | Tasks 5, 6 |
| Coordinator sees editable textarea | Task 10 |
| Trainer sees read-only feedback block | Task 10 |
| GET /search endpoint, role-aware | Task 11 |
| api.search method + SearchResults type | Task 6 |
| CommandPalette debounced search | Task 12 |
| Search results grouped by type | Task 12 |

**Placeholder scan:** No TBDs or incomplete sections found.

**Type consistency check:**
- `SearchResults` defined in Task 6 (`apiClient.ts`), consumed in Task 12 (`CommandPalette.tsx`) ✓
- `autoFailNotComingBack` defined in Task 3 (`autoFail.ts`), called in Tasks 4 and 5 ✓
- `updateEnrollmentStatus` defined in Task 6 (`apiClient.ts`), called in Task 8 ✓
- `coordinator_notes` in `ClassDailyReport` (Task 2), `ReportBody` (Task 6), `reports.ts` PUT (Task 5), `ReportEditForm` (Task 10) ✓
- `setEnrollments` exposed in Task 7, consumed in Task 8 ✓

**Edge cases noted for implementer:**
- Task 1: If Supabase uses a different constraint name, look it up via `SELECT constraint_name FROM information_schema.table_constraints WHERE table_name = 'class_enrollments'` before running.
- Task 9 (`ClassStudentsSection`): Check whether `classInfo` is available from `useClassDetail()` context to get the `archived` flag.
- Task 11 (search.ts): The `.ilike('classes.name', ...)` filter on a joined table may need the Supabase `textSearch` or a different join approach if the ILIKE on a joined column is not supported — test this in the SQL editor first. Alternative: fetch class IDs matching the name, then filter by those.
