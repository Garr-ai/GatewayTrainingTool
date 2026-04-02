# Coordinator Dashboard & App-Wide Polish — Design Spec

**Date:** 2026-04-01
**Approach:** Dashboard-outward — redesign the coordinator dashboard as the centerpiece, then ripple polish and missing features outward to other pages.

---

## Section 1: Enhanced Coordinator Dashboard

### Summary Cards (2 + 2 + 2 grid)

Six summary cards arranged in three rows of two on mobile, collapsing from a responsive grid on desktop.

**Row 1:**
- **Active Classes** — Total count of non-archived classes. Sub-stats: province breakdown badges (BC, AB, ON with counts). Clicking navigates to `/classes`.
- **Today's Sessions** — Count of schedule slots for today. Sub-stat: next upcoming session name and time. Clicking navigates to `/schedule`.

**Row 2:**
- **Reports (7 days)** — Count of reports filed in the last 7 days. Sub-stat: number of distinct classes with reports. Clicking navigates to `/reports`.
- **Hours This Month** — Total logged training hours for the current calendar month. Sub-stat: number of active trainers. Clicking navigates to `/payroll/trainers`.

**Row 3:**
- **Students Enrolled** — Total active enrollment count across all non-archived classes. Sub-stat: waitlist count. Clicking navigates to `/students`.
- **Attendance Rate** — Percentage of "attended" entries out of total report entries for the current month. Sub-stat: text label "this month". No click navigation.

**Data sources:**
- Active Classes + province breakdown: existing `ClassesContext` (no new API needed)
- Today's Sessions: existing `api.schedule.listAll` with today's date filter
- Reports count: existing `api.reports.listAll` with date filter (use `total` from response)
- Hours This Month: new lightweight endpoint `GET /api/dashboard/hours-summary` returning `{ total_hours: number, trainer_count: number }`
- Students Enrolled: new lightweight endpoint `GET /api/dashboard/enrollment-summary` returning `{ enrolled: number, waitlist: number }`
- Attendance Rate: new lightweight endpoint `GET /api/dashboard/attendance-rate` returning `{ rate: number }` (0-100, calculated server-side from reports data for current month)

### Alerts Banner

A full-width amber-styled alert section below the summary cards. Only shown when there are actionable items. Contains two alert types:

1. **Classes ending within 7 days** — Queries active classes where `end_date` is within the next 7 days. Shows class names as links to their detail pages. Example: "2 classes ending soon: BC Poker 101 (Apr 5), AB Blackjack (Apr 7)"
2. **Sessions today with no report filed** — Compares today's schedule slots against filed reports for today. Shows classes that had sessions today but no corresponding report. Example: "1 session today has no report: ON Roulette 201"

**Data sources:**
- Classes ending soon: client-side filter on `ClassesContext.active` comparing `end_date` to today + 7 days
- Sessions without reports: new endpoint `GET /api/dashboard/unreported-sessions` returning `{ classes: Array<{ class_id, class_name, session_date }> }`. Checks today's schedule slots against reports table.

Alerts are not dismissable — they resolve naturally when the condition is addressed.

### Coming Up Section (replaces Today's Sessions table)

A day-grouped list of sessions for the next 5 days. Replaces the current "Today's Sessions" table which only shows today.

**Layout:**
- Each day is a group header (e.g., "Today — Apr 1", "Tomorrow — Apr 2", "Thu Apr 3")
- Under each header: rows showing class name, time range, trainer name, group label
- Days with no sessions are omitted
- Clickable rows navigate to the class detail page
- Maximum 5 days shown; if no sessions in next 5 days, show "No upcoming sessions"

**Data source:** existing `api.schedule.listAll` with `date_from: today, date_to: today + 5 days`

### Recent Activity Feed

A compact log of the last 10 actions across the system. Provides a pulse of what's happening without checking each page individually.

**Event types tracked:**
- Report filed (who filed it, for which class, which date)
- Students enrolled/unenrolled (count, class name)
- Schedule slots created/updated (class name, date)
- Class created/archived (class name)

**Layout:**
- Simple list with icon, description text, and relative timestamp ("2 hours ago", "yesterday")
- No pagination — just the 10 most recent
- Each item links to the relevant resource

**Data source:** new endpoint `GET /api/dashboard/activity?limit=10` returning `{ items: Array<{ type, description, timestamp, link_to }> }`. Server-side: query recent inserts/updates across reports, enrollments, schedule_slots, and classes tables, union and sort by timestamp. No new database table needed — derives from existing data.

### Classes Ending Soon Section

A dedicated section for classes within 14 days of their end date. Helps coordinators with wrap-up planning.

**Layout:**
- Card-style rows showing: class name (link), end date, progress bar (day X of Y based on start_date to end_date), province badge
- Sorted by end date ascending (soonest first)
- Omitted entirely if no classes are ending within 14 days

**Data source:** client-side filter on `ClassesContext.active` comparing `end_date` to today + 14 days. Progress calculated from `start_date` and `end_date`.

### Active Classes List

Same as current implementation: limited to 5 most recently started classes with "View all" link. No changes.

### Quick Actions

Moved from a standalone section into the dashboard header row. Three buttons inline with the header:
- "Create class" (primary blue button)
- "View reports" (outlined button)
- "View schedule" (outlined button)

Same behavior as current, just repositioned to save vertical space.

---

## Section 2: Sidebar & Navigation Polish

### Coordinator Sidebar Logout

Add a "Sign out" link at the bottom of the `CoordinatorLayout` sidebar, below the Settings NavLink. Styled as subtle text (matching the `text-white/70` nav item style), not a loud button. Uses `signOut` from `useAuth()`.

The `CoordinatorLayout` component will need to accept `signOut` as a prop or import `useAuth` directly.

### Trainer/Trainee Header

Already implemented: sign-out button added to the non-coordinator header in `ProtectedLayout.tsx`. No further changes.

---

## Section 3: Missing Core Features

### 3.1 Recurring Schedule Creation

**Location:** Class detail page, Schedule tab (`ClassScheduleSection.tsx`)

**UI:** Add a "Create recurring" button alongside the existing "Add slot" button. Opens a modal form with:
- Day(s) of week: multi-select checkboxes (Mon–Sun)
- Time range: start time + end time inputs
- Trainer: dropdown (same as existing single-slot form)
- Group: dropdown (same as existing)
- Date range: start date + end date (defaults to class start/end dates)

**Behavior:** On submit, generates all matching slots and sends them to a new batch endpoint. Shows a preview count ("This will create 12 slots") before confirming. Skips dates that already have a slot at the same time for the same group.

**API:** new endpoint `POST /api/classes/:id/schedule/batch` accepting `{ days_of_week: number[], start_time, end_time, trainer_id?, group_label?, date_from, date_to }`. Server generates slots and bulk-inserts. Returns created slot count.

### 3.2 CSV Import for Students

**Location:** Class detail page, Students tab (`ClassStudentsSection.tsx`)

**UI:** Add an "Import CSV" button next to the existing enrollment controls. Clicking opens a modal with:
1. File upload input (accepts .csv)
2. Preview table showing parsed rows with validation status
3. Columns expected: `email` (required), `group` (optional)
4. Validation: checks each email against profiles table. Rows with unknown emails shown in red with "Not found" badge. Duplicate enrollments shown in amber with "Already enrolled" badge.
5. "Enroll N students" confirm button (only counts valid, non-duplicate rows)

**API:** new endpoint `POST /api/classes/:id/enrollments/batch` accepting `{ students: Array<{ email, group_label? }> }`. Server resolves emails to profile IDs, skips duplicates, bulk-inserts enrollments. Returns `{ enrolled: number, skipped: number, errors: Array<{ email, reason }> }`.

### 3.3 Bulk Archive/Delete for Classes

**Location:** Classes page (`ClassesPage.tsx`)

**UI changes:**
- Add a checkbox column as the first column in the active classes table
- "Select all" checkbox in the header
- When any rows are selected, show a floating action bar at the bottom of the viewport: "N selected — Archive | Delete"
- Archive: confirmation dialog, then bulk archive
- Delete: confirmation dialog with danger styling, then bulk delete

**API:** new endpoint `PATCH /api/classes/batch` accepting `{ ids: string[], action: 'archive' | 'delete' }`. Returns `{ updated: number }`.

### 3.4 Roster Export

**Location:** Students and Trainers roster pages (`RosterPage.tsx`)

**UI:** Add an "Export CSV" button in the page header (matching the pattern already used in `PayrollFilterBar`). Exports all profiles matching the current search filter.

**Implementation:** Client-side CSV generation from the currently loaded roster data. Columns: Full Name, Email, Province, Role, Created At. Uses same CSV download pattern as payroll export.

### 3.5 Report Status Workflow

**Database change:** Add `status` column to the `reports` table: `text CHECK (status IN ('draft', 'finalized')) DEFAULT 'draft'`. Migration sets all existing reports to `'finalized'`.

**API changes:**
- `GET /api/reports` response includes `status` field
- `PATCH /api/reports/:id/finalize` — sets status to `finalized`
- Report creation defaults to `draft`
- Add `status` filter parameter to `GET /api/reports`

**UI changes:**
- Reports table (`ReportsTable.tsx`): add a status badge column (draft = amber, finalized = green)
- Reports filter bar (`ReportsFilterBar.tsx`): add a Status dropdown (All / Draft / Finalized)
- Report preview modal: if draft, show a "Finalize" button in the toolbar
- Class detail Reports tab: same status badge and finalize action

---

## Section 4: Data & Insights

### 4.1 Attendance Rate Badges on Class Cards

**Location:** Classes page class rows and Dashboard active classes list

**UI:** Add a small percentage badge next to each class name showing attendance rate (e.g., "94%"). Color-coded: green >= 90%, amber 75-89%, red < 75%.

**Data source:** new field in classes list API response: `attendance_rate: number | null`. Calculated server-side as `(attended_count / total_report_entries) * 100` for that class. Null if no reports exist.

**API change:** Extend `GET /api/classes` response to include `attendance_rate` per class.

### 4.2 Class Completion Percentage

**Location:** Class detail Overview tab (`ClassOverviewSection.tsx`)

**UI:** Add a progress bar below the class header showing completion. Label: "Day X of Y (Z%)". Based on calendar days: `(today - start_date) / (end_date - start_date) * 100`, capped at 0-100%.

**Implementation:** Pure client-side calculation from existing `start_date` and `end_date` fields. No API change needed.

### 4.3 Student Progress Sparklines

**Location:** Student Progress page (`StudentProgressPage.tsx`)

**UI:** Below the progress ratings table, add a "Trends" section showing a compact visual for each rating category (GK, DEX, HOM). Each trend is a row of colored dots representing the rating for each session, ordered chronologically left to right:
- EE = green dot
- ME = blue dot
- AD = amber dot
- NI = red dot
- null = gray dot

This gives an instant visual of whether ratings are improving, stable, or declining — without adding a chart library dependency.

**Implementation:** Pure client-side rendering from existing progress data. CSS flexbox with small colored circles. No API change needed.

---

## Section 5: UI/UX Polish

### 5.1 Collapsible Filter Bars

**Location:** `ReportsFilterBar.tsx`, `ScheduleFilterBar.tsx`, `PayrollFilterBar.tsx`

**Behavior:**
- Wrap filter controls in a collapsible panel with a toggle button
- When collapsed, show a single-line summary of active filters (e.g., "Filters: BC, Poker, Apr 1–7") and a "Show filters" button
- When expanded, show the full filter bar as currently designed
- Default state: expanded on desktop (md+), collapsed on mobile
- Animate open/close with CSS transition (max-height)

**Implementation:** Create a shared `CollapsibleFilterBar` wrapper component. Each existing filter bar wraps its content in this component and provides a `summary` render prop that returns the active filter description.

### 5.2 Sortable Columns on All Tables

**Location:** `ClassesPage.tsx` (active + archived tables), `RosterPage.tsx`

**Implementation:** Apply the same sort pattern already used in `ReportsTable` and `ScheduleTable`:
- Clickable column headers with sort direction indicator (arrow up/down)
- `useState` for `sortKey` and `sortDir`
- Client-side sort of the displayed data
- Default sort: Classes by start date descending, Roster by name ascending

### 5.3 Consistent Empty States

**Implementation:** Create a reusable `EmptyState` component:
```
Props: { icon?: ReactNode, title: string, description?: string, action?: { label: string, onClick: () => void } }
```

Renders: centered dashed-border container with optional icon, title text, description text, and action button. Replace all existing ad-hoc empty state markup across the app with this component.

**Pages affected:** ClassesPage, RosterPage, SchedulePage, ReportsPage, PayrollPages, ClassDetail sub-tabs, TrainerDashboard, TraineeDashboard.

### 5.4 Toast Confirmations for Destructive Actions

**Location:** All pages with archive, delete, unenroll, or remove-trainer actions

**Implementation:** After each successful destructive action, call `toast('message', 'success')` using the existing `ToastContext`. After failures, call `toast('message', 'error')`. The ToastContext already exists and works — it's just not used consistently.

**Actions to cover:**
- Archive/unarchive/delete class
- Remove trainer from class
- Unenroll student
- Delete schedule slot
- Delete drill

### 5.5 Mobile Form Improvements for Daily Reports

**Location:** Class detail Reports tab — report creation/edit form (`ClassReportsSection.tsx`)

**UI change:** Break the report form into collapsible sections:
1. **Session Info** — date, session label, timeline blocks
2. **Attendance** — student attendance checkboxes
3. **Ratings** — GK/DEX/HOM ratings per student
4. **Drills** — drill times/scores per student

Each section has a header that shows a completion indicator (checkmark or count) when filled. Sections collapse after being completed, showing a summary line. All sections can be manually expanded/collapsed at any time.

**Implementation:** Wrap each section in the same `CollapsibleFilterBar`-style component (or a shared `CollapsibleSection` component). Expand the first incomplete section by default.

---

## New API Endpoints Summary

| Endpoint | Method | Purpose |
|---|---|---|
| `/api/dashboard/hours-summary` | GET | Total hours and trainer count for current month |
| `/api/dashboard/enrollment-summary` | GET | Total enrolled and waitlist counts |
| `/api/dashboard/attendance-rate` | GET | Overall attendance percentage for current month |
| `/api/dashboard/unreported-sessions` | GET | Today's sessions with no report filed |
| `/api/dashboard/activity?limit=N` | GET | Recent activity feed (derived from existing tables) |
| `/api/classes/:id/schedule/batch` | POST | Bulk-create recurring schedule slots |
| `/api/classes/:id/enrollments/batch` | POST | Bulk-enroll students from CSV data |
| `/api/classes/batch` | PATCH | Bulk archive or delete classes |
| `/api/reports/:id/finalize` | PATCH | Set report status to finalized |

## Database Changes

| Table | Change |
|---|---|
| `reports` | Add `status TEXT CHECK (status IN ('draft', 'finalized')) DEFAULT 'draft'`. Backfill existing rows to `'finalized'`. |

## New Shared Components

| Component | Purpose |
|---|---|
| `CollapsibleSection` | Wrapper for collapsible panels with summary line, used by filter bars and report form sections |
| `EmptyState` | Standardized empty/no-data display with icon, title, description, and optional action button |

## Files Modified (estimated)

**Frontend — new/heavily modified:**
- `web/src/pages/DashboardContent.tsx` — major rewrite
- `web/src/components/CollapsibleSection.tsx` — new
- `web/src/components/EmptyState.tsx` — new
- `web/src/pages/ClassesPage.tsx` — bulk select, attendance badges, sortable columns
- `web/src/pages/RosterPage.tsx` — export CSV, sortable columns
- `web/src/pages/ClassDetail/ClassScheduleSection.tsx` — recurring creation modal
- `web/src/pages/ClassDetail/ClassStudentsSection.tsx` — CSV import modal
- `web/src/pages/ClassDetail/ClassReportsSection.tsx` — collapsible form sections, report status
- `web/src/pages/ClassDetail/ClassOverviewSection.tsx` — completion progress bar
- `web/src/pages/StudentProgressPage.tsx` — sparkline trends
- `web/src/components/CoordinatorLayout.tsx` — sign out button
- `web/src/components/ReportsFilterBar.tsx` — collapsible wrapper, status filter
- `web/src/components/ScheduleFilterBar.tsx` — collapsible wrapper
- `web/src/components/PayrollFilterBar.tsx` — collapsible wrapper
- `web/src/components/ReportsTable.tsx` — status badge column
- `web/src/lib/apiClient.ts` — new API methods

**Backend — new/modified:**
- `server/src/routes/dashboard.ts` — new route file for dashboard endpoints
- `server/src/routes/schedule.ts` — batch creation endpoint
- `server/src/routes/enrollments.ts` — batch enrollment endpoint
- `server/src/routes/classes.ts` — batch archive/delete, attendance_rate in list response
- `server/src/routes/reports.ts` — status field, finalize endpoint
- `server/src/routes/index.ts` — register new dashboard routes
