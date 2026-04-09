# Attendance "Late" Feature Design

## Summary

Add a `late` boolean flag to daily report trainee progress, allowing trainers and coordinators to mark students as late. Students are on-time by default. This is independent from the existing `attendance` boolean — `late` only applies when a student is present.

## Database

**Migration `004_add_late_to_progress.sql`:**

```sql
ALTER TABLE class_daily_report_trainee_progress
ADD COLUMN late boolean NOT NULL DEFAULT false;
```

- `late` defaults to `false` (on time)
- Only meaningful when `attendance = true`
- No constraint enforcing this relationship — handled at the application layer

## Backend

**`/server/src/routes/reports.ts`:**

- **SELECT**: Include `late` when fetching progress rows (in both coordinator and self-service report endpoints)
- **INSERT**: Include `late` from request body when inserting progress rows during report create/update
- No new endpoints — rides on existing full-replace report CRUD pattern

**`/server/src/routes/selfService.ts`:**

- Include `late` in progress data returned by self-service endpoints (trainer and trainee views)

## Frontend

**Types (`/web/src/types/index.ts`):**

- Add `late?: boolean` to the trainee progress type used in daily reports

**Report Form (`/web/src/pages/ClassDetail/ClassReportsSection.tsx`):**

- Add "Late" checkbox column in the progress table, next to "Attended?"
- Disabled when `attendance = false` (student absent)
- Auto-clears `late` when attendance is unchecked
- Default: unchecked (on time)

**PDF Export (`/web/src/lib/reportPdf.ts`):**

- Show "Late" text/badge in the progress table when `late = true`

**Student Views:**

- `StudentProgressPage.tsx`: Show "Late" badge alongside attendance
- `TraineeDashboard.tsx`: Show "Late" badge in progress display

**Trainer Views:**

- `TrainerReportsPage.tsx`: Include late status in report display

## Data Flow

1. Trainer/coordinator checks "Late" box for a student in the report form
2. On save, `late: true` is included in the progress array sent to PUT endpoint
3. Backend deletes existing progress rows, re-inserts all with `late` field
4. On fetch, `late` field is returned with progress data
5. All views (coordinator, trainer, trainee) display the late status

## Edge Cases

- Student marked absent: `late` is disabled and set to `false`
- New reports: all students default to `attendance: true, late: false` (present and on time)
- Existing reports (before migration): `late` defaults to `false` for all existing rows
