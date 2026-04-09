# Trainer Report Editing Parity

**Date:** 2026-04-08
**Status:** Approved

## Problem

The trainer's daily report editor is a reduced version of the admin's. Trainers are missing three sections present in the admin form:

- **Trainers for the day** — checkbox selection of which class trainers were present
- **Hours totals overrides** — manual override for training/paid/live hour totals
- **Training timeline** — drag-and-drop reorderable log of training activities

Trainers should be able to edit reports identically to admins, with one exception: trainers cannot delete reports.

The backend trainer API (`PUT /me/my-classes/:classId/reports/:reportId`) already accepts all of these fields — no backend logic changes are needed for saving.

## Design

### Architecture

Extract a shared `ReportEditForm` component that both the admin and trainer wrappers use. The form holds all form state and JSX. Parent wrappers handle data loading, API calls (using their respective endpoints), and permissions.

### Section 1: Shared Form Component

**New file: `web/src/components/ReportEditForm.tsx`**

Extracted from `ClassReportsSection`'s current inline form (~400 lines of JSX). All form state moves here. Props:

```typescript
interface ReportEditFormProps {
  report: ReportWithNested | null   // null = creating new
  trainers: ClassTrainer[]          // for "trainers for the day" checkboxes
  enrollments: ClassEnrollment[]    // enrolled students
  drills: ClassDrill[]              // active drills
  hours: ClassLoggedHours[]         // for computing auto-totals
  onSave: (body: ReportBody) => Promise<void>
  onCancel: () => void
  canDelete: boolean
  onDelete?: () => void
}
```

Contains all form sections:
1. Header fields (date, group, game, session, times, M&G counts, trainee count, licenses)
2. Trainers for the day (checkboxes)
3. Hours totals overrides (training hours to date, total paid hours, total live training hours)
4. Training timeline (drag-and-drop reorderable rows)
5. Per-trainee progress (ratings, attendance, homework, notes)
6. Drill & test times

The `computedTotalsForDate()` function moves into this component — it computes auto-totals from the `hours` prop.

### Section 2: Admin Wrapper Update

**Updated: `web/src/pages/ClassDetail/ClassReportsSection.tsx`**

Replaces the inline form JSX with `<ReportEditForm>`. The wrapper:
- Continues using `useClassDetail()` for `trainers`, `enrollments`, `drills`, `hours`
- Passes `canDelete={true}` and `onDelete={handleRemoveReport}`
- No behavior change from the user's perspective

### Section 3: Trainer Wrapper Update

**Updated: `web/src/pages/TrainerClassDetail/TrainerReportsSection.tsx`**

Replaces the inline form with `<ReportEditForm>`. The wrapper:
- Uses `useTrainerClassDetail()` for `trainers` (new), `enrollments`, `drills`, `trainerHours`, `studentHours`
- Passes `hours={[...trainerHours, ...studentHours]}` for computed totals
- Passes `canDelete={false}` (no delete for trainers)
- On save: calls `api.selfService.createReport` / `api.selfService.updateReport`
- On open-edit: pre-populates trainer IDs, timeline, and hours overrides from the fetched `ReportWithNested` (currently these are ignored/hardcoded to empty)

### Section 4: Backend — Add Trainers to Class Detail Response

**Updated: `server/src/routes/selfService.ts`** (`GET /me/my-classes/:classId`)

Add a Supabase query for `class_trainers` where `class_id = classId` to the existing `Promise.all`. Include the result as `trainers` in the response.

**Updated: `web/src/types/index.ts`** (`TrainerClassDetailResponse`)

Add `trainers: ClassTrainer[]` field.

**Updated: `web/src/contexts/TrainerClassDetailContext.tsx`**

- Add `trainers: ClassTrainer[]` to the context value interface
- Load from `classInfo.trainers` (already fetched as part of class detail)
- Expose via `useTrainerClassDetail()`

## What Does NOT Change

- Delete report: trainers cannot delete (no delete button, no API endpoint for it)
- The admin `ClassReportsSection` behavior is identical after refactor
- No changes to the PDF preview, report list, or hours tab
- No new API endpoints other than the trainers list on the class detail response

## Files Affected

| File | Change |
|------|--------|
| `web/src/components/ReportEditForm.tsx` | **New** — shared form component |
| `web/src/pages/ClassDetail/ClassReportsSection.tsx` | Replace inline form with `<ReportEditForm>` |
| `web/src/pages/TrainerClassDetail/TrainerReportsSection.tsx` | Replace inline form with `<ReportEditForm>`, wire up new fields |
| `server/src/routes/selfService.ts` | Add trainers query to `GET /me/my-classes/:classId` |
| `web/src/types/index.ts` | Add `trainers` to `TrainerClassDetailResponse` |
| `web/src/contexts/TrainerClassDetailContext.tsx` | Expose `trainers` from context |
