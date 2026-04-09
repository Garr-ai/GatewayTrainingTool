# Trainer Report Editing Parity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give trainers the same daily report editing capabilities as admins (trainers-for-the-day, hours overrides, drag-drop timeline), while keeping the UI as a single shared component.

**Architecture:** Extract the report editing form from `ClassReportsSection` into a standalone `ReportEditForm` component with props for data and callbacks. Both admin and trainer wrappers render the same form. The backend already accepts all fields via the trainer API — only a new trainers query on the class detail endpoint is needed.

**Tech Stack:** React, TypeScript, Tailwind CSS, Supabase, Express

---

## File Map

| File | Action | Purpose |
|------|--------|---------|
| `server/src/routes/selfService.ts` | Modify | Add `class_trainers` query to `GET /me/my-classes/:classId` |
| `web/src/types/index.ts` | Modify | Add `trainers: ClassTrainer[]` to `TrainerClassDetailResponse` |
| `web/src/contexts/TrainerClassDetailContext.tsx` | Modify | Expose `trainers` from context |
| `web/src/components/ReportEditForm.tsx` | **Create** | Shared report edit form extracted from ClassReportsSection |
| `web/src/pages/ClassDetail/ClassReportsSection.tsx` | Modify | Replace inline form with `<ReportEditForm>` |
| `web/src/pages/TrainerClassDetail/TrainerReportsSection.tsx` | Modify | Replace inline form with `<ReportEditForm>`, wire up all missing fields |

---

## Task 1: Add trainers list to backend class detail response

**Files:**
- Modify: `server/src/routes/selfService.ts:308-324`

The `GET /me/my-classes/:classId` handler currently fetches class, enrollments, and drills. Add a `class_trainers` query so the trainer form can show trainer checkboxes.

- [ ] **Step 1: Add trainers query to the Promise.all**

In `server/src/routes/selfService.ts`, find the handler for `GET /me/my-classes/:classId` (around line 299). Replace the existing `Promise.all` block:

```typescript
    const [classResult, enrollResult, drillsResult, trainersResult] = await Promise.all([
      supabase.from('classes').select('*').eq('id', classId).single(),
      supabase.from('class_enrollments').select('id, class_id, student_name, student_email, status, group_label, created_at').eq('class_id', classId).order('student_name', { ascending: true }),
      supabase.from('class_drills').select('*').eq('class_id', classId).order('created_at', { ascending: false }),
      supabase.from('class_trainers').select('id, class_id, trainer_name, trainer_email, role, created_at').eq('class_id', classId).order('created_at', { ascending: true }),
    ])

    if (classResult.error) throw classResult.error
    if (enrollResult.error) throw enrollResult.error
    if (drillsResult.error) throw drillsResult.error
    if (trainersResult.error) throw trainersResult.error
```

- [ ] **Step 2: Include trainers in the response**

Replace the `res.json(...)` call (around line 318) with:

```typescript
    res.json({
      ...classResult.data,
      trainer_role: trainerRow.role,
      trainer_id: trainerRow.id,
      enrollments: enrollResult.data ?? [],
      drills: drillsResult.data ?? [],
      trainers: trainersResult.data ?? [],
    })
```

- [ ] **Step 3: Commit**

```bash
git add server/src/routes/selfService.ts
git commit -m "feat(api): include class trainers in trainer class detail response"
```

---

## Task 2: Update frontend type and trainer context

**Files:**
- Modify: `web/src/types/index.ts:378-383`
- Modify: `web/src/contexts/TrainerClassDetailContext.tsx`

- [ ] **Step 1: Add `trainers` to `TrainerClassDetailResponse`**

In `web/src/types/index.ts`, find `TrainerClassDetailResponse` (around line 378) and add the `trainers` field:

```typescript
/** Response from GET /me/my-classes/:classId. */
export interface TrainerClassDetailResponse extends Class {
  trainer_role: string
  trainer_id: string
  enrollments: ClassEnrollment[]
  drills: ClassDrill[]
  trainers: ClassTrainer[]
}
```

- [ ] **Step 2: Add `trainers` to the context interface**

In `web/src/contexts/TrainerClassDetailContext.tsx`, update `TrainerClassDetailContextValue`:

```typescript
interface TrainerClassDetailContextValue {
  classId: string
  classInfo: TrainerClassDetailResponse | null
  enrollments: ClassEnrollment[]
  schedule: ClassScheduleSlot[]
  reports: ClassDailyReport[]
  trainers: ClassTrainer[]
  trainerHours: ClassLoggedHours[]
  studentHours: ClassLoggedHours[]
  drills: ClassDrill[]
  loading: boolean
  refreshReports: () => Promise<void>
  refreshHours: () => Promise<void>
  refreshDrills: () => Promise<void>
  refreshSchedule: () => Promise<void>
  refreshEnrollments: () => Promise<void>
  setReports: React.Dispatch<React.SetStateAction<ClassDailyReport[]>>
  setTrainerHours: React.Dispatch<React.SetStateAction<ClassLoggedHours[]>>
  setStudentHours: React.Dispatch<React.SetStateAction<ClassLoggedHours[]>>
  setDrills: React.Dispatch<React.SetStateAction<ClassDrill[]>>
}
```

Also add `ClassTrainer` to the imports at the top of the file:

```typescript
import type {
  ClassEnrollment,
  ClassScheduleSlot,
  ClassDailyReport,
  ClassLoggedHours,
  ClassDrill,
  ClassTrainer,
  TrainerClassDetailResponse,
} from '../types'
```

- [ ] **Step 3: Add `trainers` state and wire it up**

In `TrainerClassDetailProvider`, add state and load it from `classInfo`:

```typescript
  const [trainers, setTrainers] = useState<ClassTrainer[]>([])
```

In the `useEffect` `.then` handler, after `setDrills(detail.drills)`:

```typescript
        setTrainers(detail.trainers ?? [])
```

In the `Provider` value:

```typescript
  return (
    <TrainerClassDetailContext.Provider value={{
      classId, classInfo, enrollments, schedule, reports,
      trainers,
      trainerHours, studentHours, drills, loading,
      refreshReports, refreshHours, refreshDrills, refreshSchedule, refreshEnrollments,
      setReports, setTrainerHours, setStudentHours, setDrills,
    }}>
      {children}
    </TrainerClassDetailContext.Provider>
  )
```

- [ ] **Step 4: Commit**

```bash
git add web/src/types/index.ts web/src/contexts/TrainerClassDetailContext.tsx
git commit -m "feat(trainer): expose class trainers in TrainerClassDetailContext"
```

---

## Task 3: Create shared `ReportEditForm` component

**Files:**
- Create: `web/src/components/ReportEditForm.tsx`

This component is extracted from `ClassReportsSection`. It owns all form state, initializes from a `report` prop, and calls `onSave(body)` on submit.

- [ ] **Step 1: Create the file with imports, types, and props interface**

Create `web/src/components/ReportEditForm.tsx`:

```typescript
/**
 * components/ReportEditForm.tsx — Shared daily report edit form
 *
 * Used by both ClassReportsSection (admin) and TrainerReportsSection (trainer).
 * Manages all form state internally. Initializes from the `report` prop on mount
 * and whenever `report` changes. Calls `onSave(body)` on submit.
 *
 * `canDelete` controls whether the Delete button is shown — admins pass true,
 * trainers pass false.
 *
 * Timeline drag-and-drop:
 *   Uses HTML5 drag events with `dragIndexRef` to track which row is being dragged.
 *
 * Hours totals computation:
 *   `computedTotalsForDate(date)` sums all hours in the `hours` prop up to and
 *   including the report date. Override fields take precedence when non-empty.
 */

import { useEffect, useRef, useState } from 'react'
import { CollapsibleSection } from './CollapsibleSection'
import type { ReportBody, ReportWithNested } from '../lib/apiClient'
import type {
  ClassTrainer,
  ClassEnrollment,
  ClassDrill,
  ClassLoggedHours,
  ClassDailyReportTimelineItem,
  ClassDailyReportTraineeProgress,
  ClassDailyReportDrillTime,
  DailyRating,
} from '../types'

interface ReportEditFormProps {
  report: ReportWithNested | null         // null = creating new
  trainers: ClassTrainer[]
  enrollments: ClassEnrollment[]          // enrolled students only
  drills: ClassDrill[]
  hours: ClassLoggedHours[]               // for computing auto-totals
  defaultGame?: string                    // pre-fill game field when creating new
  onSave: (body: ReportBody) => Promise<void>
  onCancel: () => void
  canDelete: boolean
  onDelete?: () => void
}

const RATINGS: DailyRating[] = ['EE', 'ME', 'AD', 'NI']

const fieldClass = 'mt-1 w-full bg-gw-elevated border border-white/10 rounded-md px-2 py-1.5 text-xs text-slate-200 placeholder:text-slate-500 outline-none focus:border-gw-blue/40 focus:ring-2 focus:ring-gw-blue/15'
const inlineFieldClass = 'bg-gw-elevated border border-white/10 rounded-md px-1 py-0.5 text-[11px] text-slate-200 placeholder:text-slate-500 outline-none focus:border-gw-blue/40'
```

- [ ] **Step 2: Add state declarations and initialization effect**

Append to the file (inside the exported function, shown below). The form state mirrors what was in `ClassReportsSection`:

```typescript
export function ReportEditForm({
  report, trainers, enrollments, drills, hours, defaultGame = '',
  onSave, onCancel, canDelete, onDelete,
}: ReportEditFormProps) {
  // Header fields — stored as strings; converted to numbers on save
  const [reportDate, setReportDate] = useState('')
  const [reportGroup, setReportGroup] = useState('')
  const [reportGame, setReportGame] = useState('')
  const [reportSessionLabel, setReportSessionLabel] = useState('')
  const [reportStartTime, setReportStartTime] = useState('')
  const [reportEndTime, setReportEndTime] = useState('')
  const [mgConfirmed, setMgConfirmed] = useState('')
  const [mgAttended, setMgAttended] = useState('')
  const [currentTrainees, setCurrentTrainees] = useState('')
  const [licensesReceived, setLicensesReceived] = useState('')
  // Override fields — empty string means "use calculated value"
  const [overrideHoursToDate, setOverrideHoursToDate] = useState('')
  const [overridePaidHours, setOverridePaidHours] = useState('')
  const [overrideLiveHours, setOverrideLiveHours] = useState('')
  // Nested data
  const [selectedTrainerIds, setSelectedTrainerIds] = useState<string[]>([])
  const [timelineItems, setTimelineItems] = useState<ClassDailyReportTimelineItem[]>([])
  const [progressRows, setProgressRows] = useState<ClassDailyReportTraineeProgress[]>([])
  const [drillTimeRows, setDrillTimeRows] = useState<ClassDailyReportDrillTime[]>([])
  const [saving, setSaving] = useState(false)
  const dragIndexRef = useRef<number | null>(null)

  // Initialize form from `report` prop (or blank defaults when creating new)
  useEffect(() => {
    if (report) {
      setReportDate(report.report_date)
      setReportGroup(report.group_label ?? '')
      setReportGame(report.game ?? '')
      setReportSessionLabel(report.session_label ?? '')
      setReportStartTime(report.class_start_time ?? '')
      setReportEndTime(report.class_end_time ?? '')
      setMgConfirmed(report.mg_confirmed != null ? String(report.mg_confirmed) : '')
      setMgAttended(report.mg_attended != null ? String(report.mg_attended) : '')
      setCurrentTrainees(report.current_trainees != null ? String(report.current_trainees) : '')
      setLicensesReceived(report.licenses_received != null ? String(report.licenses_received) : '')
      setOverrideHoursToDate(report.override_hours_to_date != null ? String(report.override_hours_to_date) : '')
      setOverridePaidHours(report.override_paid_hours_total != null ? String(report.override_paid_hours_total) : '')
      setOverrideLiveHours(report.override_live_hours_total != null ? String(report.override_live_hours_total) : '')
      setSelectedTrainerIds(report.trainer_ids)
      setTimelineItems(report.timeline)
      setProgressRows(report.progress)
      setDrillTimeRows(report.drill_times)
    } else {
      setReportDate(new Date().toISOString().slice(0, 10))
      setReportGroup('')
      setReportGame(defaultGame)
      setReportSessionLabel('')
      setReportStartTime('')
      setReportEndTime('')
      setMgConfirmed('')
      setMgAttended('')
      setCurrentTrainees(String(enrollments.length))
      setLicensesReceived('')
      setOverrideHoursToDate('')
      setOverridePaidHours('')
      setOverrideLiveHours('')
      setSelectedTrainerIds([])
      setTimelineItems([])
      setProgressRows([])
      setDrillTimeRows([])
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [report])
```

- [ ] **Step 3: Add `computedTotalsForDate`, `buildBody`, and `handleSubmit`**

Append inside the component function:

```typescript
  /** Sums hours in the `hours` prop up to and including `date`. */
  function computedTotalsForDate(date: string) {
    if (!date) return { hoursToDate: 0, paid: 0, live: 0 }
    const relevant = hours.filter(h => h.log_date <= date)
    const hoursToDate = relevant.reduce((sum, h) => sum + h.hours, 0)
    const paid = relevant.filter(h => h.paid).reduce((sum, h) => sum + h.hours, 0)
    const live = relevant.filter(h => h.live_training).reduce((sum, h) => sum + h.hours, 0)
    return { hoursToDate, paid, live }
  }

  const parseIntOrNull = (v: string) => {
    if (!v.trim()) return null
    const n = Number(v)
    return Number.isNaN(n) ? null : n
  }

  function buildBody(): ReportBody {
    return {
      report_date: reportDate,
      group_label: reportGroup.trim() || null,
      game: reportGame.trim() || null,
      session_label: reportSessionLabel.trim() || null,
      class_start_time: reportStartTime.trim() || null,
      class_end_time: reportEndTime.trim() || null,
      mg_confirmed: parseIntOrNull(mgConfirmed),
      mg_attended: parseIntOrNull(mgAttended),
      current_trainees: parseIntOrNull(currentTrainees),
      licenses_received: parseIntOrNull(licensesReceived),
      override_hours_to_date: parseIntOrNull(overrideHoursToDate),
      override_paid_hours_total: parseIntOrNull(overridePaidHours),
      override_live_hours_total: parseIntOrNull(overrideLiveHours),
      trainer_ids: selectedTrainerIds,
      timeline: timelineItems.map(item => ({
        start_time: item.start_time,
        end_time: item.end_time,
        activity: item.activity,
        homework_handouts_tests: item.homework_handouts_tests,
        category: item.category,
      })),
      progress: progressRows.map(row => ({
        enrollment_id: row.enrollment_id,
        progress_text: row.progress_text,
        gk_rating: row.gk_rating,
        dex_rating: row.dex_rating,
        hom_rating: row.hom_rating,
        coming_back_next_day: row.coming_back_next_day ?? false,
        homework_completed: row.homework_completed ?? false,
        attendance: row.attendance ?? true,
      })),
      drill_times: drillTimeRows.map(row => ({
        enrollment_id: row.enrollment_id,
        drill_id: row.drill_id,
        time_seconds: row.time_seconds,
        score: row.score,
      })),
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!reportDate) return
    setSaving(true)
    try {
      await onSave(buildBody())
    } finally {
      setSaving(false)
    }
  }
```

- [ ] **Step 4: Add the JSX — copy form sections from ClassReportsSection**

Append the `return (...)` block. The JSX is copied verbatim from `ClassReportsSection.tsx` lines 510–839, with these variable substitutions:

| ClassReportsSection variable | ReportEditForm variable |
|------------------------------|------------------------|
| `handleSaveReport` | `handleSubmit` |
| `reportSaving` | `saving` |
| `editingReport` | `report` |

The outer wrapper changes from:
```tsx
<div className="mb-4 bg-gw-elevated rounded-[10px] border border-white/[0.06] p-3 space-y-4 text-xs">
  <form onSubmit={handleSaveReport} className="space-y-4">
    {/* ... all sections ... */}
    <div className="flex gap-2">
      <button type="button" onClick={() => setReportFormOpen(false)} ...>Cancel</button>
      <button type="submit" disabled={reportSaving} ...>
        {reportSaving ? 'Saving…' : editingReport ? 'Save changes' : 'Add report'}
      </button>
    </div>
  </form>
</div>
```

To:
```tsx
  return (
    <div className="mb-4 bg-gw-elevated rounded-[10px] border border-white/[0.06] p-3 space-y-4 text-xs">
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* === COPY lines 511–831 from ClassReportsSection.tsx verbatim,
            substituting variables per the table above === */}

        <div className="flex gap-2">
          {canDelete && onDelete && (
            <button
              type="button"
              onClick={onDelete}
              className="rounded-md bg-rose-500/10 text-rose-400 border border-rose-500/20 px-3 py-1.5 text-xs font-semibold hover:bg-rose-500/15 transition-colors mr-auto"
            >
              Delete report
            </button>
          )}
          <button type="button" onClick={onCancel} className="rounded-md bg-gw-surface text-slate-200 border border-white/10 px-3 py-1.5 text-xs font-semibold hover:bg-gw-elevated transition-colors">Cancel</button>
          <button type="submit" disabled={saving} className="rounded-md bg-gradient-to-r from-gw-blue to-gw-teal text-white px-3 py-1.5 text-xs font-semibold hover:brightness-110 transition-all disabled:opacity-60">
            {saving ? 'Saving…' : report ? 'Save changes' : 'Add report'}
          </button>
        </div>
      </form>
    </div>
  )
}
```

> **Copying instructions:** Open `ClassReportsSection.tsx`. Find line 510 (`<form onSubmit={handleSaveReport}`). Copy from line 511 through line 831 (the last `</CollapsibleSection>` before the Cancel/Save buttons). Paste into the `{/* COPY ... */}` comment location above. Replace `handleSaveReport` → `handleSubmit`, `reportSaving` → `saving`, `editingReport?.id` → `report?.id`.

- [ ] **Step 5: Commit**

```bash
git add web/src/components/ReportEditForm.tsx
git commit -m "feat: add shared ReportEditForm component extracted from ClassReportsSection"
```

---

## Task 4: Refactor `ClassReportsSection` to use `ReportEditForm`

**Files:**
- Modify: `web/src/pages/ClassDetail/ClassReportsSection.tsx`

The admin wrapper now renders `<ReportEditForm>` instead of the inline form. It passes `api.reports` callbacks and `canDelete={true}`.

- [ ] **Step 1: Add import for `ReportEditForm`**

At the top of `ClassReportsSection.tsx`, add:

```typescript
import { ReportEditForm } from '../../components/ReportEditForm'
```

Also add `ReportWithNested` to the existing import from `apiClient` if not already imported separately (it already is).

- [ ] **Step 2: Add `editingReportFull` state; remove old form state**

Replace the ~20 form-state `useState` lines (lines 87–114: `reportDate` through `dragIndexRef`) with a single state for the full report:

```typescript
  // Full report being edited (null when creating new)
  const [editingReportFull, setEditingReportFull] = useState<ReportWithNested | null>(null)
```

Keep `reportFormOpen`, `editingReport` (rename to be clear; or just keep as a ClassDailyReport for list-row reference — see below), `reportSaving` → remove, `previewArgs`, `reportCacheRef`.

> **Note:** `editingReport: ClassDailyReport | null` can be removed entirely since `editingReportFull` covers the same purpose. The `handleViewPdf` function currently uses `editingReport` — update it to use `editingReportFull?.id` or look up by `r.id` from the list.

- [ ] **Step 3: Simplify `openAddReport` and `openEditReport`**

Replace the old `openAddReport` / `openEditReport` / `loadReportDetails` / `resetReportForm` functions with:

```typescript
  function openAddReport() {
    setEditingReportFull(null)
    setReportFormOpen(true)
  }

  async function openEditReport(r: ClassDailyReport) {
    try {
      const full = reportCacheRef.current[r.id] ?? await api.reports.get(r.id)
      reportCacheRef.current[r.id] = full
      setEditingReportFull(full)
      setReportFormOpen(true)
    } catch (err) {
      setError((err as Error).message)
    }
  }
```

- [ ] **Step 4: Add `handleSaveFromForm` callback**

Replace `handleSaveReport` with a simpler callback that `ReportEditForm` calls via `onSave`:

```typescript
  async function handleSaveFromForm(body: ReportBody) {
    setError(null)
    if (editingReportFull) {
      await api.reports.update(classId, editingReportFull.id, body)
      delete reportCacheRef.current[editingReportFull.id]
      toast('Report updated successfully.', 'success')
    } else {
      const tempReport: ClassDailyReport = {
        id: `temp-${Date.now()}`,
        class_id: classId,
        report_date: body.report_date,
        group_label: body.group_label ?? null,
        game: body.game ?? null,
        session_label: body.session_label ?? null,
        class_start_time: body.class_start_time ?? null,
        class_end_time: body.class_end_time ?? null,
        mg_confirmed: body.mg_confirmed ?? null,
        mg_attended: body.mg_attended ?? null,
        current_trainees: body.current_trainees ?? null,
        licenses_received: body.licenses_received ?? null,
        override_hours_to_date: body.override_hours_to_date ?? null,
        override_paid_hours_total: body.override_paid_hours_total ?? null,
        override_live_hours_total: body.override_live_hours_total ?? null,
        created_at: new Date().toISOString(),
      }
      setReports(prev => [tempReport, ...prev])
      await api.reports.create(classId, body)
      toast('Report created successfully.', 'success')
      refreshReports()
    }
    setReportFormOpen(false)
    setEditingReportFull(null)
  }
```

Also add `ReportBody` to the import from `apiClient`:
```typescript
import { api, type ReportWithNested, type ReportBody } from '../../lib/apiClient'
```

- [ ] **Step 5: Replace the inline form JSX with `<ReportEditForm>`**

In the JSX, find the `{reportFormOpen && (<div className="mb-4 ..."><form ...>...</form></div>)}` block (lines 508–841) and replace it entirely with:

```tsx
          {reportFormOpen && (
            <ReportEditForm
              report={editingReportFull}
              trainers={trainers}
              enrollments={enrollments}
              drills={drills}
              hours={hours}
              defaultGame={editingReportFull?.game ?? ''}
              onSave={handleSaveFromForm}
              onCancel={() => { setReportFormOpen(false); setEditingReportFull(null) }}
              canDelete={!!editingReportFull}
              onDelete={editingReportFull ? () => handleRemoveReport(editingReportFull.id) : undefined}
            />
          )}
```

- [ ] **Step 6: Remove `computedTotalsForDate` function from this file**

It now lives in `ReportEditForm`. Delete the function definition (around line 468).

- [ ] **Step 7: Build and verify admin view still works**

```bash
cd /Users/garr/Documents/GatewayTrainingTool/web && npm run build 2>&1 | tail -20
```

Expected: Build succeeds with no TypeScript errors. Fix any type errors before proceeding.

- [ ] **Step 8: Commit**

```bash
git add web/src/pages/ClassDetail/ClassReportsSection.tsx
git commit -m "refactor(admin): use shared ReportEditForm in ClassReportsSection"
```

---

## Task 5: Refactor `TrainerReportsSection` to use `ReportEditForm`

**Files:**
- Modify: `web/src/pages/TrainerClassDetail/TrainerReportsSection.tsx`

The trainer wrapper now renders `<ReportEditForm>` with `canDelete={false}`. It removes the local `ReportBody` type (now imported from `apiClient`), removes redundant form state, and wires up trainer IDs, timeline, and hours overrides that were previously hardcoded to empty.

- [ ] **Step 1: Update imports**

Replace the imports at the top of `TrainerReportsSection.tsx` with:

```typescript
import { useState, useCallback, useRef } from 'react'
import { api, type ReportBody, type ReportWithNested } from '../../lib/apiClient'
import { useTrainerClassDetail } from '../../contexts/TrainerClassDetailContext'
import { SkeletonTable } from '../../components/Skeleton'
import { EmptyState } from '../../components/EmptyState'
import { ReportPreviewModal } from '../../components/ReportPreviewModal'
import { ReportEditForm } from '../../components/ReportEditForm'
import { useToast } from '../../contexts/ToastContext'
import type { ClassDailyReport } from '../../types'
import type { ReportPdfArgs } from '../../lib/reportPdf'
```

> Remove the local `type ReportBody = { ... }` definition entirely — it's now imported from `apiClient`.

- [ ] **Step 2: Update what's pulled from the trainer context**

In `TrainerReportsSection`, update the `useTrainerClassDetail()` destructure to include `trainers` and `trainerHours`/`studentHours`:

```typescript
  const {
    classId, classInfo, trainers, reports, enrollments, drills,
    trainerHours, studentHours, loading, refreshReports, setReports,
  } = useTrainerClassDetail()
```

- [ ] **Step 3: Remove all the inline form state**

Delete these `useState` lines (they're no longer needed — `ReportEditForm` owns this state):
- `fDate`, `fGroupLabel`, `fGame`, `fSessionLabel`, `fStartTime`, `fEndTime`
- `fMgConfirmed`, `fMgAttended`, `fCurrentTrainees`, `fLicenses`
- `fProgress`, `fDrillTimes`

Keep:
- `mode`, `editingReport`, `loadingReport`, `saving` — these are the list-vs-form display state
- `previewArgs`, `reportCacheRef`

Change `editingReport` type from `ReportWithNested | null` (it already is `ReportWithNested | null` — good, keep it).

- [ ] **Step 4: Simplify `openCreate` and `openEdit`**

Replace `openCreate` and the `openEdit` callback with:

```typescript
  function openCreate() {
    setEditingReport(null)
    setMode('create')
  }

  const openEdit = useCallback(async (report: ClassDailyReport) => {
    setLoadingReport(true)
    try {
      const full = reportCacheRef.current[report.id] ?? await api.selfService.classReportDetail(classId, report.id)
      reportCacheRef.current[report.id] = full
      setEditingReport(full)
      setMode('edit')
    } catch (err) {
      toast((err as Error).message, 'error')
    } finally {
      setLoadingReport(false)
    }
  }, [classId, toast])
```

- [ ] **Step 5: Replace `buildBody` and `handleSave` with a `handleSaveFromForm` callback**

Delete `buildBody` and `handleSave`. Add:

```typescript
  async function handleSaveFromForm(body: ReportBody) {
    if (mode === 'create') {
      const tempReport: ClassDailyReport = {
        id: `temp-${Date.now()}`,
        class_id: classId,
        report_date: body.report_date,
        group_label: body.group_label ?? null,
        game: body.game ?? null,
        session_label: body.session_label ?? null,
        class_start_time: body.class_start_time ?? null,
        class_end_time: body.class_end_time ?? null,
        mg_confirmed: body.mg_confirmed ?? null,
        mg_attended: body.mg_attended ?? null,
        current_trainees: body.current_trainees ?? null,
        licenses_received: body.licenses_received ?? null,
        override_hours_to_date: body.override_hours_to_date ?? null,
        override_paid_hours_total: body.override_paid_hours_total ?? null,
        override_live_hours_total: body.override_live_hours_total ?? null,
        created_at: new Date().toISOString(),
      }
      setReports(prev => [tempReport, ...prev])
      await api.selfService.createReport(classId, body)
      toast('Report saved', 'success')
      refreshReports()
    } else if (editingReport) {
      await api.selfService.updateReport(classId, editingReport.id, body)
      delete reportCacheRef.current[editingReport.id]
      toast('Report updated', 'success')
    }
    setMode('list')
    setEditingReport(null)
  }
```

- [ ] **Step 6: Update `handleViewPdf` to use the full trainers list**

The current code builds a fake `trainersList` with only the primary trainer. Replace it using the real `trainers` from context:

```typescript
  async function handleViewPdf(r: ClassDailyReport) {
    try {
      const full = reportCacheRef.current[r.id] ?? await api.selfService.classReportDetail(classId, r.id)
      reportCacheRef.current[r.id] = full
      setPreviewArgs({
        report: full,
        className,
        trainers,
        enrollments: activeEnr,
        drills,
      })
    } catch (err) {
      toast((err as Error).message, 'error')
    }
  }
```

Remove the `trainersList` variable that was previously constructed.

- [ ] **Step 7: Replace the form render (mode !== 'list') with `ReportEditForm`**

Find the `return (` block for when `mode !== 'list'` (around line 356–534). Replace the entire section (from `<section className="bg-gw-surface rounded-[10px] p-4 flex flex-col gap-4">` through its closing `</section>`) with:

```tsx
  // Form mode (create or edit)
  return (
    <section className="bg-gw-surface rounded-[10px] p-4 flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <button type="button" onClick={() => { setMode('list'); setEditingReport(null) }} className="text-slate-500 hover:text-slate-300 transition-colors">
          <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.75"><path d="M15 18l-6-6 6-6" /></svg>
        </button>
        <h3 className="text-sm font-semibold text-slate-200">
          {mode === 'create' ? 'New Report' : 'Edit Report'}
        </h3>
      </div>

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
      />
    </section>
  )
```

Also remove the `updateProgress`, `updateDrillTime`, `enrollmentMap` variables that were used only in the form JSX.

- [ ] **Step 8: Build and verify trainer view works**

```bash
cd /Users/garr/Documents/GatewayTrainingTool/web && npm run build 2>&1 | tail -20
```

Expected: Build succeeds with no TypeScript errors.

- [ ] **Step 9: Commit**

```bash
git add web/src/pages/TrainerClassDetail/TrainerReportsSection.tsx
git commit -m "feat(trainer): give trainers full report editing parity with admins"
```

---

## Verification Checklist

After all tasks complete, manually verify in the browser:

**Admin view** (`/classes/:className` → Reports tab):
- [ ] Create new report: all sections appear, save works
- [ ] Edit existing report: all sections populate correctly, save works
- [ ] Delete report: confirmation dialog appears, deletion works
- [ ] View PDF: still works

**Trainer view** (`/my-classes/:classId` → Reports):
- [ ] Create new report: trainers-for-the-day checkboxes appear (populated from class trainers)
- [ ] Create new report: hours totals section appears with computed values
- [ ] Create new report: timeline section appears with "Add time block" button
- [ ] Edit existing report: all three new sections pre-populate from saved data
- [ ] No "Delete" button appears for trainer
- [ ] Save works and report appears in list
- [ ] View PDF still works
