# Coordinator Dashboard & App-Wide Polish — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enhance the coordinator dashboard with richer summary cards, actionable alerts, activity feed, and coming-up schedule; add missing features (recurring schedules, CSV import, bulk ops, report status); improve data visibility (attendance badges, completion bars, sparklines); polish UI across all pages (collapsible filters, sortable tables, empty states, toasts, mobile report form).

**Architecture:** Dashboard-outward approach. New backend endpoints for dashboard aggregation data. Frontend rewrite of DashboardContent.tsx with new data sources. Shared UI components (CollapsibleSection, EmptyState) created once and used across all pages. Existing API patterns (Express + Supabase query builder, centralized apiClient) followed throughout.

**Tech Stack:** React 18, TypeScript, Tailwind CSS, React Router v6, Express 4, Supabase JS client, Vite.

**Spec:** `docs/superpowers/specs/2026-04-01-coordinator-polish-design.md`

---

## File Structure

### New Files
- `server/src/routes/dashboard.ts` — Dashboard aggregation endpoints (hours, enrollment, attendance, unreported sessions, activity feed)
- `web/src/components/CollapsibleSection.tsx` — Shared collapsible panel wrapper
- `web/src/components/EmptyState.tsx` — Standardized empty state component

### Modified Files
- `server/src/routes/index.ts` — Register dashboard routes
- `server/src/routes/classes.ts` — Add attendance_rate to list response, batch archive/delete
- `server/src/routes/schedule.ts` — Batch slot creation endpoint
- `server/src/routes/enrollments.ts` — Batch enrollment endpoint
- `server/src/routes/reports.ts` — Add status field, finalize endpoint
- `web/src/types/index.ts` — New types for dashboard, report status
- `web/src/lib/apiClient.ts` — New API methods for all new endpoints
- `web/src/pages/DashboardContent.tsx` — Major rewrite with new cards, alerts, sections
- `web/src/pages/ClassesPage.tsx` — Bulk select, attendance badges, sortable columns
- `web/src/pages/RosterPage.tsx` — CSV export, sortable columns
- `web/src/pages/ClassDetail/ClassScheduleSection.tsx` — Recurring creation modal
- `web/src/pages/ClassDetail/ClassStudentsSection.tsx` — CSV import modal
- `web/src/pages/ClassDetail/ClassReportsSection.tsx` — Collapsible form sections, report status
- `web/src/pages/ClassDetail/ClassOverviewSection.tsx` — Completion progress bar
- `web/src/pages/StudentProgressPage.tsx` — Sparkline trends
- `web/src/components/CoordinatorLayout.tsx` — Sign out button
- `web/src/components/ReportsFilterBar.tsx` — Collapsible wrapper, status filter
- `web/src/components/ScheduleFilterBar.tsx` — Collapsible wrapper
- `web/src/components/PayrollFilterBar.tsx` — Collapsible wrapper
- `web/src/components/ReportsTable.tsx` — Status badge column

---

## Task 1: Shared UI Components (EmptyState + CollapsibleSection)

**Files:**
- Create: `web/src/components/EmptyState.tsx`
- Create: `web/src/components/CollapsibleSection.tsx`

- [ ] **Step 1: Create EmptyState component**

```tsx
// web/src/components/EmptyState.tsx
interface EmptyStateProps {
  icon?: React.ReactNode
  title: string
  description?: string
  action?: { label: string; onClick: () => void }
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-10 text-center">
      {icon && <div className="mb-3 flex justify-center text-slate-400">{icon}</div>}
      <p className="text-sm font-medium text-slate-600">{title}</p>
      {description && <p className="mt-1 text-xs text-slate-500">{description}</p>}
      {action && (
        <button
          type="button"
          onClick={action.onClick}
          className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-gw-blue px-3 py-1.5 text-xs font-medium text-white hover:bg-gw-blue-hover"
        >
          {action.label}
        </button>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Create CollapsibleSection component**

```tsx
// web/src/components/CollapsibleSection.tsx
import { useState, useEffect } from 'react'

interface CollapsibleSectionProps {
  title?: string
  summary?: string
  defaultOpen?: boolean
  mobileDefaultOpen?: boolean
  children: React.ReactNode
}

export function CollapsibleSection({
  title,
  summary,
  defaultOpen = true,
  mobileDefaultOpen = false,
  children,
}: CollapsibleSectionProps) {
  const [open, setOpen] = useState(defaultOpen)

  // On mobile, override default to collapsed
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)')
    if (mq.matches && !mobileDefaultOpen) setOpen(false)
  }, [mobileDefaultOpen])

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between gap-2 py-2 text-left"
      >
        <div className="flex items-center gap-2">
          {title && <span className="text-sm font-semibold text-slate-700">{title}</span>}
          {!open && summary && (
            <span className="text-xs text-slate-500 truncate max-w-xs">{summary}</span>
          )}
        </div>
        <svg
          width="14"
          height="14"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth="2"
          className={`shrink-0 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      <div
        className={`overflow-hidden transition-all duration-200 ${
          open ? 'max-h-[5000px] opacity-100' : 'max-h-0 opacity-0'
        }`}
      >
        {children}
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Verify components render correctly**

Open the app in the browser. Import EmptyState into any existing page temporarily to verify it renders. Remove the test import after confirming.

- [ ] **Step 4: Commit**

```bash
git add web/src/components/EmptyState.tsx web/src/components/CollapsibleSection.tsx
git commit -m "feat: add EmptyState and CollapsibleSection shared components"
```

---

## Task 2: Dashboard Backend Endpoints

**Files:**
- Create: `server/src/routes/dashboard.ts`
- Modify: `server/src/routes/index.ts`

- [ ] **Step 1: Create dashboard route file with all 5 endpoints**

```ts
// server/src/routes/dashboard.ts
import { Router, Request, Response, NextFunction } from 'express'
import { supabase } from '../lib/supabase'

export const dashboardRouter = Router()

// GET /api/dashboard/hours-summary
dashboardRouter.get('/dashboard/hours-summary', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const now = new Date()
    const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
    const { data, error } = await supabase
      .from('class_logged_hours')
      .select('hours, trainer_id')
      .eq('person_type', 'trainer')
      .gte('log_date', monthStart)

    if (error) throw error
    const rows = data ?? []
    const totalHours = rows.reduce((sum, r) => sum + (r.hours ?? 0), 0)
    const trainerIds = new Set(rows.map(r => r.trainer_id).filter(Boolean))
    res.json({
      total_hours: Math.round(totalHours * 100) / 100,
      trainer_count: trainerIds.size,
    })
  } catch (err) {
    next(err)
  }
})

// GET /api/dashboard/enrollment-summary
dashboardRouter.get('/dashboard/enrollment-summary', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { data: classes } = await supabase
      .from('classes')
      .select('id')
      .eq('archived', false)
    const classIds = (classes ?? []).map(c => c.id)
    if (classIds.length === 0) {
      res.json({ enrolled: 0, waitlist: 0 })
      return
    }

    const { data, error } = await supabase
      .from('class_enrollments')
      .select('status')
      .in('class_id', classIds)
      .in('status', ['enrolled', 'waitlist'])

    if (error) throw error
    const rows = data ?? []
    const enrolled = rows.filter(r => r.status === 'enrolled').length
    const waitlist = rows.filter(r => r.status === 'waitlist').length
    res.json({ enrolled, waitlist })
  } catch (err) {
    next(err)
  }
})

// GET /api/dashboard/attendance-rate
dashboardRouter.get('/dashboard/attendance-rate', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const now = new Date()
    const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`

    // Get report IDs for this month
    const { data: reports } = await supabase
      .from('class_daily_reports')
      .select('id')
      .gte('report_date', monthStart)
    const reportIds = (reports ?? []).map(r => r.id)
    if (reportIds.length === 0) {
      res.json({ rate: null })
      return
    }

    const { data: progress, error } = await supabase
      .from('class_daily_report_trainee_progress')
      .select('attendance')
      .in('report_id', reportIds)

    if (error) throw error
    const rows = progress ?? []
    if (rows.length === 0) {
      res.json({ rate: null })
      return
    }
    const attended = rows.filter(r => r.attendance === true).length
    const rate = Math.round((attended / rows.length) * 100)
    res.json({ rate })
  } catch (err) {
    next(err)
  }
})

// GET /api/dashboard/unreported-sessions
dashboardRouter.get('/dashboard/unreported-sessions', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const today = new Date().toISOString().split('T')[0]

    // Get today's schedule slots with class info
    const { data: slots, error: slotsError } = await supabase
      .from('class_schedule_slots')
      .select('class_id, classes!inner(name)')
      .eq('slot_date', today)

    if (slotsError) throw slotsError

    // Get today's reports
    const { data: reports, error: reportsError } = await supabase
      .from('class_daily_reports')
      .select('class_id')
      .eq('report_date', today)

    if (reportsError) throw reportsError

    const reportedClassIds = new Set((reports ?? []).map(r => r.class_id))
    const slotRows = slots ?? []

    // Find unique classes that have slots but no report
    const unreported = new Map<string, string>()
    for (const slot of slotRows) {
      if (!reportedClassIds.has(slot.class_id)) {
        const cls = slot.classes as unknown as { name: string }
        unreported.set(slot.class_id, cls.name)
      }
    }

    res.json({
      classes: [...unreported.entries()].map(([class_id, class_name]) => ({
        class_id,
        class_name,
        session_date: today,
      })),
    })
  } catch (err) {
    next(err)
  }
})

// GET /api/dashboard/activity?limit=N
dashboardRouter.get('/dashboard/activity', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const limit = Math.min(Math.max(Number(req.query.limit) || 10, 1), 50)

    // Fetch recent items from multiple tables in parallel
    const [
      { data: recentReports },
      { data: recentEnrollments },
      { data: recentSlots },
      { data: recentClasses },
    ] = await Promise.all([
      supabase
        .from('class_daily_reports')
        .select('id, report_date, created_at, class_id, classes!inner(name)')
        .order('created_at', { ascending: false })
        .limit(limit),
      supabase
        .from('class_enrollments')
        .select('id, student_name, status, created_at, class_id, classes!inner(name)')
        .order('created_at', { ascending: false })
        .limit(limit),
      supabase
        .from('class_schedule_slots')
        .select('id, slot_date, created_at, class_id, classes!inner(name)')
        .order('created_at', { ascending: false })
        .limit(limit),
      supabase
        .from('classes')
        .select('id, name, archived, created_at, updated_at')
        .order('updated_at', { ascending: false })
        .limit(limit),
    ])

    type ActivityItem = { type: string; description: string; timestamp: string; link_to: string }
    const items: ActivityItem[] = []

    for (const r of recentReports ?? []) {
      const cls = r.classes as unknown as { name: string }
      items.push({
        type: 'report',
        description: `Report filed for ${cls.name} (${r.report_date})`,
        timestamp: r.created_at,
        link_to: `/classes/${cls.name.trim().replace(/\s+/g, '-')}`,
      })
    }
    for (const e of recentEnrollments ?? []) {
      const cls = e.classes as unknown as { name: string }
      items.push({
        type: 'enrollment',
        description: `${e.student_name} ${e.status} in ${cls.name}`,
        timestamp: e.created_at,
        link_to: `/classes/${cls.name.trim().replace(/\s+/g, '-')}`,
      })
    }
    for (const s of recentSlots ?? []) {
      const cls = s.classes as unknown as { name: string }
      items.push({
        type: 'schedule',
        description: `Schedule slot added for ${cls.name} on ${s.slot_date}`,
        timestamp: s.created_at,
        link_to: `/classes/${cls.name.trim().replace(/\s+/g, '-')}`,
      })
    }
    for (const c of recentClasses ?? []) {
      items.push({
        type: 'class',
        description: c.archived ? `${c.name} archived` : `${c.name} created`,
        timestamp: c.updated_at ?? c.created_at,
        link_to: `/classes/${c.name.trim().replace(/\s+/g, '-')}`,
      })
    }

    // Sort by timestamp descending, take top N
    items.sort((a, b) => b.timestamp.localeCompare(a.timestamp))
    res.json({ items: items.slice(0, limit) })
  } catch (err) {
    next(err)
  }
})
```

- [ ] **Step 2: Register dashboard routes in index.ts**

In `server/src/routes/index.ts`, add the import and use it **after** `requireAuth` but **before** `requireCoordinator` — dashboard endpoints need auth but are coordinator-only by data sensitivity, so actually place it after `requireCoordinator`:

```ts
// Add import at top
import { dashboardRouter } from './dashboard'

// Add after requireCoordinator line:
router.use(dashboardRouter)
```

- [ ] **Step 3: Verify endpoints work**

Start the server with `npm run dev` in `server/`. Use curl or the browser to test:
```
GET http://localhost:3001/api/dashboard/hours-summary
GET http://localhost:3001/api/dashboard/enrollment-summary
GET http://localhost:3001/api/dashboard/attendance-rate
GET http://localhost:3001/api/dashboard/unreported-sessions
GET http://localhost:3001/api/dashboard/activity?limit=5
```
Each should return JSON (may have empty/zero values if no data).

- [ ] **Step 4: Commit**

```bash
git add server/src/routes/dashboard.ts server/src/routes/index.ts
git commit -m "feat: add dashboard aggregation API endpoints"
```

---

## Task 3: Frontend API Client + Types for Dashboard

**Files:**
- Modify: `web/src/types/index.ts`
- Modify: `web/src/lib/apiClient.ts`

- [ ] **Step 1: Add dashboard types**

Append to the bottom of `web/src/types/index.ts`:

```ts
/* ── Dashboard ──────────────────────────────────── */

export type DashboardHoursSummary = {
  total_hours: number
  trainer_count: number
}

export type DashboardEnrollmentSummary = {
  enrolled: number
  waitlist: number
}

export type DashboardAttendanceRate = {
  rate: number | null
}

export type DashboardUnreportedSession = {
  class_id: string
  class_name: string
  session_date: string
}

export type DashboardActivityItem = {
  type: string
  description: string
  timestamp: string
  link_to: string
}
```

- [ ] **Step 2: Add dashboard API methods**

In `web/src/lib/apiClient.ts`, add a `dashboard` namespace to the `api` object:

```ts
dashboard: {
  hoursSummary: () => req<DashboardHoursSummary>('/dashboard/hours-summary'),
  enrollmentSummary: () => req<DashboardEnrollmentSummary>('/dashboard/enrollment-summary'),
  attendanceRate: () => req<DashboardAttendanceRate>('/dashboard/attendance-rate'),
  unreportedSessions: () => req<{ classes: DashboardUnreportedSession[] }>('/dashboard/unreported-sessions'),
  activity: (limit = 10) => req<{ items: DashboardActivityItem[] }>(`/dashboard/activity?limit=${limit}`),
},
```

Add the type imports at the top of apiClient.ts:
```ts
import type { DashboardHoursSummary, DashboardEnrollmentSummary, DashboardAttendanceRate, DashboardUnreportedSession, DashboardActivityItem } from '../types'
```

- [ ] **Step 3: Commit**

```bash
git add web/src/types/index.ts web/src/lib/apiClient.ts
git commit -m "feat: add dashboard types and API client methods"
```

---

## Task 4: Enhanced Dashboard — Rewrite DashboardContent.tsx

**Files:**
- Modify: `web/src/pages/DashboardContent.tsx`

This is the largest single task. The full rewrite replaces the existing dashboard with the new 6-card + alerts + coming-up + activity + ending-soon layout.

- [ ] **Step 1: Rewrite DashboardContent.tsx**

Replace the entire file with:

```tsx
// web/src/pages/DashboardContent.tsx
import { useState, useEffect, useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useClasses } from '../contexts/ClassesContext'
import { api } from '../lib/apiClient'
import type { ScheduleRow } from '../lib/apiClient'
import { formatTime, classSlug } from '../lib/utils'
import { SkeletonText, SkeletonTable } from '../components/Skeleton'
import { EmptyState } from '../components/EmptyState'
import { CreateClassModal } from '../components/CreateClassModal'
import type { Province, DashboardHoursSummary, DashboardEnrollmentSummary, DashboardAttendanceRate, DashboardUnreportedSession, DashboardActivityItem } from '../types'

const provinceBadge: Record<Province, string> = {
  BC: 'bg-emerald-100 text-emerald-700',
  AB: 'bg-amber-100 text-amber-700',
  ON: 'bg-blue-100 text-blue-700',
}

function toISODate(d: Date) {
  return d.toISOString().slice(0, 10)
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days === 1) return 'yesterday'
  return `${days}d ago`
}

function dayLabel(dateStr: string): string {
  const today = toISODate(new Date())
  const tomorrow = toISODate(new Date(Date.now() + 86400000))
  if (dateStr === today) return 'Today'
  if (dateStr === tomorrow) return 'Tomorrow'
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('en-CA', { weekday: 'short', month: 'short', day: 'numeric' })
}

const MAX_CLASSES_SHOWN = 5
const COMING_UP_DAYS = 5
const ENDING_SOON_DAYS = 14

export function DashboardContent() {
  const { email, signOut } = useAuth()
  const { active, loading: classesLoading, refresh: refreshClasses } = useClasses()
  const navigate = useNavigate()

  // Dashboard API data
  const [hoursSummary, setHoursSummary] = useState<DashboardHoursSummary | null>(null)
  const [enrollmentSummary, setEnrollmentSummary] = useState<DashboardEnrollmentSummary | null>(null)
  const [attendanceRate, setAttendanceRate] = useState<DashboardAttendanceRate | null>(null)
  const [unreportedSessions, setUnreportedSessions] = useState<DashboardUnreportedSession[]>([])
  const [activityItems, setActivityItems] = useState<DashboardActivityItem[]>([])

  // Schedule data for coming-up section
  const [comingUpSessions, setComingUpSessions] = useState<ScheduleRow[]>([])
  const [sessionsLoading, setSessionsLoading] = useState(true)

  // Reports count (existing)
  const [recentReportsTotal, setRecentReportsTotal] = useState(0)
  const [reportsLoading, setReportsLoading] = useState(true)

  // Dashboard-specific loading
  const [dashLoading, setDashLoading] = useState(true)

  const [createOpen, setCreateOpen] = useState(false)

  // Fetch all dashboard data in parallel
  useEffect(() => {
    const today = toISODate(new Date())
    const endDate = toISODate(new Date(Date.now() + COMING_UP_DAYS * 86400000))
    const sevenDaysAgo = toISODate(new Date(Date.now() - 7 * 86400000))

    Promise.all([
      api.dashboard.hoursSummary().catch(() => ({ total_hours: 0, trainer_count: 0 })),
      api.dashboard.enrollmentSummary().catch(() => ({ enrolled: 0, waitlist: 0 })),
      api.dashboard.attendanceRate().catch(() => ({ rate: null })),
      api.dashboard.unreportedSessions().catch(() => ({ classes: [] })),
      api.dashboard.activity(10).catch(() => ({ items: [] })),
    ]).then(([hours, enrollment, attendance, unreported, activity]) => {
      setHoursSummary(hours)
      setEnrollmentSummary(enrollment)
      setAttendanceRate(attendance)
      setUnreportedSessions(unreported.classes)
      setActivityItems(activity.items)
      setDashLoading(false)
    })

    api.schedule
      .listAll({ date_from: today, date_to: endDate, limit: 200 })
      .then(res => setComingUpSessions(res.data))
      .catch(() => setComingUpSessions([]))
      .finally(() => setSessionsLoading(false))

    api.reports
      .listAll({ date_from: sevenDaysAgo, limit: 1 })
      .then(res => setRecentReportsTotal(res.total))
      .catch(() => setRecentReportsTotal(0))
      .finally(() => setReportsLoading(false))
  }, [])

  // Province breakdown
  const provinceCounts = active.reduce<Record<string, number>>((acc, c) => {
    acc[c.province] = (acc[c.province] || 0) + 1
    return acc
  }, {})

  // Classes ending soon (within 14 days)
  const classesEndingSoon = useMemo(() => {
    const cutoff = toISODate(new Date(Date.now() + ENDING_SOON_DAYS * 86400000))
    const today = toISODate(new Date())
    return active
      .filter(c => c.end_date && c.end_date >= today && c.end_date <= cutoff)
      .sort((a, b) => a.end_date.localeCompare(b.end_date))
  }, [active])

  // Classes ending within 7 days (for alert)
  const classesEndingAlert = useMemo(() => {
    const cutoff = toISODate(new Date(Date.now() + 7 * 86400000))
    const today = toISODate(new Date())
    return active.filter(c => c.end_date && c.end_date >= today && c.end_date <= cutoff)
  }, [active])

  // Coming-up grouped by day
  const sessionsByDay = useMemo(() => {
    const groups = new Map<string, ScheduleRow[]>()
    const sorted = [...comingUpSessions].sort((a, b) => {
      const d = a.slot_date.localeCompare(b.slot_date)
      return d !== 0 ? d : a.start_time.localeCompare(b.start_time)
    })
    for (const s of sorted) {
      if (!groups.has(s.slot_date)) groups.set(s.slot_date, [])
      groups.get(s.slot_date)!.push(s)
    }
    return groups
  }, [comingUpSessions])

  // Active classes limited
  const displayedClasses = useMemo(
    () => [...active].sort((a, b) => b.start_date.localeCompare(a.start_date)).slice(0, MAX_CLASSES_SHOWN),
    [active],
  )
  const hiddenCount = Math.max(0, active.length - MAX_CLASSES_SHOWN)

  // Completion progress helper
  function completionPercent(startDate: string, endDate: string): number {
    const start = new Date(startDate + 'T00:00:00').getTime()
    const end = new Date(endDate + 'T00:00:00').getTime()
    const now = Date.now()
    if (end <= start) return 100
    return Math.min(100, Math.max(0, Math.round(((now - start) / (end - start)) * 100)))
  }

  const hasAlerts = classesEndingAlert.length > 0 || unreportedSessions.length > 0

  return (
    <>
      {/* ── Header with quick actions ──────────────────────────── */}
      <header className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Dashboard</h2>
          <p className="mt-0.5 text-xs text-slate-500">Coordinator overview</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setCreateOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-gw-blue px-3 py-2 text-xs font-medium text-white hover:bg-gw-blue-hover"
          >
            <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 5v14M5 12h14" />
            </svg>
            Create class
          </button>
          <button
            type="button"
            onClick={() => navigate('/reports')}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
          >
            View reports
          </button>
          <button
            type="button"
            onClick={() => navigate('/schedule')}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
          >
            View schedule
          </button>
        </div>
      </header>

      {/* ── Summary cards (2 + 2 + 2) ─────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {/* Active Classes */}
        <section
          className="rounded-xl bg-white p-4 shadow-sm cursor-pointer hover:shadow-md transition-shadow col-span-1"
          onClick={() => navigate('/classes')}
        >
          <h3 className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">Active Classes</h3>
          {classesLoading ? (
            <SkeletonText className="h-7 w-12 mt-2" />
          ) : (
            <>
              <p className="text-2xl font-bold text-gw-dark mt-1">{active.length}</p>
              {Object.keys(provinceCounts).length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {Object.entries(provinceCounts).map(([prov, count]) => (
                    <span
                      key={prov}
                      className={`inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-medium ${provinceBadge[prov as Province] ?? 'bg-slate-100 text-slate-600'}`}
                    >
                      {prov}: {count}
                    </span>
                  ))}
                </div>
              )}
            </>
          )}
        </section>

        {/* Today's Sessions */}
        <section
          className="rounded-xl bg-white p-4 shadow-sm cursor-pointer hover:shadow-md transition-shadow col-span-1"
          onClick={() => navigate('/schedule')}
        >
          <h3 className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">Today&apos;s Sessions</h3>
          {sessionsLoading ? (
            <SkeletonText className="h-7 w-12 mt-2" />
          ) : (
            <>
              <p className="text-2xl font-bold text-gw-dark mt-1">
                {comingUpSessions.filter(s => s.slot_date === toISODate(new Date())).length}
              </p>
              {comingUpSessions.length > 0 && (
                <p className="mt-1 text-[10px] text-slate-500 truncate">
                  next: {formatTime(comingUpSessions[0].start_time)} — {comingUpSessions[0].classes?.name}
                </p>
              )}
            </>
          )}
        </section>

        {/* Reports (7 days) */}
        <section
          className="rounded-xl bg-white p-4 shadow-sm cursor-pointer hover:shadow-md transition-shadow col-span-1"
          onClick={() => navigate('/reports')}
        >
          <h3 className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">Reports (7d)</h3>
          {reportsLoading ? (
            <SkeletonText className="h-7 w-12 mt-2" />
          ) : (
            <>
              <p className="text-2xl font-bold text-gw-dark mt-1">{recentReportsTotal}</p>
              <p className="mt-1 text-[10px] text-slate-500">in the last 7 days</p>
            </>
          )}
        </section>

        {/* Hours This Month */}
        <section
          className="rounded-xl bg-white p-4 shadow-sm cursor-pointer hover:shadow-md transition-shadow col-span-1"
          onClick={() => navigate('/payroll/trainers')}
        >
          <h3 className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">Hours (month)</h3>
          {dashLoading ? (
            <SkeletonText className="h-7 w-12 mt-2" />
          ) : (
            <>
              <p className="text-2xl font-bold text-gw-dark mt-1">{hoursSummary?.total_hours ?? 0}</p>
              <p className="mt-1 text-[10px] text-slate-500">across {hoursSummary?.trainer_count ?? 0} trainers</p>
            </>
          )}
        </section>

        {/* Students Enrolled */}
        <section
          className="rounded-xl bg-white p-4 shadow-sm cursor-pointer hover:shadow-md transition-shadow col-span-1"
          onClick={() => navigate('/students')}
        >
          <h3 className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">Students</h3>
          {dashLoading ? (
            <SkeletonText className="h-7 w-12 mt-2" />
          ) : (
            <>
              <p className="text-2xl font-bold text-gw-dark mt-1">{enrollmentSummary?.enrolled ?? 0}</p>
              <p className="mt-1 text-[10px] text-slate-500">{enrollmentSummary?.waitlist ?? 0} on waitlist</p>
            </>
          )}
        </section>

        {/* Attendance Rate */}
        <section className="rounded-xl bg-white p-4 shadow-sm col-span-1">
          <h3 className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">Attendance</h3>
          {dashLoading ? (
            <SkeletonText className="h-7 w-12 mt-2" />
          ) : (
            <>
              <p className="text-2xl font-bold text-gw-dark mt-1">
                {attendanceRate?.rate != null ? `${attendanceRate.rate}%` : '—'}
              </p>
              <p className="mt-1 text-[10px] text-slate-500">this month</p>
            </>
          )}
        </section>
      </div>

      {/* ── Alerts banner ──────────────────────────────────────── */}
      {!classesLoading && !dashLoading && hasAlerts && (
        <section className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
          <div className="flex items-start gap-2">
            <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-amber-600 mt-0.5 shrink-0">
              <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0zM12 9v4M12 17h.01" />
            </svg>
            <div className="flex flex-col gap-1">
              {classesEndingAlert.length > 0 && (
                <p className="text-xs text-amber-700">
                  <span className="font-semibold">{classesEndingAlert.length} class{classesEndingAlert.length !== 1 ? 'es' : ''} ending within 7 days:</span>{' '}
                  {classesEndingAlert.map((cls, i) => (
                    <span key={cls.id}>
                      {i > 0 && ', '}
                      <Link to={`/classes/${classSlug(cls.name)}`} className="font-medium underline hover:text-amber-900">
                        {cls.name}
                      </Link>
                      {' '}({cls.end_date})
                    </span>
                  ))}
                </p>
              )}
              {unreportedSessions.length > 0 && (
                <p className="text-xs text-amber-700">
                  <span className="font-semibold">{unreportedSessions.length} session{unreportedSessions.length !== 1 ? 's' : ''} today with no report:</span>{' '}
                  {unreportedSessions.map((s, i) => (
                    <span key={s.class_id}>
                      {i > 0 && ', '}
                      <Link to={`/classes/${classSlug(s.class_name)}`} className="font-medium underline hover:text-amber-900">
                        {s.class_name}
                      </Link>
                    </span>
                  ))}
                </p>
              )}
            </div>
          </div>
        </section>
      )}

      {/* ── Coming Up (next 5 days) ────────────────────────────── */}
      <section className="rounded-xl bg-white p-4 shadow-sm">
        <h3 className="text-sm font-semibold text-slate-900 mb-3">Coming Up</h3>
        {sessionsLoading ? (
          <SkeletonTable rows={3} cols={4} />
        ) : sessionsByDay.size === 0 ? (
          <p className="text-xs text-slate-500">No sessions in the next {COMING_UP_DAYS} days.</p>
        ) : (
          <div className="flex flex-col gap-4">
            {[...sessionsByDay.entries()].map(([date, slots]) => (
              <div key={date}>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1.5">
                  {dayLabel(date)} — {date}
                </p>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <tbody>
                      {slots.map(slot => (
                        <tr
                          key={slot.id}
                          className="border-b border-slate-100 last:border-0 cursor-pointer hover:bg-slate-50 transition-colors"
                          onClick={() => navigate(`/classes/${classSlug(slot.classes.name)}`)}
                        >
                          <td className="py-2 pr-4 font-medium text-gw-dark">{slot.classes.name}</td>
                          <td className="py-2 pr-4 text-slate-600">
                            {formatTime(slot.start_time)} – {formatTime(slot.end_time)}
                          </td>
                          <td className="py-2 pr-4 text-slate-600 hidden sm:table-cell">
                            {slot.class_trainers?.trainer_name ?? '—'}
                          </td>
                          <td className="py-2 text-slate-600 hidden sm:table-cell">{slot.group_label || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ── Recent Activity ────────────────────────────────────── */}
      <section className="rounded-xl bg-white p-4 shadow-sm">
        <h3 className="text-sm font-semibold text-slate-900 mb-3">Recent Activity</h3>
        {dashLoading ? (
          <div className="space-y-2">
            {[...Array(5)].map((_, i) => <SkeletonText key={i} className="h-4 w-full" />)}
          </div>
        ) : activityItems.length === 0 ? (
          <p className="text-xs text-slate-500">No recent activity.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {activityItems.map((item, i) => (
              <li key={i} className="flex items-center justify-between gap-3 py-2">
                <Link to={item.link_to} className="text-xs text-slate-700 hover:text-gw-dark truncate">
                  {item.description}
                </Link>
                <span className="shrink-0 text-[10px] text-slate-400">{relativeTime(item.timestamp)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* ── Classes Ending Soon ─────────────────────────────────── */}
      {classesEndingSoon.length > 0 && (
        <section className="rounded-xl bg-white p-4 shadow-sm">
          <h3 className="text-sm font-semibold text-slate-900 mb-3">Classes Ending Soon</h3>
          <div className="flex flex-col gap-2">
            {classesEndingSoon.map(cls => {
              const pct = completionPercent(cls.start_date, cls.end_date)
              return (
                <div
                  key={cls.id}
                  className="flex items-center gap-3 rounded-lg border border-slate-200 px-3 py-2 cursor-pointer hover:bg-slate-50 transition-colors"
                  onClick={() => navigate(`/classes/${classSlug(cls.name)}`)}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium text-gw-dark truncate">{cls.name}</span>
                      <span
                        className={`inline-flex shrink-0 items-center rounded-full px-1.5 py-0.5 text-[10px] font-medium ${provinceBadge[cls.province] ?? 'bg-slate-100 text-slate-600'}`}
                      >
                        {cls.province}
                      </span>
                    </div>
                    <div className="mt-1 flex items-center gap-2">
                      <div className="flex-1 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gw-blue rounded-full transition-all"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <span className="text-[10px] text-slate-500 shrink-0">{pct}%</span>
                    </div>
                  </div>
                  <span className="shrink-0 text-[11px] text-slate-400">ends {cls.end_date}</span>
                </div>
              )
            })}
          </div>
        </section>
      )}

      {/* ── Active Classes list ─────────────────────────────────── */}
      <section className="rounded-xl bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-semibold text-slate-900">Active Classes</h3>
          <Link to="/classes" className="text-xs font-medium text-gw-blue hover:underline">View all</Link>
        </div>
        {classesLoading ? (
          <div className="space-y-2">
            <SkeletonText className="h-4 w-2/3" />
            <SkeletonText className="h-4 w-1/2" />
            <SkeletonText className="h-4 w-3/4" />
          </div>
        ) : active.length === 0 ? (
          <EmptyState title="No active classes" description="Create a class to get started." action={{ label: 'Create class', onClick: () => setCreateOpen(true) }} />
        ) : (
          <>
            <ul className="divide-y divide-slate-100">
              {displayedClasses.map(cls => (
                <li
                  key={cls.id}
                  className="flex items-center justify-between gap-3 py-2 cursor-pointer hover:bg-slate-50 rounded-md px-1 transition-colors"
                  onClick={() => navigate(`/classes/${classSlug(cls.name)}`)}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-xs font-medium text-gw-dark truncate">{cls.name}</span>
                    <span className="text-[11px] text-slate-500 truncate">{cls.site}</span>
                    <span
                      className={`inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${provinceBadge[cls.province] ?? 'bg-slate-100 text-slate-600'}`}
                    >
                      {cls.province}
                    </span>
                  </div>
                  <span className="shrink-0 text-[11px] text-slate-400">{cls.start_date} – {cls.end_date}</span>
                </li>
              ))}
            </ul>
            {hiddenCount > 0 && (
              <Link to="/classes" className="mt-2 block text-center text-xs font-medium text-gw-blue hover:underline">
                and {hiddenCount} more &rarr;
              </Link>
            )}
          </>
        )}
      </section>

      {createOpen && (
        <CreateClassModal
          onClose={() => setCreateOpen(false)}
          onSuccess={() => { setCreateOpen(false); refreshClasses() }}
        />
      )}
    </>
  )
}
```

- [ ] **Step 2: Verify the dashboard renders in the browser**

Start both the server and web dev server. Navigate to `/dashboard` as a coordinator. Verify:
- 6 summary cards render with data (or loading skeletons)
- Alerts banner shows if applicable
- Coming Up section shows next 5 days of sessions
- Recent Activity shows items
- Classes Ending Soon shows if applicable
- Active Classes list works
- Quick action buttons work

- [ ] **Step 3: Commit**

```bash
git add web/src/pages/DashboardContent.tsx
git commit -m "feat: rewrite coordinator dashboard with 6 cards, alerts, activity feed, coming-up schedule"
```

---

## Task 5: Coordinator Sidebar Sign Out Button

**Files:**
- Modify: `web/src/components/CoordinatorLayout.tsx`

- [ ] **Step 1: Add sign out button to sidebar**

In `web/src/components/CoordinatorLayout.tsx`, add the `useAuth` import and the sign out button below the Settings NavLink:

Add import at the top:
```tsx
import { useAuth } from '../contexts/AuthContext'
```

Inside the `CoordinatorLayout` function, add at the beginning:
```tsx
const { signOut } = useAuth()
```

Replace the `{/* Settings pinned to bottom */}` section (the `<div className="mt-auto">` block) with:

```tsx
<div className="mt-auto flex flex-col gap-1">
  <NavLink
    to="/settings"
    onClick={onMobileClose}
    className={({ isActive }) =>
      `w-full rounded-lg px-3 py-2 text-left text-sm flex items-center gap-2.5 ${isActive ? 'bg-white/15 text-white' : 'text-white/70 hover:bg-white/8 hover:text-white'}`
    }
  >
    {settingsIcon}
    Settings
  </NavLink>
  <button
    type="button"
    onClick={() => { onMobileClose(); signOut() }}
    className="w-full rounded-lg px-3 py-2 text-left text-sm flex items-center gap-2.5 text-white/50 hover:bg-white/8 hover:text-white/70"
  >
    <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
      <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9" />
    </svg>
    Sign out
  </button>
</div>
```

- [ ] **Step 2: Verify**

Open the app, check the sidebar shows the sign out button below Settings. Click it — should log out and redirect to `/login`.

- [ ] **Step 3: Commit**

```bash
git add web/src/components/CoordinatorLayout.tsx
git commit -m "feat: add sign out button to coordinator sidebar"
```

---

## Task 6: Report Status Workflow — Backend

**Files:**
- Modify: `server/src/routes/reports.ts`

- [ ] **Step 1: Add status field to report creation defaults**

In `server/src/routes/reports.ts`, in the POST handler for creating a report, add `status: 'draft'` to the insert object. Find the `.insert({...})` call and add the field.

- [ ] **Step 2: Add status filter to GET /reports**

In the GET handler that lists reports, add after the existing filter chain:
```ts
const { status } = req.query
if (status === 'draft' || status === 'finalized') {
  query = query.eq('status', status as string)
}
```

- [ ] **Step 3: Add PATCH /reports/:id/finalize endpoint**

Add after the existing DELETE handler:
```ts
reportsRouter.patch('/reports/:reportId/finalize', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { reportId } = req.params
    const { data, error } = await supabase
      .from('class_daily_reports')
      .update({ status: 'finalized' })
      .eq('id', reportId)
      .select()
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        res.status(404).json({ error: 'Report not found' })
        return
      }
      throw error
    }
    res.json(data)
  } catch (err) {
    next(err)
  }
})
```

- [ ] **Step 4: Add the status column to Supabase**

Run this SQL in the Supabase SQL editor:
```sql
ALTER TABLE class_daily_reports
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'draft'
CHECK (status IN ('draft', 'finalized'));

UPDATE class_daily_reports SET status = 'finalized' WHERE status IS NULL;
```

- [ ] **Step 5: Commit**

```bash
git add server/src/routes/reports.ts
git commit -m "feat: add report status workflow (draft/finalized) with filter and finalize endpoint"
```

---

## Task 7: Report Status Workflow — Frontend

**Files:**
- Modify: `web/src/types/index.ts`
- Modify: `web/src/lib/apiClient.ts`
- Modify: `web/src/components/ReportsTable.tsx`
- Modify: `web/src/components/ReportsFilterBar.tsx`
- Modify: `web/src/components/ReportPreviewModal.tsx`

- [ ] **Step 1: Add status to types**

In `web/src/types/index.ts`, update the `ClassDailyReport` type to include:
```ts
status: 'draft' | 'finalized'
```

- [ ] **Step 2: Add finalize API method**

In `web/src/lib/apiClient.ts`, add to the `reports` section of the `api` object:
```ts
finalize: (reportId: string) => req<ClassDailyReport>(`/reports/${reportId}/finalize`, { method: 'PATCH' }),
```

- [ ] **Step 3: Add status badge to ReportsTable**

In `web/src/components/ReportsTable.tsx`, add a Status column after the Date column in the header:
```tsx
<th className="px-4 py-3 font-medium text-white text-center hidden md:table-cell">Status</th>
```

In the body row, add the corresponding cell:
```tsx
<td className="px-4 py-3 text-center hidden md:table-cell">
  <span className={`inline-block text-[10px] font-medium px-1.5 py-0.5 rounded ${
    r.status === 'finalized' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
  }`}>
    {r.status ?? 'draft'}
  </span>
</td>
```

- [ ] **Step 4: Add status filter to ReportsFilterBar**

In `web/src/components/ReportsFilterBar.tsx`, add a Status select after the existing filters. The component needs to accept and emit a `status` filter value. Add a new `<select>`:
```tsx
<select
  value={filters.status ?? ''}
  onChange={e => onChange({ ...filters, status: e.target.value || undefined })}
  className="rounded-md border border-slate-300 px-2 py-1.5 text-sm"
>
  <option value="">All statuses</option>
  <option value="draft">Draft</option>
  <option value="finalized">Finalized</option>
</select>
```

- [ ] **Step 5: Add Finalize button to ReportPreviewModal**

In `web/src/components/ReportPreviewModal.tsx`, when the report status is `'draft'`, show a "Finalize" button in the toolbar alongside Download/Print:
```tsx
{report.status === 'draft' && (
  <button
    type="button"
    onClick={async () => {
      await api.reports.finalize(report.id)
      onFinalize?.()
    }}
    className="rounded-md bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-700"
  >
    Finalize
  </button>
)}
```

The modal props need an optional `onFinalize` callback that the parent passes to refresh the list.

- [ ] **Step 6: Commit**

```bash
git add web/src/types/index.ts web/src/lib/apiClient.ts web/src/components/ReportsTable.tsx web/src/components/ReportsFilterBar.tsx web/src/components/ReportPreviewModal.tsx
git commit -m "feat: add report status badges, filter, and finalize action to frontend"
```

---

## Task 8: Batch Schedule Creation — Backend

**Files:**
- Modify: `server/src/routes/schedule.ts`

- [ ] **Step 1: Add batch endpoint**

Add to `server/src/routes/schedule.ts`:

```ts
scheduleRouter.post('/classes/:classId/schedule/batch', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { classId } = req.params
    const { days_of_week, start_time, end_time, trainer_id, group_label, date_from, date_to } = req.body

    if (!Array.isArray(days_of_week) || days_of_week.length === 0 || !start_time || !end_time || !date_from || !date_to) {
      res.status(400).json({ error: 'days_of_week, start_time, end_time, date_from, date_to are required' })
      return
    }

    // Generate all matching dates
    const slots: Array<{
      class_id: string
      slot_date: string
      start_time: string
      end_time: string
      trainer_id: string | null
      group_label: string | null
    }> = []

    const start = new Date(date_from + 'T12:00:00')
    const end = new Date(date_to + 'T12:00:00')

    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      if (days_of_week.includes(d.getDay())) {
        slots.push({
          class_id: classId,
          slot_date: d.toISOString().split('T')[0],
          start_time,
          end_time,
          trainer_id: trainer_id || null,
          group_label: group_label || null,
        })
      }
    }

    if (slots.length === 0) {
      res.json({ created: 0 })
      return
    }

    // Check for existing slots to avoid duplicates
    const { data: existing } = await supabase
      .from('class_schedule_slots')
      .select('slot_date, start_time, group_label')
      .eq('class_id', classId)
      .in('slot_date', slots.map(s => s.slot_date))

    const existingSet = new Set(
      (existing ?? []).map(e => `${e.slot_date}|${e.start_time}|${e.group_label ?? ''}`)
    )

    const newSlots = slots.filter(
      s => !existingSet.has(`${s.slot_date}|${s.start_time}|${s.group_label ?? ''}`)
    )

    if (newSlots.length === 0) {
      res.json({ created: 0 })
      return
    }

    const { error } = await supabase
      .from('class_schedule_slots')
      .insert(newSlots)

    if (error) throw error
    res.status(201).json({ created: newSlots.length })
  } catch (err) {
    next(err)
  }
})
```

- [ ] **Step 2: Commit**

```bash
git add server/src/routes/schedule.ts
git commit -m "feat: add batch schedule slot creation endpoint"
```

---

## Task 9: Batch Schedule Creation — Frontend

**Files:**
- Modify: `web/src/lib/apiClient.ts`
- Modify: `web/src/pages/ClassDetail/ClassScheduleSection.tsx`

- [ ] **Step 1: Add batch API method**

In `web/src/lib/apiClient.ts`, add to the `schedule` section:
```ts
createBatch: (classId: string, body: {
  days_of_week: number[]
  start_time: string
  end_time: string
  trainer_id?: string | null
  group_label?: string | null
  date_from: string
  date_to: string
}) => req<{ created: number }>(`/classes/${classId}/schedule/batch`, {
  method: 'POST',
  body: JSON.stringify(body),
}),
```

- [ ] **Step 2: Add recurring schedule modal to ClassScheduleSection**

In `web/src/pages/ClassDetail/ClassScheduleSection.tsx`, add state for the recurring form:
```tsx
const [recurringOpen, setRecurringOpen] = useState(false)
const [recurDays, setRecurDays] = useState<number[]>([])
const [recurStartTime, setRecurStartTime] = useState('')
const [recurEndTime, setRecurEndTime] = useState('')
const [recurTrainerId, setRecurTrainerId] = useState('')
const [recurGroup, setRecurGroup] = useState('')
const [recurDateFrom, setRecurDateFrom] = useState('')
const [recurDateTo, setRecurDateTo] = useState('')
const [recurSaving, setRecurSaving] = useState(false)
```

Add the toggle button next to the existing "Add slot" button:
```tsx
<button
  type="button"
  onClick={() => setRecurringOpen(true)}
  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
>
  Create recurring
</button>
```

Add the modal JSX at the bottom of the component (before the closing `</>`):
```tsx
{recurringOpen && (
  <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4">
    <div className="w-full max-w-md rounded-xl bg-white shadow-xl p-5">
      <h3 className="text-sm font-semibold text-slate-900 mb-3">Create Recurring Slots</h3>
      <form
        onSubmit={async (e) => {
          e.preventDefault()
          if (recurDays.length === 0 || !recurStartTime || !recurEndTime || !recurDateFrom || !recurDateTo) return
          setRecurSaving(true)
          try {
            const result = await api.schedule.createBatch(classId, {
              days_of_week: recurDays,
              start_time: recurStartTime,
              end_time: recurEndTime,
              trainer_id: recurTrainerId || null,
              group_label: recurGroup.trim() || null,
              date_from: recurDateFrom,
              date_to: recurDateTo,
            })
            toast(`Created ${result.created} slots`, 'success')
            setRecurringOpen(false)
            setRecurDays([])
            setRecurStartTime('')
            setRecurEndTime('')
            setRecurTrainerId('')
            setRecurGroup('')
            setRecurDateFrom('')
            setRecurDateTo('')
            refreshSchedule()
          } catch (err) {
            toast((err as Error).message, 'error')
          } finally {
            setRecurSaving(false)
          }
        }}
        className="flex flex-col gap-3"
      >
        <div>
          <label className="text-xs font-medium text-slate-700 block mb-1">Days of week</label>
          <div className="flex flex-wrap gap-1.5">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day, i) => (
              <button
                key={day}
                type="button"
                onClick={() =>
                  setRecurDays(prev =>
                    prev.includes(i) ? prev.filter(d => d !== i) : [...prev, i]
                  )
                }
                className={`rounded-md px-2.5 py-1 text-xs font-medium border ${
                  recurDays.includes(i)
                    ? 'bg-gw-blue text-white border-gw-blue'
                    : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                }`}
              >
                {day}
              </button>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-medium text-slate-700 block mb-1">Start time</label>
            <input type="time" value={recurStartTime} onChange={e => setRecurStartTime(e.target.value)} className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm" required />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-700 block mb-1">End time</label>
            <input type="time" value={recurEndTime} onChange={e => setRecurEndTime(e.target.value)} className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm" required />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-medium text-slate-700 block mb-1">From date</label>
            <input type="date" value={recurDateFrom} onChange={e => setRecurDateFrom(e.target.value)} className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm" required />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-700 block mb-1">To date</label>
            <input type="date" value={recurDateTo} onChange={e => setRecurDateTo(e.target.value)} className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm" required />
          </div>
        </div>
        <div>
          <label className="text-xs font-medium text-slate-700 block mb-1">Trainer (optional)</label>
          <select value={recurTrainerId} onChange={e => setRecurTrainerId(e.target.value)} className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm">
            <option value="">No trainer</option>
            {trainers.map(t => (
              <option key={t.id} value={t.id}>{t.trainer_name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs font-medium text-slate-700 block mb-1">Group (optional)</label>
          <input type="text" value={recurGroup} onChange={e => setRecurGroup(e.target.value)} placeholder="e.g. A" className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm" />
        </div>
        <div className="flex justify-end gap-2 mt-1">
          <button type="button" onClick={() => setRecurringOpen(false)} className="rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50">Cancel</button>
          <button type="submit" disabled={recurSaving || recurDays.length === 0} className="rounded-md bg-gw-blue px-3 py-1.5 text-sm font-medium text-white hover:bg-gw-blue-hover disabled:opacity-60">
            {recurSaving ? 'Creating...' : 'Create slots'}
          </button>
        </div>
      </form>
    </div>
  </div>
)}
```

- [ ] **Step 3: Verify**

Navigate to a class detail Schedule tab. Click "Create recurring". Fill in Mon/Wed, 9:00-11:00, a date range. Confirm slots are created.

- [ ] **Step 4: Commit**

```bash
git add web/src/lib/apiClient.ts web/src/pages/ClassDetail/ClassScheduleSection.tsx
git commit -m "feat: add recurring schedule creation UI with day-of-week selection"
```

---

## Task 10: Batch Student Enrollment (CSV Import) — Backend

**Files:**
- Modify: `server/src/routes/enrollments.ts`

- [ ] **Step 1: Add batch endpoint**

Add to `server/src/routes/enrollments.ts`:

```ts
enrollmentsRouter.post('/classes/:classId/enrollments/batch', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { classId } = req.params
    const { students } = req.body as { students: Array<{ email: string; group_label?: string }> }

    if (!Array.isArray(students) || students.length === 0) {
      res.status(400).json({ error: 'students array is required' })
      return
    }

    const emails = students.map(s => s.email.toLowerCase().trim())

    // Resolve emails to profiles
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, email, full_name')
      .in('email', emails)

    const profileMap = new Map((profiles ?? []).map(p => [p.email.toLowerCase(), p]))

    // Check existing enrollments
    const { data: existing } = await supabase
      .from('class_enrollments')
      .select('student_email')
      .eq('class_id', classId)

    const existingEmails = new Set((existing ?? []).map(e => e.student_email.toLowerCase()))

    const enrolled: string[] = []
    const skipped: string[] = []
    const errors: Array<{ email: string; reason: string }> = []
    const toInsert: Array<{
      class_id: string
      student_name: string
      student_email: string
      status: string
      group_label: string | null
    }> = []

    for (const s of students) {
      const email = s.email.toLowerCase().trim()
      const profile = profileMap.get(email)

      if (!profile) {
        errors.push({ email, reason: 'Profile not found' })
        continue
      }
      if (existingEmails.has(email)) {
        skipped.push(email)
        continue
      }

      toInsert.push({
        class_id: classId,
        student_name: profile.full_name ?? email,
        student_email: email,
        status: 'enrolled',
        group_label: s.group_label?.trim() || null,
      })
      enrolled.push(email)
    }

    if (toInsert.length > 0) {
      const { error } = await supabase
        .from('class_enrollments')
        .insert(toInsert)
      if (error) throw error
    }

    res.status(201).json({
      enrolled: enrolled.length,
      skipped: skipped.length,
      errors,
    })
  } catch (err) {
    next(err)
  }
})
```

- [ ] **Step 2: Commit**

```bash
git add server/src/routes/enrollments.ts
git commit -m "feat: add batch enrollment endpoint for CSV import"
```

---

## Task 11: CSV Import — Frontend

**Files:**
- Modify: `web/src/lib/apiClient.ts`
- Modify: `web/src/pages/ClassDetail/ClassStudentsSection.tsx`

- [ ] **Step 1: Add batch enrollment API method**

In `web/src/lib/apiClient.ts`, add to the `enrollments` section:
```ts
createBatch: (classId: string, students: Array<{ email: string; group_label?: string }>) =>
  req<{ enrolled: number; skipped: number; errors: Array<{ email: string; reason: string }> }>(
    `/classes/${classId}/enrollments/batch`,
    { method: 'POST', body: JSON.stringify({ students }) },
  ),
```

- [ ] **Step 2: Add CSV import modal to ClassStudentsSection**

Add state:
```tsx
const [csvOpen, setCsvOpen] = useState(false)
const [csvRows, setCsvRows] = useState<Array<{ email: string; group_label?: string }>>([])
const [csvErrors, setCsvErrors] = useState<Array<{ email: string; reason: string }>>([])
const [csvSaving, setCsvSaving] = useState(false)
```

Add button next to enroll button:
```tsx
<button
  type="button"
  onClick={() => setCsvOpen(true)}
  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
>
  Import CSV
</button>
```

Add modal:
```tsx
{csvOpen && (
  <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4">
    <div className="w-full max-w-lg rounded-xl bg-white shadow-xl p-5 max-h-[80vh] overflow-y-auto">
      <h3 className="text-sm font-semibold text-slate-900 mb-3">Import Students from CSV</h3>
      <p className="text-xs text-slate-500 mb-3">CSV should have columns: <code>email</code> (required), <code>group</code> (optional)</p>
      <input
        type="file"
        accept=".csv"
        onChange={e => {
          const file = e.target.files?.[0]
          if (!file) return
          const reader = new FileReader()
          reader.onload = () => {
            const text = reader.result as string
            const lines = text.split('\n').map(l => l.trim()).filter(Boolean)
            if (lines.length < 2) { setCsvRows([]); return }
            const header = lines[0].toLowerCase().split(',').map(h => h.trim())
            const emailIdx = header.indexOf('email')
            const groupIdx = header.indexOf('group')
            if (emailIdx === -1) { toast('CSV must have an "email" column', 'error'); return }
            const rows = lines.slice(1).map(line => {
              const cols = line.split(',').map(c => c.trim().replace(/^"|"$/g, ''))
              return {
                email: cols[emailIdx] ?? '',
                group_label: groupIdx >= 0 ? cols[groupIdx] || undefined : undefined,
              }
            }).filter(r => r.email)
            setCsvRows(rows)
            setCsvErrors([])
          }
          reader.readAsText(file)
        }}
        className="mb-3 text-sm"
      />
      {csvRows.length > 0 && (
        <>
          <div className="rounded-lg border border-slate-200 overflow-hidden mb-3">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-slate-100 border-b border-slate-200">
                  <th className="px-3 py-2 text-left font-medium text-slate-600">Email</th>
                  <th className="px-3 py-2 text-left font-medium text-slate-600">Group</th>
                </tr>
              </thead>
              <tbody>
                {csvRows.slice(0, 20).map((row, i) => {
                  const err = csvErrors.find(e => e.email === row.email)
                  return (
                    <tr key={i} className={`border-b border-slate-100 ${err ? 'bg-rose-50' : ''}`}>
                      <td className="px-3 py-1.5 text-slate-700">{row.email}</td>
                      <td className="px-3 py-1.5 text-slate-500">{row.group_label ?? '—'}</td>
                    </tr>
                  )
                })}
                {csvRows.length > 20 && (
                  <tr><td colSpan={2} className="px-3 py-1.5 text-center text-slate-400">...and {csvRows.length - 20} more</td></tr>
                )}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-slate-600 mb-3">{csvRows.length} students found in CSV</p>
        </>
      )}
      {csvErrors.length > 0 && (
        <div className="mb-3 rounded-lg border border-rose-200 bg-rose-50 p-3">
          <p className="text-xs font-medium text-rose-700 mb-1">Errors:</p>
          {csvErrors.map((err, i) => (
            <p key={i} className="text-xs text-rose-600">{err.email}: {err.reason}</p>
          ))}
        </div>
      )}
      <div className="flex justify-end gap-2">
        <button type="button" onClick={() => { setCsvOpen(false); setCsvRows([]); setCsvErrors([]) }} className="rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50">Cancel</button>
        <button
          type="button"
          disabled={csvSaving || csvRows.length === 0}
          onClick={async () => {
            setCsvSaving(true)
            try {
              const result = await api.enrollments.createBatch(classId, csvRows)
              setCsvErrors(result.errors)
              if (result.enrolled > 0) {
                toast(`Enrolled ${result.enrolled} students${result.skipped > 0 ? `, ${result.skipped} skipped` : ''}`, 'success')
                refreshEnrollments()
              }
              if (result.errors.length === 0) {
                setCsvOpen(false)
                setCsvRows([])
              }
            } catch (err) {
              toast((err as Error).message, 'error')
            } finally {
              setCsvSaving(false)
            }
          }}
          className="rounded-md bg-gw-blue px-3 py-1.5 text-sm font-medium text-white hover:bg-gw-blue-hover disabled:opacity-60"
        >
          {csvSaving ? 'Importing...' : `Enroll ${csvRows.length} students`}
        </button>
      </div>
    </div>
  </div>
)}
```

- [ ] **Step 3: Commit**

```bash
git add web/src/lib/apiClient.ts web/src/pages/ClassDetail/ClassStudentsSection.tsx
git commit -m "feat: add CSV import modal for bulk student enrollment"
```

---

## Task 12: Bulk Archive/Delete for Classes — Backend

**Files:**
- Modify: `server/src/routes/classes.ts`

- [ ] **Step 1: Add batch endpoint**

Add to `server/src/routes/classes.ts`:

```ts
classesRouter.patch('/classes/batch', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { ids, action } = req.body as { ids: string[]; action: 'archive' | 'delete' }

    if (!Array.isArray(ids) || ids.length === 0 || !['archive', 'delete'].includes(action)) {
      res.status(400).json({ error: 'ids (array) and action (archive|delete) are required' })
      return
    }

    if (action === 'archive') {
      const { error } = await supabase
        .from('classes')
        .update({ archived: true })
        .in('id', ids)
      if (error) throw error
    } else {
      const { error } = await supabase
        .from('classes')
        .delete()
        .in('id', ids)
      if (error) throw error
    }

    res.json({ updated: ids.length })
  } catch (err) {
    next(err)
  }
})
```

**Important:** This route must be registered **before** the `/classes/:classId` route to avoid `batch` being parsed as a classId parameter.

- [ ] **Step 2: Commit**

```bash
git add server/src/routes/classes.ts
git commit -m "feat: add batch archive/delete endpoint for classes"
```

---

## Task 13: Bulk Archive/Delete — Frontend

**Files:**
- Modify: `web/src/lib/apiClient.ts`
- Modify: `web/src/pages/ClassesPage.tsx`

- [ ] **Step 1: Add batch API method**

In `web/src/lib/apiClient.ts`, add to the `classes` section:
```ts
batch: (ids: string[], action: 'archive' | 'delete') =>
  req<{ updated: number }>('/classes/batch', {
    method: 'PATCH',
    body: JSON.stringify({ ids, action }),
  }),
```

- [ ] **Step 2: Add checkbox selection to ClassesPage**

Add state:
```tsx
const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
```

Add a checkbox column as the first column in the active classes table header:
```tsx
<th className="px-3 py-3 w-8">
  <input
    type="checkbox"
    checked={selectedIds.size > 0 && selectedIds.size === active.length}
    onChange={e => {
      if (e.target.checked) setSelectedIds(new Set(active.map(c => c.id)))
      else setSelectedIds(new Set())
    }}
    className="rounded border-slate-300"
  />
</th>
```

Add checkbox cell in each row:
```tsx
<td className="px-3 py-3" onClick={e => e.stopPropagation()}>
  <input
    type="checkbox"
    checked={selectedIds.has(cls.id)}
    onChange={e => {
      const next = new Set(selectedIds)
      if (e.target.checked) next.add(cls.id)
      else next.delete(cls.id)
      setSelectedIds(next)
    }}
    className="rounded border-slate-300"
  />
</td>
```

- [ ] **Step 3: Add floating action bar**

Add at the bottom of the component, before the closing fragment:
```tsx
{selectedIds.size > 0 && (
  <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-30 flex items-center gap-3 rounded-xl bg-slate-900 text-white px-5 py-3 shadow-lg">
    <span className="text-sm font-medium">{selectedIds.size} selected</span>
    <button
      type="button"
      onClick={async () => {
        if (!confirm(`Archive ${selectedIds.size} class(es)?`)) return
        await api.classes.batch([...selectedIds], 'archive')
        toast(`Archived ${selectedIds.size} classes`, 'success')
        setSelectedIds(new Set())
        refresh()
      }}
      className="rounded-md bg-amber-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-amber-600"
    >
      Archive
    </button>
    <button
      type="button"
      onClick={async () => {
        if (!confirm(`Delete ${selectedIds.size} class(es)? This cannot be undone.`)) return
        await api.classes.batch([...selectedIds], 'delete')
        toast(`Deleted ${selectedIds.size} classes`, 'success')
        setSelectedIds(new Set())
        refresh()
      }}
      className="rounded-md bg-rose-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-rose-600"
    >
      Delete
    </button>
  </div>
)}
```

- [ ] **Step 4: Commit**

```bash
git add web/src/lib/apiClient.ts web/src/pages/ClassesPage.tsx
git commit -m "feat: add bulk archive/delete with checkbox selection on classes page"
```

---

## Task 14: Roster Export

**Files:**
- Modify: `web/src/pages/RosterPage.tsx`

- [ ] **Step 1: Add CSV export button and logic**

In `RosterPage.tsx`, add a function to generate and download CSV:

```tsx
function exportCsv() {
  const header = 'Full Name,Email\n'
  const body = profiles.map(p => `"${p.full_name ?? ''}","${p.email}"`).join('\n')
  const blob = new Blob([header + body], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${title.toLowerCase()}-roster.csv`
  a.click()
  URL.revokeObjectURL(url)
}
```

Add the export button in the header next to the search input:
```tsx
<button
  type="button"
  onClick={exportCsv}
  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
>
  Export CSV
</button>
```

- [ ] **Step 2: Commit**

```bash
git add web/src/pages/RosterPage.tsx
git commit -m "feat: add CSV export to roster pages"
```

---

## Task 15: Attendance Rate Badges on Classes — Backend

**Files:**
- Modify: `server/src/routes/classes.ts`

- [ ] **Step 1: Add attendance_rate to class list response**

In `server/src/routes/classes.ts`, modify the GET `/classes` handler. After fetching classes, compute attendance rate per class:

After `res.json(data)`, replace with:

```ts
// Fetch attendance data for all classes
const classIds = (data ?? []).map((c: { id: string }) => c.id)
let attendanceMap = new Map<string, number | null>()

if (classIds.length > 0) {
  // Get all report IDs for these classes
  const { data: reports } = await supabase
    .from('class_daily_reports')
    .select('id, class_id')
    .in('class_id', classIds)

  if (reports && reports.length > 0) {
    const reportIds = reports.map(r => r.id)
    const reportClassMap = new Map(reports.map(r => [r.id, r.class_id]))

    const { data: progress } = await supabase
      .from('class_daily_report_trainee_progress')
      .select('report_id, attendance')
      .in('report_id', reportIds)

    // Group by class
    const classAttendance = new Map<string, { attended: number; total: number }>()
    for (const p of progress ?? []) {
      const classId = reportClassMap.get(p.report_id)
      if (!classId) continue
      if (!classAttendance.has(classId)) classAttendance.set(classId, { attended: 0, total: 0 })
      const agg = classAttendance.get(classId)!
      agg.total++
      if (p.attendance) agg.attended++
    }

    for (const [cid, agg] of classAttendance) {
      attendanceMap.set(cid, agg.total > 0 ? Math.round((agg.attended / agg.total) * 100) : null)
    }
  }
}

const enriched = (data ?? []).map((c: { id: string }) => ({
  ...c,
  attendance_rate: attendanceMap.get(c.id) ?? null,
}))

res.json(enriched)
```

- [ ] **Step 2: Commit**

```bash
git add server/src/routes/classes.ts
git commit -m "feat: add attendance_rate to class list API response"
```

---

## Task 16: Attendance Badges + Sortable Columns on Classes Page

**Files:**
- Modify: `web/src/types/index.ts`
- Modify: `web/src/pages/ClassesPage.tsx`

- [ ] **Step 1: Add attendance_rate to Class type**

In `web/src/types/index.ts`, add to the `Class` type:
```ts
attendance_rate: number | null
```

- [ ] **Step 2: Add attendance badge and sortable columns to ClassesPage**

Add sort state:
```tsx
const [sortKey, setSortKey] = useState<string>('start_date')
const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')

function toggleSort(key: string) {
  if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
  else { setSortKey(key); setSortDir('asc') }
}

const sortIndicator = (key: string) => sortKey === key ? (sortDir === 'asc' ? ' ▲' : ' ▼') : ''
```

Sort the filtered active classes:
```tsx
const sortedActive = useMemo(() => {
  const sorted = [...filteredActive]
  sorted.sort((a, b) => {
    let cmp = 0
    if (sortKey === 'name') cmp = a.name.localeCompare(b.name)
    else if (sortKey === 'site') cmp = a.site.localeCompare(b.site)
    else if (sortKey === 'province') cmp = a.province.localeCompare(b.province)
    else if (sortKey === 'start_date') cmp = a.start_date.localeCompare(b.start_date)
    else if (sortKey === 'attendance_rate') cmp = (a.attendance_rate ?? -1) - (b.attendance_rate ?? -1)
    return sortDir === 'desc' ? -cmp : cmp
  })
  return sorted
}, [filteredActive, sortKey, sortDir])
```

Make table headers clickable:
```tsx
<th className="px-3 py-3 cursor-pointer" onClick={() => toggleSort('name')}>
  Name{sortIndicator('name')}
</th>
```

Add an Attendance column header:
```tsx
<th className="px-3 py-3 cursor-pointer text-center hidden md:table-cell" onClick={() => toggleSort('attendance_rate')}>
  Attendance{sortIndicator('attendance_rate')}
</th>
```

Add attendance badge cell in each row:
```tsx
<td className="px-3 py-3 text-center hidden md:table-cell">
  {cls.attendance_rate != null ? (
    <span className={`inline-block text-[10px] font-medium px-1.5 py-0.5 rounded ${
      cls.attendance_rate >= 90 ? 'bg-emerald-100 text-emerald-700' :
      cls.attendance_rate >= 75 ? 'bg-amber-100 text-amber-700' :
      'bg-rose-100 text-rose-700'
    }`}>
      {cls.attendance_rate}%
    </span>
  ) : (
    <span className="text-slate-400">—</span>
  )}
</td>
```

- [ ] **Step 3: Commit**

```bash
git add web/src/types/index.ts web/src/pages/ClassesPage.tsx
git commit -m "feat: add attendance badges and sortable columns to classes page"
```

---

## Task 17: Class Completion Progress Bar

**Files:**
- Modify: `web/src/pages/ClassDetail/ClassOverviewSection.tsx`

- [ ] **Step 1: Add progress bar to overview**

At the top of the overview section (after the class name/info header), add:

```tsx
{startDate && endDate && (
  <div className="rounded-xl bg-white p-4 shadow-sm">
    <div className="flex items-center justify-between mb-1.5">
      <span className="text-xs font-medium text-slate-700">Class Progress</span>
      <span className="text-xs text-slate-500">
        {(() => {
          const start = new Date(startDate + 'T00:00:00').getTime()
          const end = new Date(endDate + 'T00:00:00').getTime()
          const now = Date.now()
          const totalDays = Math.max(1, Math.round((end - start) / 86400000))
          const elapsedDays = Math.min(totalDays, Math.max(0, Math.round((now - start) / 86400000)))
          const pct = Math.min(100, Math.max(0, Math.round((elapsedDays / totalDays) * 100)))
          return `Day ${elapsedDays} of ${totalDays} (${pct}%)`
        })()}
      </span>
    </div>
    <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
      <div
        className="h-full bg-gw-blue rounded-full transition-all"
        style={{
          width: `${Math.min(100, Math.max(0, Math.round(
            ((Date.now() - new Date(startDate + 'T00:00:00').getTime()) /
              (new Date(endDate + 'T00:00:00').getTime() - new Date(startDate + 'T00:00:00').getTime())) * 100
          )))}%`,
        }}
      />
    </div>
  </div>
)}
```

Where `startDate` and `endDate` come from the class data already available in this component.

- [ ] **Step 2: Commit**

```bash
git add web/src/pages/ClassDetail/ClassOverviewSection.tsx
git commit -m "feat: add class completion progress bar to overview tab"
```

---

## Task 18: Student Progress Sparklines

**Files:**
- Modify: `web/src/pages/StudentProgressPage.tsx`

- [ ] **Step 1: Add sparkline trends section**

After the progress ratings table, add a Trends section:

```tsx
{progress.length > 0 && (
  <section>
    <h3 className="text-sm font-semibold text-slate-800 mb-2">Rating Trends</h3>
    <div className="rounded-xl border border-slate-200 bg-white p-4 flex flex-col gap-3">
      {(['gk_rating', 'dex_rating', 'hom_rating'] as const).map(key => {
        const label = key === 'gk_rating' ? 'GK' : key === 'dex_rating' ? 'DEX' : 'HOM'
        const dots = progress.map(p => p[key] as string | null)
        const colorMap: Record<string, string> = {
          EE: 'bg-emerald-400',
          ME: 'bg-blue-400',
          AD: 'bg-amber-400',
          NI: 'bg-rose-400',
        }
        return (
          <div key={key} className="flex items-center gap-3">
            <span className="text-xs font-medium text-slate-600 w-8">{label}</span>
            <div className="flex items-center gap-1 flex-wrap">
              {dots.map((rating, i) => (
                <div
                  key={i}
                  className={`w-3 h-3 rounded-full ${rating ? colorMap[rating] ?? 'bg-slate-300' : 'bg-slate-200'}`}
                  title={`${progress[i].report_date}: ${rating ?? 'N/A'}`}
                />
              ))}
            </div>
          </div>
        )
      })}
      <div className="flex items-center gap-3 mt-1 text-[10px] text-slate-500">
        <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-emerald-400 inline-block" /> EE</span>
        <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-blue-400 inline-block" /> ME</span>
        <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-amber-400 inline-block" /> AD</span>
        <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-rose-400 inline-block" /> NI</span>
      </div>
    </div>
  </section>
)}
```

- [ ] **Step 2: Commit**

```bash
git add web/src/pages/StudentProgressPage.tsx
git commit -m "feat: add rating trend sparklines to student progress page"
```

---

## Task 19: Collapsible Filter Bars

**Files:**
- Modify: `web/src/components/ReportsFilterBar.tsx`
- Modify: `web/src/components/ScheduleFilterBar.tsx`
- Modify: `web/src/components/PayrollFilterBar.tsx`

- [ ] **Step 1: Wrap ReportsFilterBar in CollapsibleSection**

Import `CollapsibleSection` and wrap the existing filter content. Generate a summary string from active filters:

```tsx
import { CollapsibleSection } from './CollapsibleSection'

// At the top of the component, compute summary:
const summaryParts: string[] = []
if (filters.province) summaryParts.push(filters.province)
if (filters.site) summaryParts.push(filters.site)
if (filters.class_id) summaryParts.push('Class filtered')
if (filters.date_from || filters.date_to) summaryParts.push(`${filters.date_from ?? '...'} to ${filters.date_to ?? '...'}`)
if (filters.search) summaryParts.push(`"${filters.search}"`)
const summary = summaryParts.length > 0 ? `Filters: ${summaryParts.join(', ')}` : undefined

// Wrap the existing JSX:
return (
  <CollapsibleSection title="Filters" summary={summary} defaultOpen={true} mobileDefaultOpen={false}>
    {/* existing filter bar content */}
  </CollapsibleSection>
)
```

- [ ] **Step 2: Wrap ScheduleFilterBar the same way**

Same pattern: import CollapsibleSection, compute summary from active schedule filters, wrap content.

- [ ] **Step 3: Wrap PayrollFilterBar the same way**

Same pattern for payroll filters.

- [ ] **Step 4: Commit**

```bash
git add web/src/components/ReportsFilterBar.tsx web/src/components/ScheduleFilterBar.tsx web/src/components/PayrollFilterBar.tsx
git commit -m "feat: wrap filter bars in collapsible sections (collapsed on mobile)"
```

---

## Task 20: Sortable Columns on Roster Page

**Files:**
- Modify: `web/src/pages/RosterPage.tsx`

- [ ] **Step 1: Add sort state and logic**

```tsx
const [sortKey, setSortKey] = useState<'name' | 'email'>('name')
const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')

function toggleSort(key: 'name' | 'email') {
  if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
  else { setSortKey(key); setSortDir('asc') }
}

const sortIndicator = (key: string) => sortKey === key ? (sortDir === 'asc' ? ' ▲' : ' ▼') : ''

const sorted = useMemo(() => {
  return [...profiles].sort((a, b) => {
    let cmp = 0
    if (sortKey === 'name') cmp = (a.full_name ?? '').localeCompare(b.full_name ?? '')
    else cmp = a.email.localeCompare(b.email)
    return sortDir === 'desc' ? -cmp : cmp
  })
}, [profiles, sortKey, sortDir])
```

Make header columns clickable:
```tsx
<th className="px-4 py-3 cursor-pointer" onClick={() => toggleSort('name')}>
  Name{sortIndicator('name')}
</th>
<th className="px-4 py-3 cursor-pointer hidden sm:table-cell" onClick={() => toggleSort('email')}>
  Email{sortIndicator('email')}
</th>
```

Render `sorted` instead of `profiles` in the table body.

- [ ] **Step 2: Commit**

```bash
git add web/src/pages/RosterPage.tsx
git commit -m "feat: add sortable columns to roster pages"
```

---

## Task 21: Toast Confirmations for Destructive Actions

**Files:**
- Modify: `web/src/pages/ClassDetail/ClassScheduleSection.tsx`
- Modify: `web/src/pages/ClassDetail/ClassDrillsSection.tsx`
- Modify: `web/src/pages/ClassDetail/ClassTrainersSection.tsx`
- Modify: `web/src/pages/ClassDetail/ClassStudentsSection.tsx`
- Modify: `web/src/pages/ClassesPage.tsx`

- [ ] **Step 1: Add toast calls to all destructive actions**

In each file, ensure `useToast` is imported and `toast` is called after successful destructive operations:

- **ClassScheduleSection**: After `api.schedule.delete()` succeeds → `toast('Schedule slot removed', 'success')`
- **ClassDrillsSection**: After `api.drills.delete()` succeeds → `toast('Drill removed', 'success')`
- **ClassTrainersSection**: After `api.trainers.delete()` succeeds → `toast('Trainer removed', 'success')`
- **ClassStudentsSection**: After `api.enrollments.delete()` succeeds → `toast('Student unenrolled', 'success')`
- **ClassesPage**: After archive/unarchive/delete → `toast('Class archived', 'success')` (or appropriate message)

Also add error toasts in catch blocks where missing:
```tsx
catch (err) {
  toast((err as Error).message, 'error')
}
```

- [ ] **Step 2: Commit**

```bash
git add web/src/pages/ClassDetail/ClassScheduleSection.tsx web/src/pages/ClassDetail/ClassDrillsSection.tsx web/src/pages/ClassDetail/ClassTrainersSection.tsx web/src/pages/ClassDetail/ClassStudentsSection.tsx web/src/pages/ClassesPage.tsx
git commit -m "feat: add toast confirmations for all destructive actions"
```

---

## Task 22: Replace Ad-Hoc Empty States with EmptyState Component

**Files:**
- Modify: Multiple pages (ClassesPage, RosterPage, SchedulePage, ReportsPage, TrainerDashboard, TraineeDashboard, class detail sub-tabs)

- [ ] **Step 1: Find and replace all ad-hoc empty states**

Search for the pattern `border-dashed` across the web/src directory. Replace each instance with the `EmptyState` component.

For example, in `TrainerDashboard.tsx`, replace:
```tsx
<div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-10 text-center">
  <p className="text-sm text-slate-600">You are not currently assigned to any classes.</p>
</div>
```

With:
```tsx
<EmptyState title="You are not currently assigned to any classes." />
```

Import `EmptyState` from `'../components/EmptyState'` in each file.

Do this for all pages that have ad-hoc empty state markup. Add action buttons where appropriate (e.g., on ClassesPage: "Create class" button).

- [ ] **Step 2: Commit**

```bash
git add web/src/pages/*.tsx web/src/pages/ClassDetail/*.tsx
git commit -m "feat: replace ad-hoc empty states with consistent EmptyState component"
```

---

## Task 23: Collapsible Report Form Sections

**Files:**
- Modify: `web/src/pages/ClassDetail/ClassReportsSection.tsx`

- [ ] **Step 1: Wrap report form sections in CollapsibleSection**

Import `CollapsibleSection` and wrap the four sections of the report form:

1. **Session Info** — date, session label, class times, game, group, MG counts, trainers, timeline items
2. **Attendance** — student attendance checkboxes
3. **Ratings** — GK/DEX/HOM ratings per student
4. **Drills** — drill times/scores per student

Each section gets a `CollapsibleSection` wrapper with a descriptive title and completion summary. For example:

```tsx
<CollapsibleSection
  title="Session Info"
  summary={reportDate ? `${reportDate}${reportSessionLabel ? ` — ${reportSessionLabel}` : ''}` : undefined}
  defaultOpen={true}
>
  {/* existing session info fields */}
</CollapsibleSection>

<CollapsibleSection
  title="Attendance"
  summary={`${progressRows.filter(r => r.attendance).length}/${progressRows.length} present`}
  defaultOpen={false}
>
  {/* existing attendance checkboxes */}
</CollapsibleSection>

<CollapsibleSection
  title="Ratings"
  summary={`${progressRows.filter(r => r.gk_rating || r.dex_rating || r.hom_rating).length}/${progressRows.length} rated`}
  defaultOpen={false}
>
  {/* existing ratings grid */}
</CollapsibleSection>

<CollapsibleSection
  title="Drills & Tests"
  summary={drillTimeRows.length > 0 ? `${drillTimeRows.length} entries` : undefined}
  defaultOpen={false}
>
  {/* existing drill time inputs */}
</CollapsibleSection>
```

- [ ] **Step 2: Verify**

Open a class detail page, navigate to Reports tab, open the report form. Verify sections collapse/expand. Fill in Session Info, collapse it, verify summary shows.

- [ ] **Step 3: Commit**

```bash
git add web/src/pages/ClassDetail/ClassReportsSection.tsx
git commit -m "feat: break report form into collapsible sections for better mobile UX"
```

---

## Task 24: Final Verification

- [ ] **Step 1: Full app walkthrough**

Test the following flows in the browser:
1. **Dashboard**: 6 cards load with data, alerts show correctly, coming-up section shows next 5 days, activity feed populates, classes ending soon appears if applicable
2. **Sidebar**: Sign out button visible and functional
3. **Classes page**: Checkboxes work, bulk archive/delete floating bar appears, attendance badges show, columns are sortable
4. **Class detail — Schedule**: "Create recurring" modal works, creates slots
5. **Class detail — Students**: "Import CSV" modal works, validates emails
6. **Class detail — Reports**: Form sections collapse/expand, status badge shows
7. **Class detail — Overview**: Completion progress bar shows
8. **Reports page**: Status filter works, finalize button works in preview
9. **Roster pages**: Sort columns work, CSV export downloads
10. **Student Progress**: Sparkline dots render below ratings table
11. **Filter bars**: Collapse on mobile, show summary text
12. **Toast notifications**: All destructive actions show toasts
13. **Empty states**: Consistent styling across all pages

- [ ] **Step 2: Commit any fixes**

```bash
git add -A
git commit -m "fix: address issues found during final verification"
```
