# Trainer View Design Spec

## Overview

Add a full trainer experience to the Gateway Training Tool. Trainers get their own sidebar navigation, scoped views of their assigned classes, and the ability to create/edit daily reports, log hours (own + student), manage drills, and record student progress. Trainers cannot see other trainers' payroll, access unassigned classes, or perform coordinator-level management actions.

## Decisions

- **Approach:** Extend self-service routes (`/me/*`) with trainer-class validation — not shared routes with role filtering
- **Report workflow:** Trainers can finalize reports directly; coordinators retain override/edit ability
- **Scope:** Strictly scoped to assigned classes only — no cross-class visibility
- **Hours logging:** Both per-student individual and per-group bulk options available
- **Drills:** Trainers can create, edit, and delete drills for their classes
- **Mobile:** Full mobile support with bottom nav (same pattern as coordinator)
- **Schedule:** Read-only for trainers; coordinators own schedule management

---

## 1. Navigation & Layout

### TrainerLayout Component

Mirrors `CoordinatorLayout` pattern.

**Desktop:** Fixed left sidebar (64px wide) with icon nav:
- Dashboard (home)
- My Classes (book)
- Reports (document)
- Schedule (calendar)
- Hours (clock)
- Bottom section: avatar, sign-out

**Mobile:** Top bar (logo + avatar) + bottom nav with 4 primary items + "More" bottom sheet. Same pattern as coordinator's mobile nav in `ProtectedLayout`.

### ProtectedLayout Changes

Add `role === 'trainer'` branch alongside existing `role === 'coordinator'` branch. Renders `TrainerLayout` sidebar, mobile top/bottom nav, and `<Outlet />` for content.

### Routing

New trainer-only routes nested under protected layout:

| Path | Page | Guard |
|------|------|-------|
| `/dashboard` | TrainerDashboard (enhanced) | TrainerRoute |
| `/my-classes` | MyClassesPage | TrainerRoute |
| `/my-classes/:classId` | TrainerClassDetailPage (tabbed) | TrainerRoute |
| `/reports` | TrainerReportsPage (cross-class) | TrainerRoute |
| `/schedule` | TrainerSchedulePage (cross-class) | TrainerRoute |
| `/hours` | TrainerHoursPage (cross-class) | TrainerRoute |

`TrainerRoute` guard component redirects non-trainers to `/dashboard`.

---

## 2. Backend API — Self-Service Endpoints

All endpoints in `selfService.ts` under `/me/*`. Every `/me/my-classes/:classId/*` endpoint validates trainer assignment via shared helper:

```typescript
async function validateTrainerAccess(email: string, classId: string): Promise<ClassTrainer>
// Queries class_trainers where trainer_email = email AND class_id = classId
// Returns class_trainer row (includes role: primary/assistant)
// Throws 403 if not found
```

### Read Endpoints

| Endpoint | Returns | Notes |
|----------|---------|-------|
| `GET /me/my-classes` | All assigned classes with metadata | Replaces current trainer-dashboard response |
| `GET /me/my-classes/:classId` | Class detail + enrolled students + drills | Validates trainer is assigned |
| `GET /me/my-classes/:classId/reports` | Paginated reports for that class | Filters: date range, status, search |
| `GET /me/my-classes/:classId/reports/:reportId` | Single report with trainee progress + drill times | Full detail view |
| `GET /me/my-classes/:classId/schedule` | Schedule slots for that class | Filters: date range, group |
| `GET /me/my-classes/:classId/hours` | Trainer's own hours + all student hours | No other trainers' hours |
| `GET /me/my-classes/:classId/students/:enrollmentId/progress` | Single student's progress within class | Drill times, ratings, attendance |
| `GET /me/reports` | Paginated reports across all assigned classes | Cross-class Reports page |
| `GET /me/schedule` | Schedule across all assigned classes | Cross-class Schedule page |
| `GET /me/hours` | Personal hours across all classes | Cross-class Hours page |

### Write Endpoints

| Endpoint | Action | Notes |
|----------|--------|-------|
| `POST /me/my-classes/:classId/reports` | Create daily report | Auto-includes trainer as participant, status = draft |
| `PUT /me/my-classes/:classId/reports/:reportId` | Update report (header + trainee progress + drill times) | Can update draft or finalized |
| `POST /me/my-classes/:classId/reports/:reportId/finalize` | Finalize report | Trainer can finalize directly |
| `POST /me/my-classes/:classId/hours` | Log hours (own or student, single entry) | `person_type` determines trainer vs student |
| `POST /me/my-classes/:classId/hours/bulk` | Bulk log student hours | Array of { enrollment_id, hours, notes } — applies same date and class to all |
| `PUT /me/my-classes/:classId/hours/:hourId` | Update hours entry | Only entries the trainer created |
| `DELETE /me/my-classes/:classId/hours/:hourId` | Delete hours entry | Only entries the trainer created |
| `POST /me/my-classes/:classId/drills` | Create drill | name, type, par_time, target_score |
| `PUT /me/my-classes/:classId/drills/:drillId` | Update drill | Par time, target score, active status |
| `DELETE /me/my-classes/:classId/drills/:drillId` | Delete drill | Deactivate if referenced by recorded times |

All write operations are audit-logged.

Write endpoints return 400 for archived classes.

---

## 3. Frontend Pages & Components

### TrainerDashboard (enhanced)

Replaces current minimal dashboard:
- Welcome header with trainer name
- Stat cards: assigned classes count, upcoming sessions (this week), pending draft reports, total hours (this month)
- **My Classes** card grid — name, site, game type, role badge, student count, next session. Click opens class detail.
- **Upcoming Schedule** — next 5 days across all classes, grouped by day
- **Recent Reports** — last 5 reports with status badges

### MyClassesPage

Grid of assigned classes. Each card: class metadata, trainer role (primary/assistant), enrolled count. Filter by active/archived. Click opens class detail.

### TrainerClassDetailPage

Tabbed layout with scoped data:

| Tab | Content | Write Actions |
|-----|---------|---------------|
| **Overview** | Class name, site, province, game type, dates, trainer's role | None |
| **Students** | Enrolled students list (name, email, status, group) | None |
| **Schedule** | Schedule slots table, filterable by date/group | None |
| **Drills** | Drill/test definitions with par times and target scores | Create, edit, delete, toggle active |
| **Reports** | Report list (date, status, session label). Click opens report detail/edit. | Create, edit, finalize |
| **Hours** | Two sub-sections: "My Hours" (trainer's own) and "Student Hours". Log individually or bulk. | Create, edit, delete |

### Report Create/Edit Form

- **Header:** date, group label, game, session label, class start/end time, trainers present (auto-includes self)
- **Attendance:** per-student checkboxes (present/absent/late), mg_confirmed, mg_attended counts
- **Progress:** per-student ratings (GK, Dex, HoM — dropdown 1-5), progress notes, homework completed, coming back next day
- **Drill times:** per-student results. Select drill, enter time or score per student.
- **Actions:** Save as draft, Finalize

### TrainerReportsPage (cross-class)

Paginated report list across all assigned classes. Filters: class, date range, status. Reuses `ReportsTable` pattern.

### TrainerSchedulePage (cross-class)

Schedule across all assigned classes. Table view with filters: class, date range, group. Reuses `ScheduleTable` pattern.

### TrainerHoursPage (cross-class)

Personal hours across all classes. Shows date, class, hours, paid status, notes. Summary stats at top (total this month, unpaid). Read-only — editing within class detail.

### Reused Components

- `Pagination`, `EmptyState`, `ConfirmDialog`, `Skeleton*`, `CollapsibleSection`
- `ScheduleTable`, `ReportsTable` (pass scoped data)
- `useToast()` for notifications

---

## 4. Data Flow & State Management

### TrainerContext

```typescript
function useTrainer(): {
  classes: TrainerClass[]
  loading: boolean
  refresh: () => Promise<void>
}
```

Fetched on mount via `GET /me/my-classes`. Used by dashboard, MyClassesPage, and filter dropdowns.

### TrainerClassDetailContext

Wraps class detail page, parallel-fetches all class data:

```typescript
function useTrainerClassDetail(): {
  classInfo: TrainerClassDetail
  students: ClassEnrollment[]
  schedule: ClassScheduleSlot[]
  reports: ClassDailyReport[]
  hours: { trainer: LoggedHours[], students: LoggedHours[] }
  drills: ClassDrill[]
  loading: boolean
  refreshReports, refreshHours, refreshDrills, refreshSchedule, refreshStudents
}
```

### Cross-Class Pages

Custom hooks following `useScheduleQuery` / `useReportsQuery` pattern — local filter/sort/pagination state, calling `/me/reports` or `/me/schedule`.

### Mutation Flow

```
User action (e.g., "Save Report")
  -> API call (POST /me/my-classes/:classId/reports)
  -> Backend validates trainer access
  -> Backend writes to DB + audit log
  -> Frontend receives success
  -> Context refresh function called
  -> Toast notification
```

### Error Handling

Try/catch around API calls, errors via `useToast()`. Client-side form validation before submission.

---

## 5. Permissions Boundary

### Coordinator Retains

- Full access to all data across all classes
- Override/edit any trainer-created report
- Un-finalize reports
- View all trainer and student hours
- Edit/delete trainer-created drills
- Full audit log visibility

### Trainers Cannot

- View other trainers' hours/payroll
- See classes they're not assigned to
- Add/remove trainers or students
- Archive or delete a class
- Access coordinator dashboard stats
- Access settings page
- Edit schedule slots

### Edge Cases

- **Trainer removed from class:** Existing data remains. Access revoked immediately (403 on next call). Frontend redirects to My Classes.
- **Class archived:** Read-only access to historical data. Write endpoints return 400.
- **Concurrent edits:** Last-write-wins (same as coordinator behavior). No locking for v1.

### Audit Trail

All trainer writes logged to `audit_logs` with user_id, action, table_name, record_id, and changes JSON.
