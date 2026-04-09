# Attendance "Late" Feature Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `late` boolean flag to daily report trainee progress so trainers and coordinators can mark students as late (on-time by default).

**Architecture:** Add `late boolean NOT NULL DEFAULT false` column to `class_daily_report_trainee_progress`. Include `late` in all backend INSERT/SELECT operations for progress rows. Add "Late" checkbox to report forms and display late status in all views (PDF, student dashboard, trainer dashboard).

**Tech Stack:** PostgreSQL (Supabase), Express/TypeScript, React/TypeScript, Tailwind CSS

---

### Task 1: Database Migration

**Files:**
- Create: `server/src/migrations/004_add_late_to_progress.sql`

- [ ] **Step 1: Create migration file**

```sql
-- Migration 004: Add late column to trainee progress table
-- Run this in the Supabase SQL editor.

ALTER TABLE class_daily_report_trainee_progress
  ADD COLUMN IF NOT EXISTS late boolean NOT NULL DEFAULT false;
```

- [ ] **Step 2: Commit**

```bash
git add server/src/migrations/004_add_late_to_progress.sql
git commit -m "feat: add late column migration for trainee progress"
```

---

### Task 2: Frontend Type Update

**Files:**
- Modify: `web/src/types/index.ts:180-192` (ClassDailyReportTraineeProgress)
- Modify: `web/src/types/index.ts:247-259` (StudentProgressResponse.progress)
- Modify: `web/src/types/index.ts:319-332` (TraineeDashboardResponse.progress)

- [ ] **Step 1: Add `late` to ClassDailyReportTraineeProgress**

In `web/src/types/index.ts`, add `late: boolean` after `attendance: boolean` (line 190):

```typescript
export interface ClassDailyReportTraineeProgress {
  id: string
  report_id: string
  enrollment_id: string
  progress_text: string | null
  gk_rating: DailyRating | null
  dex_rating: DailyRating | null
  hom_rating: DailyRating | null
  coming_back_next_day: boolean | null
  homework_completed: boolean
  attendance: boolean
  late: boolean              // Whether the student arrived late (only meaningful when attendance = true)
  created_at: string
}
```

- [ ] **Step 2: Add `late` to StudentProgressResponse.progress**

In the `progress` array type inside `StudentProgressResponse` (around line 258), add `late: boolean` after `attendance: boolean`:

```typescript
    attendance: boolean
    late: boolean
```

- [ ] **Step 3: Add `late` to TraineeDashboardResponse.progress**

In the `progress` array type inside `TraineeDashboardResponse` (around line 331), add `late: boolean` after `attendance: boolean`:

```typescript
    attendance: boolean
    late: boolean
```

- [ ] **Step 4: Commit**

```bash
git add web/src/types/index.ts
git commit -m "feat: add late field to trainee progress types"
```

---

### Task 3: Backend — Coordinator Report Routes

**Files:**
- Modify: `server/src/routes/reports.ts:308-322` (POST progress insert)
- Modify: `server/src/routes/reports.ts:446-461` (PUT progress insert)

- [ ] **Step 1: Add `late` to POST progress insert**

In `server/src/routes/reports.ts`, find the progress insert in the POST handler (around line 311). Add `late: row.late ?? false,` after the `attendance` line:

```typescript
        progress.map((row: any) => ({
          report_id: reportId,
          enrollment_id: row.enrollment_id,
          progress_text: row.progress_text ?? null,
          gk_rating: row.gk_rating ?? null,
          dex_rating: row.dex_rating ?? null,
          hom_rating: row.hom_rating ?? null,
          coming_back_next_day: row.coming_back_next_day ?? false,
          homework_completed: row.homework_completed ?? false,
          attendance: row.attendance ?? true,
          late: row.late ?? false,
        })),
```

- [ ] **Step 2: Add `late` to PUT progress insert**

In `server/src/routes/reports.ts`, find the progress insert in the PUT handler (around line 449). Add `late: row.late ?? false,` after the `attendance` line:

```typescript
        progress.map((row: any) => ({
          report_id: reportId,
          enrollment_id: row.enrollment_id,
          progress_text: row.progress_text ?? null,
          gk_rating: row.gk_rating ?? null,
          dex_rating: row.dex_rating ?? null,
          hom_rating: row.hom_rating ?? null,
          coming_back_next_day: row.coming_back_next_day ?? false,
          homework_completed: row.homework_completed ?? false,
          attendance: row.attendance ?? true,
          late: row.late ?? false,
        })),
```

- [ ] **Step 3: Commit**

```bash
git add server/src/routes/reports.ts
git commit -m "feat: include late field in report progress inserts"
```

---

### Task 4: Backend — Self-Service Routes

**Files:**
- Modify: `server/src/routes/selfService.ts:260` (trainee progress mapping)
- Modify: `server/src/routes/selfService.ts:631` (trainer POST progress insert)
- Modify: `server/src/routes/selfService.ts:745` (trainer PUT progress insert)

- [ ] **Step 1: Add `late` to trainee progress response mapping**

In `server/src/routes/selfService.ts`, find the progress mapping in the trainee dashboard handler (around line 260). Add `late: (p.late as boolean) ?? false,` after the `attendance` line:

```typescript
        attendance: (p.attendance as boolean) ?? true,
        late: (p.late as boolean) ?? false,
```

- [ ] **Step 2: Add `late` to trainer POST progress insert**

In the trainer report creation handler (around line 631), add `late: row.late ?? false,` after `attendance`:

```typescript
          attendance: row.attendance ?? true,
          late: row.late ?? false,
```

- [ ] **Step 3: Add `late` to trainer PUT progress insert**

In the trainer report update handler (around line 745), add `late: row.late ?? false,` after `attendance`:

```typescript
          attendance: row.attendance ?? true,
          late: row.late ?? false,
```

- [ ] **Step 4: Commit**

```bash
git add server/src/routes/selfService.ts
git commit -m "feat: include late field in self-service progress routes"
```

---

### Task 5: Frontend — Coordinator Report Form (ClassReportsSection)

**Files:**
- Modify: `web/src/pages/ClassDetail/ClassReportsSection.tsx:246` (save body progress mapping)
- Modify: `web/src/pages/ClassDetail/ClassReportsSection.tsx:681` (Load current trainees button)
- Modify: `web/src/pages/ClassDetail/ClassReportsSection.tsx:696` (table header)
- Modify: `web/src/pages/ClassDetail/ClassReportsSection.tsx:728-732` (attendance checkbox cell)

- [ ] **Step 1: Add `late` to save body progress mapping**

Around line 246 in the `handleSaveReport` function, add `late` to the progress mapping:

```typescript
        attendance: row.attendance ?? true,
        late: row.late ?? false,
```

- [ ] **Step 2: Add `late` to "Load current trainees" button**

Around line 681, the inline button handler creates progress rows. Add `late: false` to each row object alongside the existing `attendance` field. Find:

```
attendance: progressRows.find(p => p.enrollment_id === enr.id)?.attendance ?? true, created_at:
```

Add before `created_at`:

```
late: progressRows.find(p => p.enrollment_id === enr.id)?.late ?? false,
```

- [ ] **Step 3: Add "Late?" column header**

Around line 696, after the "Attended?" header, add a new table header:

```tsx
<th className="px-2 py-1 text-left font-semibold uppercase tracking-wide text-slate-500">Late?</th>
```

- [ ] **Step 4: Add "Late" checkbox cell**

After the attendance checkbox cell (around line 728-732), add a new table cell with a Late checkbox that is disabled when attendance is false:

```tsx
<td className="px-2 py-1 align-top">
  <label className="inline-flex items-center gap-1.5 text-slate-400 cursor-pointer">
    <input type="checkbox" checked={row.late ?? false} disabled={!(row.attendance ?? true)} onChange={e => updateRow({ late: e.target.checked })} className="accent-amber-400 disabled:opacity-30" />
    <span>Yes</span>
  </label>
</td>
```

- [ ] **Step 5: Auto-clear `late` when attendance is unchecked**

In the attendance checkbox onChange handler (around line 730), update it to also clear `late` when unchecking attendance:

```tsx
onChange={e => updateRow({ attendance: e.target.checked, ...(e.target.checked ? {} : { late: false }) })}
```

- [ ] **Step 6: Commit**

```bash
git add web/src/pages/ClassDetail/ClassReportsSection.tsx
git commit -m "feat: add late checkbox to coordinator report form"
```

---

### Task 6: Frontend — Trainer Report Form (TrainerReportsSection)

**Files:**
- Modify: `web/src/pages/TrainerClassDetail/TrainerReportsSection.tsx:42` (progress type)
- Modify: `web/src/pages/TrainerClassDetail/TrainerReportsSection.tsx:55-65` (emptyProgress)
- Modify: `web/src/pages/TrainerClassDetail/TrainerReportsSection.tsx:162` (edit load)
- Modify: `web/src/pages/TrainerClassDetail/TrainerReportsSection.tsx:447` (attendance checkbox area)

- [ ] **Step 1: Add `late` to local progress type**

Around line 42, add `late: boolean` after `attendance: boolean` in the progress type definition:

```typescript
    attendance: boolean
    late: boolean
```

- [ ] **Step 2: Add `late` to emptyProgress**

Around line 64, add `late: false,` after `attendance: true,` in the `emptyProgress` function:

```typescript
    attendance: true,
    late: false,
```

- [ ] **Step 3: Add `late` to edit load mapping**

Around line 162, add `late` when mapping existing progress on edit load:

```typescript
          attendance: existing?.attendance ?? true,
          late: existing?.late ?? false,
```

- [ ] **Step 4: Add `late` to save body**

Find where the progress is mapped for the save request body (around line 191-200). Add `late: p.late ?? false` to the progress mapping.

- [ ] **Step 5: Add "Late?" column header and checkbox**

Around line 447 where the attendance checkbox is rendered, add a "Late?" column header in the thead and a Late checkbox cell after the attendance cell. The Late checkbox should be disabled when attendance is false, and use amber accent color:

Header (add after "Attended" th):
```tsx
<th className="px-2 py-1 text-left text-[10px] font-semibold uppercase tracking-wide text-slate-500">Late?</th>
```

Cell (add after attendance td):
```tsx
<td className="px-3 py-2">
  <input type="checkbox" checked={p.late} disabled={!p.attendance} onChange={e => updateProgress(idx, 'late', e.target.checked)} className="accent-amber-400 disabled:opacity-30" />
</td>
```

- [ ] **Step 6: Auto-clear `late` when attendance is unchecked**

Update the attendance checkbox onChange to also clear `late`:

```tsx
onChange={e => {
  updateProgress(idx, 'attendance', e.target.checked)
  if (!e.target.checked) updateProgress(idx, 'late', false)
}}
```

- [ ] **Step 7: Commit**

```bash
git add web/src/pages/TrainerClassDetail/TrainerReportsSection.tsx
git commit -m "feat: add late checkbox to trainer report form"
```

---

### Task 7: PDF Export

**Files:**
- Modify: `web/src/lib/reportPdf.ts:82-97` (progressRows generation)
- Modify: `web/src/lib/reportPdf.ts:181-195` (progress table HTML)

- [ ] **Step 1: Add Attendance/Late column to progress row generation**

Around line 82-94, update the progress row template to include an attendance column that shows "On time", "Late", or "Absent":

```typescript
  const progressRows = report.progress.length
    ? report.progress
        .map(row => {
          const enr = enrollments.find(e => e.id === row.enrollment_id)
          const attendanceLabel = !row.attendance ? 'Absent' : row.late ? 'Late' : '✓'
          return `
        <tr>
          <td>${enr?.student_name ?? 'Unknown'}</td>
          <td class="center">${attendanceLabel}</td>
          <td class="center">${fmt(row.gk_rating)}</td>
          <td class="center">${fmt(row.dex_rating)}</td>
          <td class="center">${fmt(row.hom_rating)}</td>
          <td class="center">${row.coming_back_next_day ? '✓' : '✗'}</td>
          <td class="center">${row.homework_completed ? '✓' : '✗'}</td>
          <td>${fmt(row.progress_text)}</td>
        </tr>`
        })
        .join('')
    : '<tr><td colspan="8" class="empty">No trainee progress entries</td></tr>'
```

- [ ] **Step 2: Add "Attendance" column header to progress table**

Around line 181-195, update the Trainee Progress table to include the Attendance column header:

```html
  <h2>Trainee Progress</h2>
  <table>
    <thead>
      <tr>
        <th style="width:16%">Trainee</th>
        <th style="width:7%">Attend.</th>
        <th style="width:6%">GK</th>
        <th style="width:6%">Dex</th>
        <th style="width:6%">HoM</th>
        <th style="width:8%">Coming back</th>
        <th style="width:7%">HW done</th>
        <th>Progress notes</th>
      </tr>
    </thead>
    <tbody>${progressRows}</tbody>
  </table>
```

- [ ] **Step 3: Commit**

```bash
git add web/src/lib/reportPdf.ts
git commit -m "feat: show attendance/late status in PDF export"
```

---

### Task 8: Student-Facing Views

**Files:**
- Modify: `web/src/pages/StudentProgressPage.tsx:179-201` (attendance display)
- Modify: `web/src/pages/TraineeDashboard.tsx:166-186` (attendance display)

- [ ] **Step 1: Update StudentProgressPage attendance display**

Around line 179-200, update the "Attended" column to show three states (checkmark for on-time, "Late" badge for late, "Absent" badge for absent):

Replace the attendance cell content:
```tsx
<td className="px-4 py-3 text-center hidden md:table-cell">
  {p.attendance ? (
    p.late ? (
      <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-400">Late</span>
    ) : (
      <svg className="w-4 h-4 text-emerald-400 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
      </svg>
    )
  ) : (
    <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-rose-500/15 text-rose-400">Absent</span>
  )}
</td>
```

- [ ] **Step 2: Update TraineeDashboard attendance display**

Around line 179-186, apply the same three-state display:

```tsx
<td className="px-4 py-3 text-center hidden md:table-cell">
  {p.attendance ? (
    p.late ? (
      <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-400">Late</span>
    ) : (
      <svg className="w-4 h-4 text-emerald-400 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
      </svg>
    )
  ) : (
    <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-rose-500/15 text-rose-400">Absent</span>
  )}
</td>
```

- [ ] **Step 3: Commit**

```bash
git add web/src/pages/StudentProgressPage.tsx web/src/pages/TraineeDashboard.tsx
git commit -m "feat: show late badge in student-facing attendance views"
```

---

### Task 9: Verify & Build

- [ ] **Step 1: Run TypeScript type check**

```bash
cd web && npx tsc --noEmit
```

Expected: no type errors

- [ ] **Step 2: Run backend TypeScript check**

```bash
cd server && npx tsc --noEmit
```

Expected: no type errors

- [ ] **Step 3: Run frontend build**

```bash
cd web && npm run build
```

Expected: successful build with no errors

- [ ] **Step 4: Final commit if any fixes needed**

```bash
git add -A
git commit -m "fix: resolve any type/build issues from late feature"
```
