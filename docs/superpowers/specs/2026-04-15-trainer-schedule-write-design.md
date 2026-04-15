# Trainer Schedule Write Access — Design Spec

**Date:** 2026-04-15  
**Status:** Approved

## Summary

Trainers can currently view schedule slots for their assigned classes but cannot create, edit, or delete them. This feature adds single-slot CRUD write access for trainers, following the existing self-service drills pattern.

## Scope

- Single schedule slot add / edit / delete for trainers
- No batch/recurring slot creation (coordinator-only feature, out of scope)

---

## Architecture

### Role boundary

Write access stays within the self-service layer (`selfService.ts`), mounted before `requireCoordinator` in `routes/index.ts`. Coordinator schedule routes are unchanged.

### Access control

Every write endpoint calls `validateTrainerAccess(email, classId)` — the same helper used by drills, reports, and hours endpoints. This confirms the calling user is listed in `class_trainers` for that class. Archived class check (`cls.archived`) blocks writes, consistent with all other self-service write endpoints.

---

## Backend

**File:** `server/src/routes/selfService.ts`

Three new endpoints, appended after the drills write section:

### `POST /me/my-classes/:classId/schedule`
- Body: `{ slot_date, start_time, end_time, notes?, group_label? }`
- Validates trainer access + archived check
- Inserts into `class_schedule_slots` with `class_id` from URL param
- Returns 201 + created row

### `PUT /me/my-classes/:classId/schedule/:slotId`
- Body: same fields as POST
- Validates trainer access + archived check
- Updates matching `id` AND `class_id` (IDOR protection — same pattern as coordinator PUT)
- Returns 404 (PGRST116) if slot not found or belongs to different class
- Returns updated row

### `DELETE /me/my-classes/:classId/schedule/:slotId`
- Validates trainer access + archived check
- Pre-fetches slot by `id` + `class_id` to return clean 404 if missing
- Hard deletes (no historical data concern — slots have no FK children)
- Returns 204

No audit logging (consistent with drills endpoints which also omit audit).

---

## Frontend

### `web/src/lib/apiClient.ts`

Add three methods to `api.selfService`:

```ts
createScheduleSlot(classId, body: { slot_date, start_time, end_time, notes?, group_label? })
updateScheduleSlot(classId, slotId, body: { slot_date, start_time, end_time, notes?, group_label? })
deleteScheduleSlot(classId, slotId)
```

### `web/src/contexts/TrainerClassDetailContext.tsx`

Expose `setSchedule` from context (currently private). Add it to `TrainerClassDetailContextValue` and the Provider's value object.

### `web/src/pages/TrainerClassDetail/TrainerScheduleSection.tsx`

Upgrade the read-only table to support full CRUD:

- **Header**: add "+ Add slot" button (hidden when `classInfo.archived`)
- **Inline form** (same card style as drills form): fields for date, start time, end time, group label (optional text), notes (optional text). Appears above the table when open; doubles as edit form when `editingSlot` is set.
- **Table rows**: add Edit / Delete action buttons in a right-aligned column (hidden when archived)
- **Delete**: uses existing `ConfirmDialog` component
- **Optimistic delete**: slot removed from state immediately, reverted on error (same pattern as `TrainerDrillsSection.handleDelete`)
- **Add/edit**: calls `refreshSchedule()` on success to re-fetch sorted list from server

---

## Data flow

```
Trainer clicks "+ Add slot"
  → inline form opens
  → submit → api.selfService.createScheduleSlot()
  → POST /me/my-classes/:classId/schedule
  → validateTrainerAccess → insert → 201
  → refreshSchedule() → setSchedule(sorted data)
  → form closes, table updates
```

---

## What is NOT changing

- Coordinator schedule routes (`scheduleRouter`) — untouched
- Batch slot creation — coordinator-only, not exposed to trainers
- `TrainerSchedulePage` (cross-class read view) — read-only, unchanged
- RLS policies — no change needed; existing service-role key bypasses RLS for all self-service writes
