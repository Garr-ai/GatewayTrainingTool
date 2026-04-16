# Student Failure, Global Search, and Report Comments — Design Spec

**Date:** 2026-04-15  
**Status:** Approved

## Summary

Three independent features shipped together:

1. **Student failure** — trainers and coordinators can manually mark a student as failed; daily report saves auto-fail students who are not coming back. Failed students are excluded from new report pre-population but remain visible in past reports.
2. **Global search** — Cmd+K searches students, trainers, and reports by name across all classes.
3. **Report comments** — coordinators leave text feedback on a daily report that trainers can read.

---

## Feature A: Student Failure

### Database

- Alter the `status` check constraint on `class_enrollments` from `('enrolled', 'waitlist', 'dropped')` to `('enrolled', 'dropped', 'failed')`. Remove `'waitlist'` entirely.
- No new table needed.

### Backend — `server/src/routes/selfService.ts`

**Auto-fail on report save (POST and PUT report handlers):**

After the report row is inserted/updated, run a follow-up update:

```sql
UPDATE class_enrollments
SET status = 'failed'
WHERE class_id = :classId
  AND status = 'enrolled'
  AND user_id IN (
    SELECT user_id FROM class_daily_report_trainee_progress
    WHERE report_id = :reportId
      AND coming_back_next_day = false
  )
```

Apply `logAudit` for each affected enrollment (action `'UPDATE'`, table `class_enrollments`).

**New endpoint — manual fail (trainer):**

`PATCH /me/my-classes/:classId/enrollments/:enrollmentId`

- Body: `{ status: 'enrolled' | 'failed' }`
- Validates trainer access + archived check (same pattern as schedule write)
- Updates `class_enrollments` matching `id` AND `class_id`
- Returns 404 if not found
- Returns updated row
- Calls `logAudit` (action `'UPDATE'`, table `class_enrollments'`)
- Wrapped in `writeLimiter`

### Backend — `server/src/routes/reports.ts`

Apply the same auto-fail follow-up query to the coordinator report POST and PUT handlers (same SQL, same `logAudit` calls).

### Backend — `server/src/routes/enrollments.ts`

`PUT /classes/:classId/enrollments/:id` already accepts a `status` field. Add `'failed'` as a valid value — no new endpoint needed for coordinators.

### Frontend

**`web/src/types/index.ts`**

```ts
type EnrollmentStatus = 'enrolled' | 'dropped' | 'failed'
```

Remove `'waitlist'` from the union.

**`web/src/lib/apiClient.ts`**

```ts
updateEnrollmentStatus(classId: string, enrollmentId: string, body: { status: 'enrolled' | 'failed' })
  → PATCH /me/my-classes/:classId/enrollments/:enrollmentId
```

**Students tab — `TrainerStudentsSection.tsx` and `ClassStudentsSection.tsx`**

- Status badge: add `'failed'` case — rose pill (`bg-rose-500/15 text-rose-400`), label "Failed"
- Actions column: Fail button for `enrolled` students, Unfail button for `failed` students. `dropped` students get neither. Hidden when `classInfo.archived`.
- Optimistic update: flip status locally via `setEnrollments`, call API, revert on error, then call `refreshEnrollments()` on success.
- Trainer uses `api.selfService.updateEnrollmentStatus`. Coordinator uses the existing `api.coordinator.updateEnrollment` with `{ status: 'failed' | 'enrolled' }`.

**Report pre-population**

In `ReportEditForm.tsx` and the trainer equivalent, filter the enrollment list to `status === 'enrolled'` only when seeding progress rows for a new report. Saved reports display all progress rows as stored — no filtering on read.

---

## Feature B: Coordinator Report Comments

### Database

Add column `coordinator_notes text` (nullable, default null) to `class_daily_reports`.

### Backend — `server/src/routes/reports.ts`

- Extend the coordinator report `PUT /classes/:classId/reports/:reportId` handler to accept and persist `coordinator_notes` (optional string).
- No new endpoint. No `logAudit` needed for notes (low-sensitivity field, consistent with how notes are handled elsewhere).

### Frontend

**Coordinator report detail/edit view**

Add a `textarea` labeled "Coordinator feedback" below the existing report fields. Saved and cleared via the existing report save action. Visible to coordinators only in the edit view.

**Trainer report view**

In the trainer's per-class report detail view, show a read-only "Coordinator feedback" block when `coordinator_notes` is non-empty. Style as a subdued callout (e.g. slate border-left, italic text) to distinguish it from trainee data.

---

## Feature C: Global Search

### Backend — `server/src/routes/search.ts` (new file)

New router mounted at `GET /api/search?q=<term>` after JWT verification, before role middleware (accessible to both trainers and coordinators).

**Scoping:**
- Coordinator: searches all students, trainers, and reports in the system.
- Trainer: searches only within classes where they appear in `class_trainers`.

**Query parameter:** `q` — minimum 2 characters; return empty results otherwise.

**Result shape:**
```ts
{
  students: Array<{ id: string; name: string; classId: string; className: string }>
  trainers: Array<{ id: string; name: string }>   // coordinator only
  reports:  Array<{ id: string; classId: string; className: string; reportDate: string }>
}
```

- Students: match on `profiles.full_name` ILIKE `%q%`, joined to `class_enrollments` and `classes`
- Trainers: match on `profiles.full_name` ILIKE `%q%` where user has trainer role (coordinator scope only)
- Reports: match on `classes.name` ILIKE `%q%`, joined to `class_daily_reports`

Limit each category to 5 results. Response is always the three-key object (empty arrays if no matches).

### Frontend

**`web/src/lib/apiClient.ts`**

```ts
search(q: string): Promise<SearchResults>
  → GET /api/search?q=<q>
```

**`web/src/components/CommandPalette.tsx`**

- When query length ≥ 2, fire a debounced API call (300ms).
- Display API results below the existing local page shortcuts, grouped into sections: **Students**, **Trainers** (coordinator only), **Reports**. Empty sections are hidden.
- Each result is a keyboard-navigable item in the existing palette list.
- Navigation on select:
  - Student → class detail students tab (`/coordinator/classes/:classId` or `/trainer/my-classes/:classId`, students section active)
  - Trainer → coordinator trainer detail page
  - Report → report detail page
- Loading state: show a subtle spinner or "Searching…" label while the debounce is pending or the request is in flight.

### What is NOT changing

- Local page shortcuts in CommandPalette remain as-is; API results are additive.
- Search does not index report content (notes, progress data) — class name match only.
- No saved search history.

---

## What is NOT changing (all features)

- Coordinator schedule routes — untouched
- `TrainerSchedulePage` (cross-class read view) — untouched
- RLS policies — no change needed
- Audit logging for coordinator_notes — omitted intentionally
