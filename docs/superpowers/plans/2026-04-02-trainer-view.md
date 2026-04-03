# Trainer View Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a full trainer experience with sidebar navigation, class-scoped CRUD for reports/hours/drills, and cross-class overview pages.

**Architecture:** Extend the existing self-service route pattern (`/me/*`) with a `validateTrainerAccess()` helper that checks `class_trainers` assignment on every class-scoped request. Frontend gets a `TrainerLayout` sidebar (mirroring `CoordinatorLayout`), trainer-only routes guarded by `TrainerRoute`, and new pages/contexts for trainer data.

**Tech Stack:** React 18, React Router v6, TypeScript, Tailwind CSS, Express, Supabase (PostgreSQL)

**Spec:** `docs/superpowers/specs/2026-04-02-trainer-view-design.md`

---

## File Structure

### Backend (all in `server/src/routes/selfService.ts`)

All new trainer endpoints are added to the existing `selfService.ts` file. No new backend files are created — the self-service router is already mounted before `requireCoordinator` in `routes/index.ts:52`, so trainer endpoints automatically bypass the coordinator gate.

### Frontend — New Files

| File | Responsibility |
|------|---------------|
| `web/src/components/TrainerLayout.tsx` | Trainer sidebar nav (desktop icon rail, mirrors CoordinatorLayout) |
| `web/src/layouts/TrainerRoute.tsx` | Route guard: redirects non-trainers to /dashboard |
| `web/src/contexts/TrainerContext.tsx` | Caches trainer's class list across pages |
| `web/src/contexts/TrainerClassDetailContext.tsx` | Caches all data for one trainer class (reports, hours, drills, etc.) |
| `web/src/pages/MyClassesPage.tsx` | Grid of trainer's assigned classes |
| `web/src/pages/TrainerClassDetailPage.tsx` | Tabbed class detail (Overview, Students, Schedule, Drills, Reports, Hours) |
| `web/src/pages/TrainerClassDetail/TrainerOverviewSection.tsx` | Read-only class overview |
| `web/src/pages/TrainerClassDetail/TrainerStudentsSection.tsx` | Read-only enrolled students list |
| `web/src/pages/TrainerClassDetail/TrainerScheduleSection.tsx` | Read-only schedule table |
| `web/src/pages/TrainerClassDetail/TrainerDrillsSection.tsx` | Drill CRUD (create, edit, delete, toggle active) |
| `web/src/pages/TrainerClassDetail/TrainerReportsSection.tsx` | Report list + create/edit form with progress + drill times |
| `web/src/pages/TrainerClassDetail/TrainerHoursSection.tsx` | Hours CRUD (own hours + student hours, individual + bulk) |
| `web/src/pages/TrainerReportsPage.tsx` | Cross-class reports list with filters |
| `web/src/pages/TrainerSchedulePage.tsx` | Cross-class schedule list with filters |
| `web/src/pages/TrainerHoursPage.tsx` | Cross-class personal hours summary |

### Frontend — Modified Files

| File | Change |
|------|--------|
| `web/src/types/index.ts` | Add trainer-specific response types |
| `web/src/lib/apiClient.ts` | Add `api.trainerSelfService.*` methods |
| `web/src/layouts/ProtectedLayout.tsx` | Add `role === 'trainer'` branch with TrainerLayout + mobile nav |
| `web/src/App.tsx` | Add trainer routes wrapped in TrainerRoute |
| `web/src/pages/DashboardView.tsx` | May need update if it gates trainer dashboard differently |

---

## Task 1: Backend — validateTrainerAccess helper + GET /me/my-classes

**Files:**
- Modify: `server/src/routes/selfService.ts:1-122`

- [ ] **Step 1: Add the validateTrainerAccess helper function**

Add this helper at the top of `selfService.ts`, after the imports and before the first route:

```typescript
/**
 * Validates that the given email belongs to a trainer assigned to the given class.
 * Returns the class_trainers row on success.
 * Throws a 403-style error if the trainer is not assigned.
 */
async function validateTrainerAccess(email: string, classId: string) {
  const { data, error } = await supabase
    .from('class_trainers')
    .select('id, class_id, trainer_name, trainer_email, role')
    .eq('trainer_email', email)
    .eq('class_id', classId)
    .single()
  if (error || !data) {
    const err = new Error('You are not assigned to this class') as Error & { status: number }
    err.status = 403
    throw err
  }
  return data as { id: string; class_id: string; trainer_name: string; trainer_email: string; role: string }
}
```

- [ ] **Step 2: Replace GET /me/trainer-dashboard with enhanced GET /me/my-classes**

Replace the existing `GET /me/trainer-dashboard` route (lines 28-122) with a new `GET /me/my-classes` endpoint that returns richer data. Keep the old endpoint as an alias for backwards compatibility:

```typescript
/**
 * GET /me/my-classes
 * Auth: any authenticated user (trainers use this)
 *
 * Returns all classes the trainer is assigned to with metadata, enrollment counts,
 * upcoming schedule slots, draft report count, and recent hours.
 */
selfServiceRouter.get('/me/my-classes', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const email = req.userEmail
    if (!email) {
      res.status(401).json({ error: 'No email associated with this account' })
      return
    }

    const { data: trainerRows, error: trainerError } = await supabase
      .from('class_trainers')
      .select('id, class_id, trainer_name, role')
      .eq('trainer_email', email)
    if (trainerError) throw trainerError
    if (!trainerRows || trainerRows.length === 0) {
      res.json({ trainer_name: null, trainer_email: email, classes: [] })
      return
    }

    const classIds = [...new Set(trainerRows.map((t: { class_id: string }) => t.class_id))]
    const trainerIds = trainerRows.map((t: { id: string }) => t.id)
    const today = new Date().toISOString().slice(0, 10)

    const [classesResult, enrollCountResult, scheduleResult, draftCountResult, hoursResult] = await Promise.all([
      supabase
        .from('classes')
        .select('id, name, site, province, game_type, start_date, end_date, archived')
        .in('id', classIds),
      supabase
        .from('class_enrollments')
        .select('class_id')
        .in('class_id', classIds)
        .eq('status', 'enrolled'),
      supabase
        .from('class_schedule_slots')
        .select('id, class_id, slot_date, start_time, end_time, group_label, notes')
        .in('class_id', classIds)
        .gte('slot_date', today)
        .order('slot_date', { ascending: true })
        .order('start_time', { ascending: true })
        .limit(50),
      supabase
        .from('class_daily_reports')
        .select('class_id')
        .in('class_id', classIds)
        .eq('status', 'draft'),
      supabase
        .from('class_logged_hours')
        .select('class_id, hours')
        .in('class_id', classIds)
        .eq('person_type', 'trainer')
        .in('trainer_id', trainerIds),
    ])

    if (classesResult.error) throw classesResult.error
    if (enrollCountResult.error) throw enrollCountResult.error
    if (scheduleResult.error) throw scheduleResult.error
    if (draftCountResult.error) throw draftCountResult.error
    if (hoursResult.error) throw hoursResult.error

    const enrollCountMap = new Map<string, number>()
    for (const row of enrollCountResult.data ?? []) {
      const r = row as { class_id: string }
      enrollCountMap.set(r.class_id, (enrollCountMap.get(r.class_id) ?? 0) + 1)
    }

    const slotsMap = new Map<string, typeof scheduleResult.data>()
    for (const slot of scheduleResult.data ?? []) {
      const s = slot as { class_id: string }
      const existing = slotsMap.get(s.class_id) ?? []
      if (existing.length < 3) slotsMap.set(s.class_id, [...existing, slot])
    }

    const draftCountMap = new Map<string, number>()
    for (const row of draftCountResult.data ?? []) {
      const r = row as { class_id: string }
      draftCountMap.set(r.class_id, (draftCountMap.get(r.class_id) ?? 0) + 1)
    }

    const hoursMap = new Map<string, number>()
    for (const row of hoursResult.data ?? []) {
      const r = row as { class_id: string; hours: number }
      hoursMap.set(r.class_id, (hoursMap.get(r.class_id) ?? 0) + r.hours)
    }

    const classMap = new Map<string, (typeof classesResult.data)[0]>()
    for (const c of classesResult.data ?? []) classMap.set(c.id, c)

    const classes = trainerRows.map((t: { id: string; class_id: string; trainer_name: string; role: string }) => {
      const cls = classMap.get(t.class_id)
      return {
        class_id: t.class_id,
        trainer_id: t.id,
        class_name: cls?.name ?? 'Unknown',
        site: cls?.site ?? '',
        province: cls?.province ?? '',
        game_type: cls?.game_type ?? null,
        start_date: cls?.start_date ?? null,
        end_date: cls?.end_date ?? null,
        archived: cls?.archived ?? false,
        trainer_role: t.role,
        enrolled_count: enrollCountMap.get(t.class_id) ?? 0,
        draft_report_count: draftCountMap.get(t.class_id) ?? 0,
        total_hours: hoursMap.get(t.class_id) ?? 0,
        upcoming_slots: slotsMap.get(t.class_id) ?? [],
      }
    })

    res.json({
      trainer_name: trainerRows[0].trainer_name,
      trainer_email: email,
      classes,
    })
  } catch (err) {
    next(err)
  }
})

// Backwards compatibility alias
selfServiceRouter.get('/me/trainer-dashboard', async (req: Request, res: Response, next: NextFunction) => {
  req.url = '/me/my-classes'
  selfServiceRouter.handle(req, res, next)
})
```

- [ ] **Step 3: Verify the server compiles**

Run: `cd /home/gtse8/GatewayTrainingTool/server && npx tsc --noEmit`
Expected: No type errors

- [ ] **Step 4: Commit**

```bash
git add server/src/routes/selfService.ts
git commit -m "feat(trainer): add validateTrainerAccess helper and GET /me/my-classes endpoint"
```

---

## Task 2: Backend — Class detail + read endpoints

**Files:**
- Modify: `server/src/routes/selfService.ts`

- [ ] **Step 1: Add GET /me/my-classes/:classId**

```typescript
/**
 * GET /me/my-classes/:classId
 * Auth: trainer assigned to class
 *
 * Returns class metadata, trainer's role, enrolled students, and drills.
 */
selfServiceRouter.get('/me/my-classes/:classId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const trainerRow = await validateTrainerAccess(req.userEmail!, req.params.classId)

    const [classResult, enrollResult, drillsResult] = await Promise.all([
      supabase.from('classes').select('*').eq('id', req.params.classId).single(),
      supabase.from('class_enrollments').select('*').eq('class_id', req.params.classId).order('student_name'),
      supabase.from('class_drills').select('*').eq('class_id', req.params.classId).order('created_at', { ascending: false }),
    ])

    if (classResult.error) throw classResult.error
    if (enrollResult.error) throw enrollResult.error
    if (drillsResult.error) throw drillsResult.error

    res.json({
      ...classResult.data,
      trainer_role: trainerRow.role,
      trainer_id: trainerRow.id,
      enrollments: enrollResult.data ?? [],
      drills: drillsResult.data ?? [],
    })
  } catch (err) {
    if ((err as Error & { status?: number }).status === 403) {
      res.status(403).json({ error: (err as Error).message })
      return
    }
    next(err)
  }
})
```

- [ ] **Step 2: Add GET /me/my-classes/:classId/reports (list)**

```typescript
/**
 * GET /me/my-classes/:classId/reports
 * Auth: trainer assigned to class
 * Returns all daily reports for this class, sorted by date desc.
 */
selfServiceRouter.get('/me/my-classes/:classId/reports', async (req: Request, res: Response, next: NextFunction) => {
  try {
    await validateTrainerAccess(req.userEmail!, req.params.classId)

    const { data, error } = await supabase
      .from('class_daily_reports')
      .select('*')
      .eq('class_id', req.params.classId)
      .order('report_date', { ascending: false })
    if (error) throw error
    res.json(data)
  } catch (err) {
    if ((err as Error & { status?: number }).status === 403) {
      res.status(403).json({ error: (err as Error).message })
      return
    }
    next(err)
  }
})
```

- [ ] **Step 3: Add GET /me/my-classes/:classId/reports/:reportId (detail)**

```typescript
/**
 * GET /me/my-classes/:classId/reports/:reportId
 * Auth: trainer assigned to class
 * Returns full report with nested trainer_ids, timeline, progress, drill_times.
 */
selfServiceRouter.get('/me/my-classes/:classId/reports/:reportId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    await validateTrainerAccess(req.userEmail!, req.params.classId)

    const reportId = req.params.reportId
    const [
      { data: report, error: reportError },
      { data: trainerLinks },
      { data: timeline },
      { data: progress },
      { data: drillTimes, error: drillTimesError },
    ] = await Promise.all([
      supabase.from('class_daily_reports').select('*').eq('id', reportId).eq('class_id', req.params.classId).single(),
      supabase.from('class_daily_report_trainers').select('trainer_id').eq('report_id', reportId),
      supabase
        .from('class_daily_report_timeline_items')
        .select('*')
        .eq('report_id', reportId)
        .order('position', { ascending: true })
        .order('start_time', { ascending: true }),
      supabase.from('class_daily_report_trainee_progress').select('*').eq('report_id', reportId),
      supabase.from('class_daily_report_drill_times').select('*').eq('report_id', reportId),
    ])

    if (reportError) {
      if (reportError.code === 'PGRST116') {
        res.status(404).json({ error: 'Report not found' })
        return
      }
      throw reportError
    }
    if (drillTimesError) throw drillTimesError

    res.json({
      ...report,
      trainer_ids: (trainerLinks ?? []).map((t: { trainer_id: string }) => t.trainer_id),
      timeline: timeline ?? [],
      progress: progress ?? [],
      drill_times: drillTimes ?? [],
    })
  } catch (err) {
    if ((err as Error & { status?: number }).status === 403) {
      res.status(403).json({ error: (err as Error).message })
      return
    }
    next(err)
  }
})
```

- [ ] **Step 4: Add GET /me/my-classes/:classId/schedule**

```typescript
selfServiceRouter.get('/me/my-classes/:classId/schedule', async (req: Request, res: Response, next: NextFunction) => {
  try {
    await validateTrainerAccess(req.userEmail!, req.params.classId)

    const { data, error } = await supabase
      .from('class_schedule_slots')
      .select('*')
      .eq('class_id', req.params.classId)
      .order('slot_date', { ascending: true })
      .order('start_time', { ascending: true })
    if (error) throw error
    res.json(data)
  } catch (err) {
    if ((err as Error & { status?: number }).status === 403) {
      res.status(403).json({ error: (err as Error).message })
      return
    }
    next(err)
  }
})
```

- [ ] **Step 5: Add GET /me/my-classes/:classId/hours (scoped to trainer's own + all students)**

```typescript
/**
 * GET /me/my-classes/:classId/hours
 * Auth: trainer assigned to class
 * Returns: trainer's own hours + all student hours. Does NOT include other trainers' hours.
 */
selfServiceRouter.get('/me/my-classes/:classId/hours', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const trainerRow = await validateTrainerAccess(req.userEmail!, req.params.classId)

    // Fetch trainer's own hours and all student hours in parallel
    const [trainerHoursResult, studentHoursResult] = await Promise.all([
      supabase
        .from('class_logged_hours')
        .select('*')
        .eq('class_id', req.params.classId)
        .eq('person_type', 'trainer')
        .eq('trainer_id', trainerRow.id)
        .order('log_date', { ascending: false }),
      supabase
        .from('class_logged_hours')
        .select('*')
        .eq('class_id', req.params.classId)
        .eq('person_type', 'student')
        .order('log_date', { ascending: false }),
    ])

    if (trainerHoursResult.error) throw trainerHoursResult.error
    if (studentHoursResult.error) throw studentHoursResult.error

    res.json({
      trainer_hours: trainerHoursResult.data ?? [],
      student_hours: studentHoursResult.data ?? [],
    })
  } catch (err) {
    if ((err as Error & { status?: number }).status === 403) {
      res.status(403).json({ error: (err as Error).message })
      return
    }
    next(err)
  }
})
```

- [ ] **Step 6: Add GET /me/my-classes/:classId/students/:enrollmentId/progress**

```typescript
selfServiceRouter.get('/me/my-classes/:classId/students/:enrollmentId/progress', async (req: Request, res: Response, next: NextFunction) => {
  try {
    await validateTrainerAccess(req.userEmail!, req.params.classId)

    const enrollmentId = req.params.enrollmentId

    // Verify enrollment belongs to this class
    const { data: enrollment, error: enrollError } = await supabase
      .from('class_enrollments')
      .select('*')
      .eq('id', enrollmentId)
      .eq('class_id', req.params.classId)
      .single()
    if (enrollError || !enrollment) {
      res.status(404).json({ error: 'Student not found in this class' })
      return
    }

    const [progressResult, drillTimesResult] = await Promise.all([
      supabase
        .from('class_daily_report_trainee_progress')
        .select('*, class_daily_reports!inner(report_date, session_label, group_label)')
        .eq('enrollment_id', enrollmentId)
        .order('created_at', { ascending: true }),
      supabase
        .from('class_daily_report_drill_times')
        .select('*, class_daily_reports!inner(report_date), class_drills!inner(name, type, par_time_seconds, target_score)')
        .eq('enrollment_id', enrollmentId)
        .order('created_at', { ascending: true }),
    ])

    if (progressResult.error) throw progressResult.error
    if (drillTimesResult.error) throw drillTimesResult.error

    res.json({
      enrollment,
      progress: progressResult.data ?? [],
      drill_times: drillTimesResult.data ?? [],
    })
  } catch (err) {
    if ((err as Error & { status?: number }).status === 403) {
      res.status(403).json({ error: (err as Error).message })
      return
    }
    next(err)
  }
})
```

- [ ] **Step 7: Verify the server compiles**

Run: `cd /home/gtse8/GatewayTrainingTool/server && npx tsc --noEmit`
Expected: No type errors

- [ ] **Step 8: Commit**

```bash
git add server/src/routes/selfService.ts
git commit -m "feat(trainer): add class detail, reports, schedule, hours, and student progress read endpoints"
```

---

## Task 3: Backend — Write endpoints (reports, hours, drills)

**Files:**
- Modify: `server/src/routes/selfService.ts`

- [ ] **Step 1: Add report create/update/finalize endpoints**

```typescript
/**
 * POST /me/my-classes/:classId/reports
 * Auth: trainer assigned to class
 * Creates a daily report. Mirrors coordinator POST /classes/:classId/reports
 * but validates trainer access instead of coordinator role.
 */
selfServiceRouter.post('/me/my-classes/:classId/reports', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const trainerRow = await validateTrainerAccess(req.userEmail!, req.params.classId)

    // Block writes on archived classes
    const { data: cls } = await supabase.from('classes').select('archived').eq('id', req.params.classId).single()
    if (cls?.archived) {
      res.status(400).json({ error: 'Cannot create reports for archived classes' })
      return
    }

    const {
      report_date, group_label, game, session_label,
      class_start_time, class_end_time,
      mg_confirmed, mg_attended, current_trainees, licenses_received,
      override_hours_to_date, override_paid_hours_total, override_live_hours_total,
      trainer_ids = [], timeline = [], progress = [], drill_times = [],
    } = req.body

    // Auto-include this trainer if not already in trainer_ids
    const allTrainerIds = trainer_ids.includes(trainerRow.id)
      ? trainer_ids
      : [trainerRow.id, ...trainer_ids]

    const { data: report, error: reportError } = await supabase
      .from('class_daily_reports')
      .insert({
        class_id: req.params.classId,
        report_date,
        group_label: group_label ?? null,
        game: game ?? null,
        session_label: session_label ?? null,
        class_start_time: class_start_time ?? null,
        class_end_time: class_end_time ?? null,
        mg_confirmed: mg_confirmed ?? null,
        mg_attended: mg_attended ?? null,
        current_trainees: current_trainees ?? null,
        licenses_received: licenses_received ?? null,
        override_hours_to_date: override_hours_to_date ?? null,
        override_paid_hours_total: override_paid_hours_total ?? null,
        override_live_hours_total: override_live_hours_total ?? null,
      })
      .select()
      .single()
    if (reportError) throw reportError

    const reportId = (report as { id: string }).id

    if (allTrainerIds.length > 0) {
      await supabase
        .from('class_daily_report_trainers')
        .insert(allTrainerIds.map((tid: string) => ({ report_id: reportId, trainer_id: tid })))
    }
    if (timeline.length > 0) {
      await supabase.from('class_daily_report_timeline_items').insert(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        timeline.map((item: any, index: number) => ({
          report_id: reportId,
          start_time: item.start_time ?? null,
          end_time: item.end_time ?? null,
          activity: item.activity ?? null,
          homework_handouts_tests: item.homework_handouts_tests ?? null,
          category: item.category ?? null,
          position: index,
        })),
      )
    }
    if (progress.length > 0) {
      await supabase.from('class_daily_report_trainee_progress').insert(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
        })),
      )
    }
    if (drill_times.length > 0) {
      const { error: dtError } = await supabase.from('class_daily_report_drill_times').insert(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        drill_times.map((row: any) => ({
          report_id: reportId,
          enrollment_id: row.enrollment_id,
          drill_id: row.drill_id,
          time_seconds: row.time_seconds ?? null,
          score: row.score ?? null,
        })),
      )
      if (dtError) throw dtError
    }

    await logAudit({
      userId: req.userId!,
      action: 'CREATE',
      tableName: 'class_daily_reports',
      recordId: reportId,
      metadata: { class_id: req.params.classId, report_date, created_by: 'trainer' },
      ipAddress: req.ip,
    })

    res.status(201).json(report)
  } catch (err) {
    if ((err as Error & { status?: number }).status === 403) {
      res.status(403).json({ error: (err as Error).message })
      return
    }
    next(err)
  }
})

/**
 * PUT /me/my-classes/:classId/reports/:reportId
 * Auth: trainer assigned to class
 * Full replace strategy for nested data (same pattern as coordinator PUT).
 */
selfServiceRouter.put('/me/my-classes/:classId/reports/:reportId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    await validateTrainerAccess(req.userEmail!, req.params.classId)

    const { data: cls } = await supabase.from('classes').select('archived').eq('id', req.params.classId).single()
    if (cls?.archived) {
      res.status(400).json({ error: 'Cannot update reports for archived classes' })
      return
    }

    const {
      report_date, group_label, game, session_label,
      class_start_time, class_end_time,
      mg_confirmed, mg_attended, current_trainees, licenses_received,
      override_hours_to_date, override_paid_hours_total, override_live_hours_total,
      trainer_ids = [], timeline = [], progress = [], drill_times = [],
    } = req.body

    const reportId = req.params.reportId

    const { data: report, error: reportError } = await supabase
      .from('class_daily_reports')
      .update({
        report_date,
        group_label: group_label ?? null,
        game: game ?? null,
        session_label: session_label ?? null,
        class_start_time: class_start_time ?? null,
        class_end_time: class_end_time ?? null,
        mg_confirmed: mg_confirmed ?? null,
        mg_attended: mg_attended ?? null,
        current_trainees: current_trainees ?? null,
        licenses_received: licenses_received ?? null,
        override_hours_to_date: override_hours_to_date ?? null,
        override_paid_hours_total: override_paid_hours_total ?? null,
        override_live_hours_total: override_live_hours_total ?? null,
      })
      .eq('id', reportId)
      .eq('class_id', req.params.classId)
      .select()
      .single()
    if (reportError) {
      if (reportError.code === 'PGRST116') {
        res.status(404).json({ error: 'Report not found' })
        return
      }
      throw reportError
    }

    // Full replace nested data
    await supabase.from('class_daily_report_trainers').delete().eq('report_id', reportId)
    if (trainer_ids.length > 0) {
      await supabase.from('class_daily_report_trainers')
        .insert(trainer_ids.map((tid: string) => ({ report_id: reportId, trainer_id: tid })))
    }

    await supabase.from('class_daily_report_timeline_items').delete().eq('report_id', reportId)
    if (timeline.length > 0) {
      await supabase.from('class_daily_report_timeline_items').insert(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        timeline.map((item: any, index: number) => ({
          report_id: reportId,
          start_time: item.start_time ?? null,
          end_time: item.end_time ?? null,
          activity: item.activity ?? null,
          homework_handouts_tests: item.homework_handouts_tests ?? null,
          category: item.category ?? null,
          position: index,
        })),
      )
    }

    await supabase.from('class_daily_report_trainee_progress').delete().eq('report_id', reportId)
    if (progress.length > 0) {
      await supabase.from('class_daily_report_trainee_progress').insert(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
        })),
      )
    }

    const { error: dtDelError } = await supabase.from('class_daily_report_drill_times').delete().eq('report_id', reportId)
    if (dtDelError) throw dtDelError
    if (drill_times.length > 0) {
      const { error: dtError } = await supabase.from('class_daily_report_drill_times').insert(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        drill_times.map((row: any) => ({
          report_id: reportId,
          enrollment_id: row.enrollment_id,
          drill_id: row.drill_id,
          time_seconds: row.time_seconds ?? null,
          score: row.score ?? null,
        })),
      )
      if (dtError) throw dtError
    }

    await logAudit({
      userId: req.userId!,
      action: 'UPDATE',
      tableName: 'class_daily_reports',
      recordId: reportId,
      metadata: { class_id: req.params.classId, report_date, updated_by: 'trainer' },
      ipAddress: req.ip,
    })

    res.json(report)
  } catch (err) {
    if ((err as Error & { status?: number }).status === 403) {
      res.status(403).json({ error: (err as Error).message })
      return
    }
    next(err)
  }
})

/**
 * POST /me/my-classes/:classId/reports/:reportId/finalize
 * Auth: trainer assigned to class
 */
selfServiceRouter.post('/me/my-classes/:classId/reports/:reportId/finalize', async (req: Request, res: Response, next: NextFunction) => {
  try {
    await validateTrainerAccess(req.userEmail!, req.params.classId)

    const { data, error } = await supabase
      .from('class_daily_reports')
      .update({ status: 'finalized' })
      .eq('id', req.params.reportId)
      .eq('class_id', req.params.classId)
      .select()
      .single()
    if (error) {
      if (error.code === 'PGRST116') {
        res.status(404).json({ error: 'Report not found' })
        return
      }
      throw error
    }

    await logAudit({
      userId: req.userId!,
      action: 'UPDATE',
      tableName: 'class_daily_reports',
      recordId: req.params.reportId,
      metadata: { action: 'finalize', finalized_by: 'trainer' },
      ipAddress: req.ip,
    })

    res.json(data)
  } catch (err) {
    if ((err as Error & { status?: number }).status === 403) {
      res.status(403).json({ error: (err as Error).message })
      return
    }
    next(err)
  }
})
```

- [ ] **Step 2: Add the `logAudit` import at the top of selfService.ts**

Add to the imports at line 2:

```typescript
import { logAudit } from '../lib/audit'
```

- [ ] **Step 3: Add hours CRUD endpoints**

```typescript
/**
 * POST /me/my-classes/:classId/hours
 * Auth: trainer assigned to class
 * Log hours for self (trainer) or a student.
 */
selfServiceRouter.post('/me/my-classes/:classId/hours', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const trainerRow = await validateTrainerAccess(req.userEmail!, req.params.classId)

    const { data: cls } = await supabase.from('classes').select('archived').eq('id', req.params.classId).single()
    if (cls?.archived) {
      res.status(400).json({ error: 'Cannot log hours for archived classes' })
      return
    }

    const { log_date, person_type, enrollment_id, hours, paid, live_training, notes } = req.body

    if (hours === undefined || typeof hours !== 'number' || hours < 0 || hours > 24) {
      res.status(400).json({ error: 'hours must be a number between 0 and 24' })
      return
    }

    // Trainers can only log hours for themselves (trainer_id is forced to their own)
    const trainer_id = person_type === 'trainer' ? trainerRow.id : null

    const { data, error } = await supabase
      .from('class_logged_hours')
      .insert({
        class_id: req.params.classId,
        log_date,
        person_type,
        trainer_id,
        enrollment_id: person_type === 'student' ? (enrollment_id ?? null) : null,
        hours,
        paid: paid ?? false,
        live_training: live_training ?? false,
        notes: notes ?? null,
      })
      .select()
      .single()
    if (error) throw error

    await logAudit({
      userId: req.userId!,
      action: 'CREATE',
      tableName: 'class_logged_hours',
      recordId: (data as { id: string }).id,
      metadata: { class_id: req.params.classId, hours, person_type, created_by: 'trainer' },
      ipAddress: req.ip,
    })

    res.status(201).json(data)
  } catch (err) {
    if ((err as Error & { status?: number }).status === 403) {
      res.status(403).json({ error: (err as Error).message })
      return
    }
    next(err)
  }
})

/**
 * POST /me/my-classes/:classId/hours/bulk
 * Auth: trainer assigned to class
 * Bulk log student hours — same date, same class, multiple students.
 */
selfServiceRouter.post('/me/my-classes/:classId/hours/bulk', async (req: Request, res: Response, next: NextFunction) => {
  try {
    await validateTrainerAccess(req.userEmail!, req.params.classId)

    const { data: cls } = await supabase.from('classes').select('archived').eq('id', req.params.classId).single()
    if (cls?.archived) {
      res.status(400).json({ error: 'Cannot log hours for archived classes' })
      return
    }

    const { log_date, entries, paid, live_training } = req.body as {
      log_date: string
      entries: Array<{ enrollment_id: string; hours: number; notes?: string }>
      paid?: boolean
      live_training?: boolean
    }

    if (!Array.isArray(entries) || entries.length === 0) {
      res.status(400).json({ error: 'entries must be a non-empty array' })
      return
    }

    for (const entry of entries) {
      if (typeof entry.hours !== 'number' || entry.hours < 0 || entry.hours > 24) {
        res.status(400).json({ error: 'Each entry hours must be between 0 and 24' })
        return
      }
    }

    const rows = entries.map(entry => ({
      class_id: req.params.classId,
      log_date,
      person_type: 'student' as const,
      trainer_id: null,
      enrollment_id: entry.enrollment_id,
      hours: entry.hours,
      paid: paid ?? false,
      live_training: live_training ?? false,
      notes: entry.notes ?? null,
    }))

    const { data, error } = await supabase
      .from('class_logged_hours')
      .insert(rows)
      .select()
    if (error) throw error

    await logAudit({
      userId: req.userId!,
      action: 'CREATE',
      tableName: 'class_logged_hours',
      recordId: 'bulk',
      metadata: { class_id: req.params.classId, count: entries.length, created_by: 'trainer' },
      ipAddress: req.ip,
    })

    res.status(201).json({ inserted: (data ?? []).length })
  } catch (err) {
    if ((err as Error & { status?: number }).status === 403) {
      res.status(403).json({ error: (err as Error).message })
      return
    }
    next(err)
  }
})

/**
 * PUT /me/my-classes/:classId/hours/:hourId
 * Auth: trainer assigned to class
 */
selfServiceRouter.put('/me/my-classes/:classId/hours/:hourId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const trainerRow = await validateTrainerAccess(req.userEmail!, req.params.classId)
    const { log_date, person_type, enrollment_id, hours, paid, live_training, notes } = req.body

    if (hours !== undefined && (typeof hours !== 'number' || hours < 0 || hours > 24)) {
      res.status(400).json({ error: 'hours must be a number between 0 and 24' })
      return
    }

    const trainer_id = person_type === 'trainer' ? trainerRow.id : null

    const { data, error } = await supabase
      .from('class_logged_hours')
      .update({
        log_date,
        person_type,
        trainer_id,
        enrollment_id: person_type === 'student' ? (enrollment_id ?? null) : null,
        hours,
        paid: paid ?? false,
        live_training: live_training ?? false,
        notes: notes ?? null,
      })
      .eq('id', req.params.hourId)
      .eq('class_id', req.params.classId)
      .select()
      .single()
    if (error) {
      if (error.code === 'PGRST116') {
        res.status(404).json({ error: 'Hours record not found' })
        return
      }
      throw error
    }

    await logAudit({
      userId: req.userId!,
      action: 'UPDATE',
      tableName: 'class_logged_hours',
      recordId: req.params.hourId,
      metadata: { class_id: req.params.classId, hours, person_type, updated_by: 'trainer' },
      ipAddress: req.ip,
    })

    res.json(data)
  } catch (err) {
    if ((err as Error & { status?: number }).status === 403) {
      res.status(403).json({ error: (err as Error).message })
      return
    }
    next(err)
  }
})

/**
 * DELETE /me/my-classes/:classId/hours/:hourId
 * Auth: trainer assigned to class
 */
selfServiceRouter.delete('/me/my-classes/:classId/hours/:hourId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    await validateTrainerAccess(req.userEmail!, req.params.classId)

    const { data: existing, error: fetchError } = await supabase
      .from('class_logged_hours')
      .select('id')
      .eq('id', req.params.hourId)
      .eq('class_id', req.params.classId)
      .single()
    if (fetchError || !existing) {
      res.status(404).json({ error: 'Hours record not found' })
      return
    }

    await logAudit({
      userId: req.userId!,
      action: 'DELETE',
      tableName: 'class_logged_hours',
      recordId: req.params.hourId,
      metadata: { class_id: req.params.classId, deleted_by: 'trainer' },
      ipAddress: req.ip,
    })

    const { error } = await supabase.from('class_logged_hours').delete().eq('id', req.params.hourId)
    if (error) throw error
    res.status(204).send()
  } catch (err) {
    if ((err as Error & { status?: number }).status === 403) {
      res.status(403).json({ error: (err as Error).message })
      return
    }
    next(err)
  }
})
```

- [ ] **Step 4: Add drills CRUD endpoints**

```typescript
/**
 * POST /me/my-classes/:classId/drills
 * Auth: trainer assigned to class
 */
selfServiceRouter.post('/me/my-classes/:classId/drills', async (req: Request, res: Response, next: NextFunction) => {
  try {
    await validateTrainerAccess(req.userEmail!, req.params.classId)

    const { data: cls } = await supabase.from('classes').select('archived').eq('id', req.params.classId).single()
    if (cls?.archived) {
      res.status(400).json({ error: 'Cannot create drills for archived classes' })
      return
    }

    const { name, type, par_time_seconds, target_score } = req.body
    const { data, error } = await supabase
      .from('class_drills')
      .insert({
        class_id: req.params.classId,
        name,
        type,
        par_time_seconds: par_time_seconds ?? null,
        target_score: target_score ?? null,
        active: true,
      })
      .select()
      .single()
    if (error) throw error
    res.status(201).json(data)
  } catch (err) {
    if ((err as Error & { status?: number }).status === 403) {
      res.status(403).json({ error: (err as Error).message })
      return
    }
    next(err)
  }
})

/**
 * PUT /me/my-classes/:classId/drills/:drillId
 * Auth: trainer assigned to class
 */
selfServiceRouter.put('/me/my-classes/:classId/drills/:drillId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    await validateTrainerAccess(req.userEmail!, req.params.classId)

    const { name, type, par_time_seconds, target_score, active } = req.body
    const { data, error } = await supabase
      .from('class_drills')
      .update({ name, type, par_time_seconds, target_score, active })
      .eq('id', req.params.drillId)
      .eq('class_id', req.params.classId)
      .select()
      .single()
    if (error) {
      if (error.code === 'PGRST116') {
        res.status(404).json({ error: 'Drill not found' })
        return
      }
      throw error
    }
    res.json(data)
  } catch (err) {
    if ((err as Error & { status?: number }).status === 403) {
      res.status(403).json({ error: (err as Error).message })
      return
    }
    next(err)
  }
})

/**
 * DELETE /me/my-classes/:classId/drills/:drillId
 * Auth: trainer assigned to class
 */
selfServiceRouter.delete('/me/my-classes/:classId/drills/:drillId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    await validateTrainerAccess(req.userEmail!, req.params.classId)

    const { data: existing, error: fetchError } = await supabase
      .from('class_drills')
      .select('id')
      .eq('id', req.params.drillId)
      .eq('class_id', req.params.classId)
      .single()
    if (fetchError || !existing) {
      res.status(404).json({ error: 'Drill not found' })
      return
    }
    const { error } = await supabase.from('class_drills').delete().eq('id', req.params.drillId)
    if (error) throw error
    res.status(204).send()
  } catch (err) {
    if ((err as Error & { status?: number }).status === 403) {
      res.status(403).json({ error: (err as Error).message })
      return
    }
    next(err)
  }
})
```

- [ ] **Step 5: Verify the server compiles**

Run: `cd /home/gtse8/GatewayTrainingTool/server && npx tsc --noEmit`
Expected: No type errors

- [ ] **Step 6: Commit**

```bash
git add server/src/routes/selfService.ts
git commit -m "feat(trainer): add report, hours, and drill write endpoints for trainers"
```

---

## Task 4: Backend — Cross-class endpoints

**Files:**
- Modify: `server/src/routes/selfService.ts`

- [ ] **Step 1: Add GET /me/reports (cross-class)**

```typescript
/**
 * GET /me/reports
 * Auth: any authenticated trainer
 * Paginated reports across all assigned classes.
 * Query params: class_id, date_from, date_to, status, page, limit
 */
selfServiceRouter.get('/me/reports', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const email = req.userEmail
    if (!email) { res.status(401).json({ error: 'No email' }); return }

    // Find all class IDs this trainer is assigned to
    const { data: trainerRows, error: trainerError } = await supabase
      .from('class_trainers')
      .select('class_id')
      .eq('trainer_email', email)
    if (trainerError) throw trainerError
    if (!trainerRows || trainerRows.length === 0) {
      res.json({ data: [], total: 0, page: 0, limit: 50 })
      return
    }

    const classIds = [...new Set(trainerRows.map((t: { class_id: string }) => t.class_id))]
    const { class_id, date_from, date_to, status, page: pageStr, limit: limitStr } = req.query as Record<string, string | undefined>

    const limit = Math.min(Math.max(Number(limitStr) || 50, 1), 200)
    const page = Math.max(Number(pageStr) || 0, 0)
    const offset = page * limit

    let query = supabase
      .from('class_daily_reports')
      .select('*, classes!inner(id, name, site, province, game_type, archived)', { count: 'exact' })
      .in('class_id', classIds)
      .order('report_date', { ascending: false })

    if (class_id) query = query.eq('class_id', class_id)
    if (date_from) query = query.gte('report_date', date_from)
    if (date_to) query = query.lte('report_date', date_to)
    if (status && (status === 'draft' || status === 'finalized')) query = query.eq('status', status)

    query = query.range(offset, offset + limit - 1)

    const { data, error, count } = await query
    if (error) throw error

    res.json({ data: data ?? [], total: count ?? 0, page, limit })
  } catch (err) {
    next(err)
  }
})
```

- [ ] **Step 2: Add GET /me/schedule (cross-class)**

```typescript
/**
 * GET /me/schedule
 * Auth: any authenticated trainer
 * Schedule across all assigned classes.
 * Query params: class_id, date_from, date_to, group_label, page, limit
 */
selfServiceRouter.get('/me/schedule', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const email = req.userEmail
    if (!email) { res.status(401).json({ error: 'No email' }); return }

    const { data: trainerRows, error: trainerError } = await supabase
      .from('class_trainers')
      .select('class_id')
      .eq('trainer_email', email)
    if (trainerError) throw trainerError
    if (!trainerRows || trainerRows.length === 0) {
      res.json({ data: [], total: 0, page: 0, limit: 50 })
      return
    }

    const classIds = [...new Set(trainerRows.map((t: { class_id: string }) => t.class_id))]
    const { class_id, date_from, date_to, group_label, page: pageStr, limit: limitStr } = req.query as Record<string, string | undefined>

    const limit = Math.min(Math.max(Number(limitStr) || 50, 1), 200)
    const page = Math.max(Number(pageStr) || 0, 0)
    const offset = page * limit

    let query = supabase
      .from('class_schedule_slots')
      .select('*, classes!inner(id, name, site, province, game_type, archived), class_trainers(id, trainer_name, role)', { count: 'exact' })
      .in('class_id', classIds)
      .order('slot_date', { ascending: true })
      .order('start_time', { ascending: true })

    if (class_id) query = query.eq('class_id', class_id)
    if (date_from) query = query.gte('slot_date', date_from)
    if (date_to) query = query.lte('slot_date', date_to)
    if (group_label) query = query.eq('group_label', group_label)

    query = query.range(offset, offset + limit - 1)

    const { data, error, count } = await query
    if (error) throw error

    res.json({ data: data ?? [], total: count ?? 0, page, limit })
  } catch (err) {
    next(err)
  }
})
```

- [ ] **Step 3: Add GET /me/hours (cross-class personal hours)**

```typescript
/**
 * GET /me/hours
 * Auth: any authenticated trainer
 * Personal hours across all assigned classes.
 * Query params: class_id, date_from, date_to, page, limit
 */
selfServiceRouter.get('/me/hours', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const email = req.userEmail
    if (!email) { res.status(401).json({ error: 'No email' }); return }

    const { data: trainerRows, error: trainerError } = await supabase
      .from('class_trainers')
      .select('id, class_id')
      .eq('trainer_email', email)
    if (trainerError) throw trainerError
    if (!trainerRows || trainerRows.length === 0) {
      res.json({ data: [], total: 0, page: 0, limit: 50, summary: { total_hours: 0, paid_hours: 0, unpaid_hours: 0 } })
      return
    }

    const trainerIds = trainerRows.map((t: { id: string }) => t.id)
    const { class_id, date_from, date_to, page: pageStr, limit: limitStr } = req.query as Record<string, string | undefined>

    const limit = Math.min(Math.max(Number(limitStr) || 50, 1), 200)
    const page = Math.max(Number(pageStr) || 0, 0)
    const offset = page * limit

    let query = supabase
      .from('class_logged_hours')
      .select('*, classes!inner(id, name, site, province)', { count: 'exact' })
      .eq('person_type', 'trainer')
      .in('trainer_id', trainerIds)
      .order('log_date', { ascending: false })

    if (class_id) query = query.eq('class_id', class_id)
    if (date_from) query = query.gte('log_date', date_from)
    if (date_to) query = query.lte('log_date', date_to)

    query = query.range(offset, offset + limit - 1)

    const { data, error, count } = await query
    if (error) throw error

    // Compute summary
    const allHours = data ?? []
    const total_hours = allHours.reduce((sum: number, h: { hours: number }) => sum + h.hours, 0)
    const paid_hours = allHours.filter((h: { paid: boolean }) => h.paid).reduce((sum: number, h: { hours: number }) => sum + h.hours, 0)

    res.json({
      data: allHours,
      total: count ?? 0,
      page,
      limit,
      summary: { total_hours, paid_hours, unpaid_hours: total_hours - paid_hours },
    })
  } catch (err) {
    next(err)
  }
})
```

- [ ] **Step 4: Verify the server compiles**

Run: `cd /home/gtse8/GatewayTrainingTool/server && npx tsc --noEmit`
Expected: No type errors

- [ ] **Step 5: Commit**

```bash
git add server/src/routes/selfService.ts
git commit -m "feat(trainer): add cross-class reports, schedule, and hours endpoints"
```

---

## Task 5: Frontend — Types + API client extensions

**Files:**
- Modify: `web/src/types/index.ts`
- Modify: `web/src/lib/apiClient.ts`

- [ ] **Step 1: Add trainer-specific types to types/index.ts**

Add at the end of the file, before the closing `PROVINCES` constant:

```typescript
/** Response from GET /me/my-classes — enhanced trainer dashboard. */
export interface TrainerMyClassesResponse {
  trainer_name: string | null
  trainer_email: string
  classes: Array<{
    class_id: string
    trainer_id: string
    class_name: string
    site: string
    province: string
    game_type: string | null
    start_date: string | null
    end_date: string | null
    archived: boolean
    trainer_role: string
    enrolled_count: number
    draft_report_count: number
    total_hours: number
    upcoming_slots: UpcomingSlot[]
  }>
}

/** Response from GET /me/my-classes/:classId. */
export interface TrainerClassDetailResponse extends Class {
  trainer_role: string
  trainer_id: string
  enrollments: ClassEnrollment[]
  drills: ClassDrill[]
}

/** Response from GET /me/my-classes/:classId/hours — split by person type. */
export interface TrainerClassHoursResponse {
  trainer_hours: ClassLoggedHours[]
  student_hours: ClassLoggedHours[]
}

/** Response from GET /me/my-classes/:classId/students/:enrollmentId/progress. */
export interface TrainerStudentProgressResponse {
  enrollment: ClassEnrollment
  progress: ClassDailyReportTraineeProgress[]
  drill_times: ClassDailyReportDrillTime[]
}

/** Response from GET /me/hours — personal hours with summary. */
export interface TrainerMyHoursResponse {
  data: (ClassLoggedHours & { classes: { id: string; name: string; site: string; province: string } })[]
  total: number
  page: number
  limit: number
  summary: { total_hours: number; paid_hours: number; unpaid_hours: number }
}
```

- [ ] **Step 2: Add trainer self-service API methods to apiClient.ts**

In the `api` object, expand the existing `selfService` section (currently at line 523-526). Replace it with:

```typescript
  selfService: {
    trainerDashboard: () => req<TrainerDashboardResponse>('/me/trainer-dashboard'),
    traineeDashboard: () => req<TraineeDashboardResponse>('/me/trainee-progress'),

    // Trainer class management
    myClasses: () => req<TrainerMyClassesResponse>('/me/my-classes'),
    classDetail: (classId: string) => req<TrainerClassDetailResponse>(`/me/my-classes/${classId}`),

    // Class-scoped reads
    classReports: (classId: string) => req<ClassDailyReport[]>(`/me/my-classes/${classId}/reports`),
    classReportDetail: (classId: string, reportId: string) =>
      req<ReportWithNested>(`/me/my-classes/${classId}/reports/${reportId}`),
    classSchedule: (classId: string) => req<ClassScheduleSlot[]>(`/me/my-classes/${classId}/schedule`),
    classHours: (classId: string) => req<TrainerClassHoursResponse>(`/me/my-classes/${classId}/hours`),
    classDrills: (classId: string) => req<TrainerClassDetailResponse>(`/me/my-classes/${classId}`).then(r => r.drills),
    studentProgress: (classId: string, enrollmentId: string) =>
      req<TrainerStudentProgressResponse>(`/me/my-classes/${classId}/students/${enrollmentId}/progress`),

    // Class-scoped writes — reports
    createReport: (classId: string, body: ReportBody) =>
      req<ClassDailyReport>(`/me/my-classes/${classId}/reports`, { method: 'POST', body: JSON.stringify(body) }),
    updateReport: (classId: string, reportId: string, body: ReportBody) =>
      req<ClassDailyReport>(`/me/my-classes/${classId}/reports/${reportId}`, { method: 'PUT', body: JSON.stringify(body) }),
    finalizeReport: (classId: string, reportId: string) =>
      req<ClassDailyReport>(`/me/my-classes/${classId}/reports/${reportId}/finalize`, { method: 'POST' }),

    // Class-scoped writes — hours
    createHours: (classId: string, body: {
      log_date: string; person_type: LoggedHoursPersonType;
      enrollment_id?: string | null; hours: number;
      paid?: boolean; live_training?: boolean; notes?: string | null;
    }) => req<ClassLoggedHours>(`/me/my-classes/${classId}/hours`, { method: 'POST', body: JSON.stringify(body) }),
    createHoursBulk: (classId: string, body: {
      log_date: string;
      entries: Array<{ enrollment_id: string; hours: number; notes?: string }>;
      paid?: boolean; live_training?: boolean;
    }) => req<{ inserted: number }>(`/me/my-classes/${classId}/hours/bulk`, { method: 'POST', body: JSON.stringify(body) }),
    updateHours: (classId: string, hourId: string, body: Partial<ClassLoggedHours>) =>
      req<ClassLoggedHours>(`/me/my-classes/${classId}/hours/${hourId}`, { method: 'PUT', body: JSON.stringify(body) }),
    deleteHours: (classId: string, hourId: string) =>
      req<void>(`/me/my-classes/${classId}/hours/${hourId}`, { method: 'DELETE' }),

    // Class-scoped writes — drills
    createDrill: (classId: string, body: { name: string; type: DrillType; par_time_seconds?: number | null; target_score?: number | null }) =>
      req<ClassDrill>(`/me/my-classes/${classId}/drills`, { method: 'POST', body: JSON.stringify(body) }),
    updateDrill: (classId: string, drillId: string, body: Partial<ClassDrill>) =>
      req<ClassDrill>(`/me/my-classes/${classId}/drills/${drillId}`, { method: 'PUT', body: JSON.stringify(body) }),
    deleteDrill: (classId: string, drillId: string) =>
      req<void>(`/me/my-classes/${classId}/drills/${drillId}`, { method: 'DELETE' }),

    // Cross-class reads
    allReports: (params?: { class_id?: string; date_from?: string; date_to?: string; status?: string; page?: number; limit?: number }) => {
      const entries: Record<string, string> = {}
      if (params) { for (const [k, v] of Object.entries(params)) { if (v !== undefined && v !== '') entries[k] = String(v) } }
      const qs = new URLSearchParams(entries).toString()
      return req<PaginatedReports>(`/me/reports${qs ? `?${qs}` : ''}`)
    },
    allSchedule: (params?: { class_id?: string; date_from?: string; date_to?: string; group_label?: string; page?: number; limit?: number }) => {
      const entries: Record<string, string> = {}
      if (params) { for (const [k, v] of Object.entries(params)) { if (v !== undefined && v !== '') entries[k] = String(v) } }
      const qs = new URLSearchParams(entries).toString()
      return req<PaginatedSchedule>(`/me/schedule${qs ? `?${qs}` : ''}`)
    },
    allHours: (params?: { class_id?: string; date_from?: string; date_to?: string; page?: number; limit?: number }) => {
      const entries: Record<string, string> = {}
      if (params) { for (const [k, v] of Object.entries(params)) { if (v !== undefined && v !== '') entries[k] = String(v) } }
      const qs = new URLSearchParams(entries).toString()
      return req<TrainerMyHoursResponse>(`/me/hours${qs ? `?${qs}` : ''}`)
    },
  },
```

Also add the new type imports at the top of apiClient.ts:

```typescript
import type {
  // ... existing imports ...
  TrainerMyClassesResponse,
  TrainerClassDetailResponse,
  TrainerClassHoursResponse,
  TrainerStudentProgressResponse,
  TrainerMyHoursResponse,
} from '../types'
```

And make the `ReportBody` interface exported so it can be referenced:

```typescript
export interface ReportBody {
```

- [ ] **Step 3: Verify frontend compiles**

Run: `cd /home/gtse8/GatewayTrainingTool/web && npx tsc --noEmit`
Expected: No type errors

- [ ] **Step 4: Commit**

```bash
git add web/src/types/index.ts web/src/lib/apiClient.ts
git commit -m "feat(trainer): add trainer types and API client methods"
```

---

## Task 6: Frontend — TrainerLayout, TrainerRoute, and ProtectedLayout trainer branch

**Files:**
- Create: `web/src/components/TrainerLayout.tsx`
- Create: `web/src/layouts/TrainerRoute.tsx`
- Modify: `web/src/layouts/ProtectedLayout.tsx`

- [ ] **Step 1: Create TrainerLayout component**

Create `web/src/components/TrainerLayout.tsx` mirroring `CoordinatorLayout.tsx`:

```tsx
import { NavLink } from 'react-router-dom'

type NavItem = { to: string; label: string; icon: React.ReactNode }

const icon = (d: string) => (
  <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
    <path d={d} />
  </svg>
)

export const TRAINER_NAV_ITEMS: NavItem[] = [
  { to: '/dashboard', label: 'Dashboard', icon: icon('M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2V9z') },
  { to: '/my-classes', label: 'My Classes', icon: icon('M4 19.5A2.5 2.5 0 016.5 17H20M4 19.5A2.5 2.5 0 004 17V5a2 2 0 012-2h14a2 2 0 012 2v12a2.5 2.5 0 01-2.5 2.5H4z') },
  { to: '/reports', label: 'Reports', icon: icon('M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8zM14 2v6h6M16 13H8M16 17H8M10 9H8') },
  { to: '/schedule', label: 'Schedule', icon: icon('M19 4H5a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2V6a2 2 0 00-2-2zM16 2v4M8 2v4M3 10h18') },
  { to: '/hours', label: 'Hours', icon: icon('M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10zM12 6v6l4 2') },
]

function NavTooltip({ label }: { label: string }) {
  return (
    <div className="pointer-events-none absolute left-full ml-2.5 top-1/2 -translate-y-1/2 z-[60] opacity-0 group-hover/tip:opacity-100 transition-opacity duration-100 whitespace-nowrap">
      <div className="bg-gw-surface border border-white/10 rounded-md px-2.5 py-1 text-xs font-medium text-slate-200 shadow-lg">
        {label}
      </div>
    </div>
  )
}

export function TrainerLayout() {
  return (
    <aside className="hidden md:flex fixed top-0 left-0 h-full w-16 flex-col items-center py-4 gap-2 bg-white/[0.03] border-r border-white/[0.06] z-50">
      {/* Logo mark */}
      <div className="w-10 h-10 rounded-[10px] bg-gradient-to-br from-gw-blue to-gw-teal flex items-center justify-center shrink-0 mb-2">
        <span className="text-white font-bold text-base leading-none select-none">G</span>
      </div>

      {/* Nav items */}
      <nav className="flex flex-col items-center gap-1 flex-1 w-full px-3" aria-label="Trainer navigation">
        {TRAINER_NAV_ITEMS.map(({ to, label, icon: navIcon }) => (
          <div key={to} className="relative group/tip w-full flex justify-center">
            <NavLink
              to={to}
              className={({ isActive }) =>
                `w-10 h-10 rounded-[10px] flex items-center justify-center transition-colors duration-100 ${
                  isActive
                    ? 'bg-gw-blue/20 border border-gw-blue/35 text-gw-blue'
                    : 'text-slate-500 hover:bg-white/5 hover:text-slate-300'
                }`
              }
              aria-label={label}
            >
              {navIcon}
            </NavLink>
            <NavTooltip label={label} />
          </div>
        ))}
      </nav>
    </aside>
  )
}
```

- [ ] **Step 2: Create TrainerRoute guard**

Create `web/src/layouts/TrainerRoute.tsx`:

```tsx
import { Navigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

export function TrainerRoute({ children }: { children: React.ReactNode }) {
  const { role } = useAuth()
  if (role !== 'trainer') return <Navigate to="/dashboard" replace />
  return <>{children}</>
}
```

- [ ] **Step 3: Add trainer branch to ProtectedLayout**

In `web/src/layouts/ProtectedLayout.tsx`, add the trainer layout branch. This involves:

1. Import `TrainerLayout` and `TRAINER_NAV_ITEMS` at the top:

```typescript
import { TrainerLayout, TRAINER_NAV_ITEMS } from '../components/TrainerLayout'
```

2. After the coordinator `if (role === 'coordinator')` block (ending around line 133), add a trainer block before the non-coordinator fallback. The trainer block follows the same pattern as coordinator — sidebar, mobile top bar, mobile bottom nav, content area:

```tsx
  if (role === 'trainer') {
    const TRAINER_BOTTOM_NAV = TRAINER_NAV_ITEMS.slice(0, 4)
    const TRAINER_MORE_ITEMS = [
      TRAINER_NAV_ITEMS[4], // Hours
    ]

    return (
      <div className="min-h-screen w-screen bg-gw-darkest">
        <TrainerLayout />

        {/* Mobile top bar */}
        <div className="fixed top-0 left-0 right-0 z-30 flex items-center justify-between h-14 bg-gw-darkest border-b border-white/[0.06] px-4 md:hidden">
          <div className="w-8 h-8 rounded-[10px] bg-gradient-to-br from-gw-blue to-gw-teal flex items-center justify-center shrink-0">
            <span className="text-white font-bold text-sm leading-none select-none">G</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-gw-blue/20 border border-gw-blue/30 flex items-center justify-center select-none">
              <span className="text-xs font-semibold text-gw-blue">{initials}</span>
            </div>
          </div>
        </div>

        {/* Main content */}
        <section className="md:ml-16 pt-14 md:pt-4 pb-20 md:pb-6 min-h-screen px-4 md:px-6 flex flex-col gap-4 overflow-auto">
          <Outlet />
        </section>

        {/* Mobile bottom nav */}
        <nav
          className="fixed bottom-0 left-0 right-0 z-30 flex items-center justify-around h-16 bg-gw-surface border-t border-white/[0.06] md:hidden"
          aria-label="Mobile navigation"
        >
          {TRAINER_BOTTOM_NAV.map(({ to, label, icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `flex flex-col items-center gap-0.5 px-3 py-1 transition-colors duration-100 ${
                  isActive ? 'text-gw-blue' : 'text-slate-500'
                }`
              }
            >
              {icon}
              <span className="text-[10px] font-medium">{label}</span>
            </NavLink>
          ))}
          <button
            type="button"
            onClick={() => setMoreOpen(true)}
            className="flex flex-col items-center gap-0.5 px-3 py-1 text-slate-500"
          >
            <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12h.01M12 12h.01M19 12h.01" />
            </svg>
            <span className="text-[10px] font-medium">More</span>
          </button>
        </nav>

        {/* More bottom sheet */}
        {moreOpen && (
          <div
            className="fixed inset-0 z-50 flex items-end md:hidden bg-black/60 animate-backdrop-in"
            onClick={() => setMoreOpen(false)}
          >
            <div
              className="w-full bg-gw-surface border-t border-white/[0.08] rounded-t-[14px] p-4 pb-8 animate-modal-in"
              onClick={e => e.stopPropagation()}
            >
              <div className="w-10 h-1 rounded-full bg-white/20 mx-auto mb-4" />
              <div className="grid grid-cols-2 gap-2">
                {TRAINER_MORE_ITEMS.map(({ to, label, icon }) => (
                  <NavLink
                    key={to}
                    to={to}
                    onClick={() => setMoreOpen(false)}
                    className={({ isActive }) =>
                      `flex items-center gap-3 rounded-[10px] px-3 py-3 transition-colors duration-100 ${
                        isActive
                          ? 'bg-gw-blue/20 border border-gw-blue/35 text-slate-100'
                          : 'bg-white/[0.03] border border-white/[0.06] text-slate-400 hover:text-slate-200'
                      }`
                    }
                  >
                    {icon}
                    <span className="text-sm font-medium">{label}</span>
                  </NavLink>
                ))}
                <button
                  type="button"
                  onClick={() => { signOut(); setMoreOpen(false) }}
                  className="flex items-center gap-3 rounded-[10px] px-3 py-3 bg-white/[0.03] border border-white/[0.06] text-slate-400 hover:text-slate-200 transition-colors duration-100"
                >
                  {navIcon('M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9')}
                  <span className="text-sm font-medium">Sign out</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    )
  }
```

- [ ] **Step 4: Verify the frontend compiles**

Run: `cd /home/gtse8/GatewayTrainingTool/web && npx tsc --noEmit`
Expected: No type errors

- [ ] **Step 5: Commit**

```bash
git add web/src/components/TrainerLayout.tsx web/src/layouts/TrainerRoute.tsx web/src/layouts/ProtectedLayout.tsx
git commit -m "feat(trainer): add TrainerLayout sidebar, TrainerRoute guard, and trainer branch in ProtectedLayout"
```

---

## Task 7: Frontend — TrainerContext + Routing

**Files:**
- Create: `web/src/contexts/TrainerContext.tsx`
- Modify: `web/src/App.tsx`

- [ ] **Step 1: Create TrainerContext**

Create `web/src/contexts/TrainerContext.tsx`:

```tsx
import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react'
import { api } from '../lib/apiClient'
import type { TrainerMyClassesResponse } from '../types'

interface TrainerContextValue {
  trainerName: string | null
  trainerEmail: string
  classes: TrainerMyClassesResponse['classes']
  loading: boolean
  refresh: () => Promise<void>
}

const TrainerContext = createContext<TrainerContextValue | null>(null)

export function TrainerProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<TrainerMyClassesResponse | null>(null)
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    try {
      const result = await api.selfService.myClasses()
      setData(result)
    } catch (err) {
      console.error('TrainerContext fetch error:', (err as Error).message)
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    api.selfService.myClasses()
      .then(result => { if (!cancelled) setData(result) })
      .catch(err => console.error('TrainerContext fetch error:', (err as Error).message))
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [])

  return (
    <TrainerContext.Provider value={{
      trainerName: data?.trainer_name ?? null,
      trainerEmail: data?.trainer_email ?? '',
      classes: data?.classes ?? [],
      loading,
      refresh,
    }}>
      {children}
    </TrainerContext.Provider>
  )
}

export function useTrainer() {
  const ctx = useContext(TrainerContext)
  if (!ctx) throw new Error('useTrainer must be used within TrainerProvider')
  return ctx
}
```

- [ ] **Step 2: Add trainer routes to App.tsx**

Modify `web/src/App.tsx`. Add imports for the new pages and route guards, then add trainer routes inside the protected layout:

Add imports:

```typescript
import { TrainerRoute } from './layouts/TrainerRoute'
import { TrainerProvider } from './contexts/TrainerContext'
import { MyClassesPage } from './pages/MyClassesPage'
import { TrainerClassDetailPage } from './pages/TrainerClassDetailPage'
import { TrainerReportsPage } from './pages/TrainerReportsPage'
import { TrainerSchedulePage } from './pages/TrainerSchedulePage'
import { TrainerHoursPage } from './pages/TrainerHoursPage'
```

Add routes after the coordinator routes (before the `</Route>` closing the protected shell):

```tsx
            {/* Trainer-only pages wrapped in TrainerRoute guard */}
            <Route path="my-classes" element={<TrainerRoute><TrainerProvider><MyClassesPage /></TrainerProvider></TrainerRoute>} />
            <Route path="my-classes/:classId" element={<TrainerRoute><TrainerProvider><TrainerClassDetailPage /></TrainerProvider></TrainerRoute>} />
            <Route path="reports" element={<TrainerRoute><TrainerProvider><TrainerReportsPage /></TrainerProvider></TrainerRoute>} />
            <Route path="schedule" element={<TrainerRoute><TrainerProvider><TrainerSchedulePage /></TrainerProvider></TrainerRoute>} />
            <Route path="hours" element={<TrainerRoute><TrainerProvider><TrainerHoursPage /></TrainerProvider></TrainerRoute>} />
```

Note: The `/reports` and `/schedule` routes already exist for coordinators wrapped in `CoordinatorRoute`. Since coordinators are redirected by `TrainerRoute` and trainers are redirected by `CoordinatorRoute`, both routes can coexist — only one set will render per role. However, if React Router complains about duplicate paths, wrap trainer routes under a different base (e.g., `/t/reports`). Alternatively, make the existing `/reports` and `/schedule` routes role-aware (check in the page component which to render). The simplest approach is to make the existing routes NOT wrapped in CoordinatorRoute and instead render different content based on role. This decision should be made during implementation.

- [ ] **Step 3: Create placeholder pages**

Create minimal placeholder files so the app compiles. These will be fully implemented in later tasks:

`web/src/pages/MyClassesPage.tsx`:
```tsx
export function MyClassesPage() {
  return <div className="text-slate-300">My Classes — coming soon</div>
}
```

`web/src/pages/TrainerClassDetailPage.tsx`:
```tsx
export function TrainerClassDetailPage() {
  return <div className="text-slate-300">Class Detail — coming soon</div>
}
```

`web/src/pages/TrainerReportsPage.tsx`:
```tsx
export function TrainerReportsPage() {
  return <div className="text-slate-300">Trainer Reports — coming soon</div>
}
```

`web/src/pages/TrainerSchedulePage.tsx`:
```tsx
export function TrainerSchedulePage() {
  return <div className="text-slate-300">Trainer Schedule — coming soon</div>
}
```

`web/src/pages/TrainerHoursPage.tsx`:
```tsx
export function TrainerHoursPage() {
  return <div className="text-slate-300">Trainer Hours — coming soon</div>
}
```

- [ ] **Step 4: Verify frontend compiles and runs**

Run: `cd /home/gtse8/GatewayTrainingTool/web && npx tsc --noEmit`
Expected: No type errors

- [ ] **Step 5: Commit**

```bash
git add web/src/contexts/TrainerContext.tsx web/src/App.tsx web/src/pages/MyClassesPage.tsx web/src/pages/TrainerClassDetailPage.tsx web/src/pages/TrainerReportsPage.tsx web/src/pages/TrainerSchedulePage.tsx web/src/pages/TrainerHoursPage.tsx
git commit -m "feat(trainer): add TrainerContext, routing, and placeholder pages"
```

---

## Task 8: Frontend — Enhanced TrainerDashboard

**Files:**
- Modify: `web/src/pages/TrainerDashboard.tsx`

- [ ] **Step 1: Rewrite TrainerDashboard with stat cards and enriched class cards**

Replace the contents of `web/src/pages/TrainerDashboard.tsx` with a dashboard that shows:
- Stat cards (class count, upcoming sessions this week, draft reports, total hours this month)
- Class card grid with richer info (draft count, hours, next session)
- Upcoming schedule section (next 5 days grouped by day)

The component should call `api.selfService.myClasses()` (same as before but richer response), and also call `api.selfService.allSchedule()` for the upcoming 5-day schedule.

Use `SkeletonCard` / `SkeletonTable` for loading states and `EmptyState` when no classes are assigned.

Follow the existing `DashboardContent.tsx` pattern for layout: stat cards in a grid at top, then two-column layout below (class cards left, upcoming schedule right).

Each class card should be a `<Link to={`/my-classes/${cls.class_id}`}>` so clicking navigates to the trainer class detail page.

- [ ] **Step 2: Verify the frontend compiles**

Run: `cd /home/gtse8/GatewayTrainingTool/web && npx tsc --noEmit`

- [ ] **Step 3: Commit**

```bash
git add web/src/pages/TrainerDashboard.tsx
git commit -m "feat(trainer): enhance trainer dashboard with stat cards and enriched class grid"
```

---

## Task 9: Frontend — MyClassesPage

**Files:**
- Modify: `web/src/pages/MyClassesPage.tsx`

- [ ] **Step 1: Implement MyClassesPage**

Replace the placeholder with a full page that shows all assigned classes in a card grid. Features:
- Toggle between active and archived classes
- Each card shows: class name, site, province, game type, trainer role badge (primary/assistant), enrolled count, next upcoming slot, draft report count
- Click navigates to `/my-classes/:classId`
- Uses `useTrainer()` context for data
- `SkeletonCard` for loading, `EmptyState` when no classes

Follow the existing `ClassesPage.tsx` card layout pattern but simplified (no create/edit/delete actions).

- [ ] **Step 2: Verify and commit**

```bash
git add web/src/pages/MyClassesPage.tsx
git commit -m "feat(trainer): implement MyClassesPage with class card grid"
```

---

## Task 10: Frontend — TrainerClassDetailContext + TrainerClassDetailPage

**Files:**
- Create: `web/src/contexts/TrainerClassDetailContext.tsx`
- Modify: `web/src/pages/TrainerClassDetailPage.tsx`

- [ ] **Step 1: Create TrainerClassDetailContext**

Create `web/src/contexts/TrainerClassDetailContext.tsx` mirroring `ClassDetailContext.tsx` but using trainer self-service endpoints:

```tsx
import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react'
import { api } from '../lib/apiClient'
import type {
  ClassEnrollment,
  ClassScheduleSlot,
  ClassDailyReport,
  ClassLoggedHours,
  ClassDrill,
  TrainerClassDetailResponse,
} from '../types'

interface TrainerClassDetailContextValue {
  classId: string
  classInfo: TrainerClassDetailResponse | null
  enrollments: ClassEnrollment[]
  schedule: ClassScheduleSlot[]
  reports: ClassDailyReport[]
  trainerHours: ClassLoggedHours[]
  studentHours: ClassLoggedHours[]
  drills: ClassDrill[]
  loading: boolean
  refreshReports: () => Promise<void>
  refreshHours: () => Promise<void>
  refreshDrills: () => Promise<void>
  refreshSchedule: () => Promise<void>
  refreshEnrollments: () => Promise<void>
}

const TrainerClassDetailContext = createContext<TrainerClassDetailContextValue | null>(null)

export function TrainerClassDetailProvider({ classId, children }: { classId: string; children: ReactNode }) {
  const [classInfo, setClassInfo] = useState<TrainerClassDetailResponse | null>(null)
  const [enrollments, setEnrollments] = useState<ClassEnrollment[]>([])
  const [schedule, setSchedule] = useState<ClassScheduleSlot[]>([])
  const [reports, setReports] = useState<ClassDailyReport[]>([])
  const [trainerHours, setTrainerHours] = useState<ClassLoggedHours[]>([])
  const [studentHours, setStudentHours] = useState<ClassLoggedHours[]>([])
  const [drills, setDrills] = useState<ClassDrill[]>([])
  const [loading, setLoading] = useState(true)

  const refreshReports = useCallback(async () => {
    const data = await api.selfService.classReports(classId)
    setReports(data)
  }, [classId])

  const refreshHours = useCallback(async () => {
    const data = await api.selfService.classHours(classId)
    setTrainerHours(data.trainer_hours)
    setStudentHours(data.student_hours)
  }, [classId])

  const refreshDrills = useCallback(async () => {
    const detail = await api.selfService.classDetail(classId)
    setDrills(detail.drills)
  }, [classId])

  const refreshSchedule = useCallback(async () => {
    const data = await api.selfService.classSchedule(classId)
    setSchedule(data)
  }, [classId])

  const refreshEnrollments = useCallback(async () => {
    const detail = await api.selfService.classDetail(classId)
    setEnrollments(detail.enrollments)
  }, [classId])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    Promise.all([
      api.selfService.classDetail(classId),
      api.selfService.classSchedule(classId),
      api.selfService.classReports(classId),
      api.selfService.classHours(classId),
    ])
      .then(([detail, sched, reps, hrs]) => {
        if (cancelled) return
        setClassInfo(detail)
        setEnrollments(detail.enrollments)
        setDrills(detail.drills)
        setSchedule(sched)
        setReports(reps)
        setTrainerHours(hrs.trainer_hours)
        setStudentHours(hrs.student_hours)
      })
      .catch(err => console.error('TrainerClassDetailContext fetch error:', (err as Error).message))
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [classId])

  return (
    <TrainerClassDetailContext.Provider value={{
      classId, classInfo, enrollments, schedule, reports,
      trainerHours, studentHours, drills, loading,
      refreshReports, refreshHours, refreshDrills, refreshSchedule, refreshEnrollments,
    }}>
      {children}
    </TrainerClassDetailContext.Provider>
  )
}

export function useTrainerClassDetail() {
  const ctx = useContext(TrainerClassDetailContext)
  if (!ctx) throw new Error('useTrainerClassDetail must be used within TrainerClassDetailProvider')
  return ctx
}
```

- [ ] **Step 2: Implement TrainerClassDetailPage with tab navigation**

Replace `web/src/pages/TrainerClassDetailPage.tsx` with a tabbed layout:

```tsx
import { useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { TrainerClassDetailProvider, useTrainerClassDetail } from '../contexts/TrainerClassDetailContext'
import { TrainerOverviewSection } from './TrainerClassDetail/TrainerOverviewSection'
import { TrainerStudentsSection } from './TrainerClassDetail/TrainerStudentsSection'
import { TrainerScheduleSection } from './TrainerClassDetail/TrainerScheduleSection'
import { TrainerDrillsSection } from './TrainerClassDetail/TrainerDrillsSection'
import { TrainerReportsSection } from './TrainerClassDetail/TrainerReportsSection'
import { TrainerHoursSection } from './TrainerClassDetail/TrainerHoursSection'

type Tab = 'overview' | 'students' | 'schedule' | 'drills' | 'reports' | 'hours'

const TABS: { key: Tab; label: string }[] = [
  { key: 'overview', label: 'Overview' },
  { key: 'students', label: 'Students' },
  { key: 'schedule', label: 'Schedule' },
  { key: 'drills', label: 'Drills' },
  { key: 'reports', label: 'Reports' },
  { key: 'hours', label: 'Hours' },
]

function ClassDetailInner() {
  const [tab, setTab] = useState<Tab>('overview')
  const { classInfo, loading } = useTrainerClassDetail()

  if (loading) {
    return <div className="text-slate-500 text-sm py-10 text-center">Loading class…</div>
  }

  if (!classInfo) {
    return <div className="text-slate-500 text-sm py-10 text-center">Class not found or access denied.</div>
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link to="/my-classes" className="text-slate-500 hover:text-slate-300 transition-colors">
          <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.75"><path d="M15 18l-6-6 6-6" /></svg>
        </Link>
        <div>
          <h1 className="text-lg font-semibold text-slate-100">{classInfo.name}</h1>
          <p className="text-sm text-slate-500">{classInfo.site} &middot; {classInfo.province} &middot; {classInfo.game_type ?? 'No game type'}</p>
        </div>
        <span className={`ml-auto text-xs font-medium px-2 py-0.5 rounded-full ${
          classInfo.trainer_role === 'primary'
            ? 'bg-gw-blue/20 text-gw-blue'
            : 'bg-white/[0.06] text-slate-400'
        }`}>
          {classInfo.trainer_role}
        </span>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 border-b border-white/[0.06] -mx-4 px-4 overflow-x-auto">
        {TABS.map(({ key, label }) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={`px-3 py-2 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
              tab === key
                ? 'border-gw-blue text-gw-blue'
                : 'border-transparent text-slate-500 hover:text-slate-300'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === 'overview' && <TrainerOverviewSection />}
      {tab === 'students' && <TrainerStudentsSection />}
      {tab === 'schedule' && <TrainerScheduleSection />}
      {tab === 'drills' && <TrainerDrillsSection />}
      {tab === 'reports' && <TrainerReportsSection />}
      {tab === 'hours' && <TrainerHoursSection />}
    </div>
  )
}

export function TrainerClassDetailPage() {
  const { classId } = useParams<{ classId: string }>()
  if (!classId) return <div className="text-slate-500">Invalid class ID</div>

  return (
    <TrainerClassDetailProvider classId={classId}>
      <ClassDetailInner />
    </TrainerClassDetailProvider>
  )
}
```

- [ ] **Step 3: Create placeholder tab section files**

Create these minimal placeholders so the app compiles (each will be fully implemented in subsequent tasks):

`web/src/pages/TrainerClassDetail/TrainerOverviewSection.tsx`:
```tsx
import { useTrainerClassDetail } from '../../contexts/TrainerClassDetailContext'
export function TrainerOverviewSection() {
  const { classInfo } = useTrainerClassDetail()
  return <div className="text-slate-300">Overview for {classInfo?.name}</div>
}
```

`web/src/pages/TrainerClassDetail/TrainerStudentsSection.tsx`:
```tsx
export function TrainerStudentsSection() { return <div className="text-slate-300">Students</div> }
```

`web/src/pages/TrainerClassDetail/TrainerScheduleSection.tsx`:
```tsx
export function TrainerScheduleSection() { return <div className="text-slate-300">Schedule</div> }
```

`web/src/pages/TrainerClassDetail/TrainerDrillsSection.tsx`:
```tsx
export function TrainerDrillsSection() { return <div className="text-slate-300">Drills</div> }
```

`web/src/pages/TrainerClassDetail/TrainerReportsSection.tsx`:
```tsx
export function TrainerReportsSection() { return <div className="text-slate-300">Reports</div> }
```

`web/src/pages/TrainerClassDetail/TrainerHoursSection.tsx`:
```tsx
export function TrainerHoursSection() { return <div className="text-slate-300">Hours</div> }
```

- [ ] **Step 4: Verify and commit**

Run: `cd /home/gtse8/GatewayTrainingTool/web && npx tsc --noEmit`

```bash
git add web/src/contexts/TrainerClassDetailContext.tsx web/src/pages/TrainerClassDetailPage.tsx web/src/pages/TrainerClassDetail/
git commit -m "feat(trainer): add TrainerClassDetailContext and tabbed class detail page"
```

---

## Task 11: Frontend — Read-only tab sections (Overview, Students, Schedule)

**Files:**
- Modify: `web/src/pages/TrainerClassDetail/TrainerOverviewSection.tsx`
- Modify: `web/src/pages/TrainerClassDetail/TrainerStudentsSection.tsx`
- Modify: `web/src/pages/TrainerClassDetail/TrainerScheduleSection.tsx`

- [ ] **Step 1: Implement TrainerOverviewSection**

Shows class metadata in a clean card layout: name, site, province, game type, start/end dates, description, trainer role, archived status. Read-only. Use the existing card styling pattern (`bg-gw-surface border border-white/[0.06] rounded-[10px]`).

- [ ] **Step 2: Implement TrainerStudentsSection**

Table of enrolled students: name, email, status badge (enrolled/waitlist/dropped), group label. No add/edit/delete actions. Use existing table styling. Include `EmptyState` when no students.

- [ ] **Step 3: Implement TrainerScheduleSection**

Table of schedule slots: date, start time, end time, group label, notes. Sorted by date ascending. Include `EmptyState` when no slots. Read-only.

- [ ] **Step 4: Verify and commit**

```bash
git add web/src/pages/TrainerClassDetail/TrainerOverviewSection.tsx web/src/pages/TrainerClassDetail/TrainerStudentsSection.tsx web/src/pages/TrainerClassDetail/TrainerScheduleSection.tsx
git commit -m "feat(trainer): implement read-only Overview, Students, and Schedule tab sections"
```

---

## Task 12: Frontend — Drills tab section

**Files:**
- Modify: `web/src/pages/TrainerClassDetail/TrainerDrillsSection.tsx`

- [ ] **Step 1: Implement TrainerDrillsSection**

Mirror the coordinator's `ClassDrillsSection.tsx` pattern but using trainer self-service endpoints (`api.selfService.createDrill`, `updateDrill`, `deleteDrill`). Features:
- Table: name, type (drill/test), par time, target score, active status, actions
- Inline add/edit form (toggle visibility)
- Delete with `ConfirmDialog`
- Toggle active/inactive inline
- Uses `useTrainerClassDetail()` for drill data and `refreshDrills()` after mutations
- Form stores par time and target score as strings (NaN guard on save)

Follow the exact same UX patterns as `ClassDrillsSection.tsx` — the only difference is the API calls go through `api.selfService.*` instead of `api.drills.*`.

- [ ] **Step 2: Verify and commit**

```bash
git add web/src/pages/TrainerClassDetail/TrainerDrillsSection.tsx
git commit -m "feat(trainer): implement Drills tab with create/edit/delete"
```

---

## Task 13: Frontend — Reports tab section

**Files:**
- Modify: `web/src/pages/TrainerClassDetail/TrainerReportsSection.tsx`

- [ ] **Step 1: Implement TrainerReportsSection**

This is the most complex component. Mirror the coordinator's `ClassReportsSection.tsx` (mode="reports") but using trainer self-service endpoints. Features:

**Report list:**
- Table/card list of reports (date, session label, group, status badge)
- Click to edit → loads full report via `api.selfService.classReportDetail()`

**Report create/edit form (same sections as coordinator):**
- Header fields: date, group label, game, session label, class start/end time, M&G counts, trainee count, licenses
- Trainers present: checkboxes (auto-include self). Note: trainer only sees themselves as a trainer option since they can't see other class trainers via the self-service endpoint. The `classInfo.trainer_id` is used.
- Hours totals with override fields
- Training timeline (drag-and-drop reorderable)
- Per-trainee progress: ratings (GK, Dex, HoM), progress notes, homework, coming back, attendance checkboxes
- Drill times: per-student results for each active drill

**Actions:**
- Save as draft
- Finalize
- View PDF (using existing `ReportPreviewModal`)
- Delete with confirmation

Uses `useTrainerClassDetail()` for enrollments, drills, reports data. Calls `refreshReports()` after mutations.

The API calls use:
- `api.selfService.createReport(classId, body)`
- `api.selfService.updateReport(classId, reportId, body)`
- `api.selfService.finalizeReport(classId, reportId)`

**Implementation note:** This component will be large (~800-1000 lines). Consider whether it can reuse the existing `ClassReportsSection` by passing a different API adapter, or if it needs to be a copy. Given the coordinator version has specific coordinator-only features (hours mode, coordinator-specific layout), a separate component is cleaner but should follow the same patterns.

- [ ] **Step 2: Verify and commit**

```bash
git add web/src/pages/TrainerClassDetail/TrainerReportsSection.tsx
git commit -m "feat(trainer): implement Reports tab with create/edit/finalize and full form"
```

---

## Task 14: Frontend — Hours tab section

**Files:**
- Modify: `web/src/pages/TrainerClassDetail/TrainerHoursSection.tsx`

- [ ] **Step 1: Implement TrainerHoursSection**

Two sub-sections toggled by a tab bar:

**"My Hours" sub-section:**
- Table of trainer's own hours: date, hours, paid, live training, notes, actions
- Add/edit form: date picker, hours input, paid checkbox, live training checkbox, notes
- Delete with confirmation
- Total hours display at top
- Uses `api.selfService.createHours(classId, { person_type: 'trainer', ... })`

**"Student Hours" sub-section:**
- Table of all student hours: date, student name, hours, paid, live training, notes, actions
- Individual add: select student dropdown, date, hours, etc.
- Bulk add: date picker, table of all enrolled students with hours input per student, shared paid/live_training flags → calls `api.selfService.createHoursBulk()`
- Edit/delete individual entries
- Uses `useTrainerClassDetail()` for enrollments (to populate student dropdown), trainerHours, studentHours

Follow the coordinator `ClassReportsSection` mode="hours" pattern for the individual entry CRUD. The bulk entry UI is new — render a table with one row per enrolled student, an hours input column, and a "Log All" button.

- [ ] **Step 2: Verify and commit**

```bash
git add web/src/pages/TrainerClassDetail/TrainerHoursSection.tsx
git commit -m "feat(trainer): implement Hours tab with individual and bulk logging"
```

---

## Task 15: Frontend — Cross-class pages (Reports, Schedule, Hours)

**Files:**
- Modify: `web/src/pages/TrainerReportsPage.tsx`
- Modify: `web/src/pages/TrainerSchedulePage.tsx`
- Modify: `web/src/pages/TrainerHoursPage.tsx`

- [ ] **Step 1: Implement TrainerReportsPage**

Paginated list of reports across all assigned classes. Follow the coordinator `ReportsPage.tsx` pattern:
- Filter bar: class dropdown (from `useTrainer()` classes), date range, status
- Sortable table: date, class name, session label, group, status badge
- Pagination (50 per page)
- Click → navigate to `/my-classes/:classId` with reports tab (or open inline detail)
- Uses `api.selfService.allReports(params)`

- [ ] **Step 2: Implement TrainerSchedulePage**

Schedule across all assigned classes. Follow coordinator `SchedulePage.tsx` pattern:
- Filter bar: class dropdown, date range, group label
- Table: date, time, class name, group, notes
- Pagination (50 per page)
- Uses `api.selfService.allSchedule(params)`

- [ ] **Step 3: Implement TrainerHoursPage**

Personal hours overview. Shows:
- Summary stat cards at top: total hours, paid hours, unpaid hours
- Filter bar: class dropdown, date range
- Table: date, class name, hours, paid, live training, notes
- Pagination (50 per page)
- Read-only (editing happens within class detail)
- Uses `api.selfService.allHours(params)`

- [ ] **Step 4: Verify and commit**

```bash
git add web/src/pages/TrainerReportsPage.tsx web/src/pages/TrainerSchedulePage.tsx web/src/pages/TrainerHoursPage.tsx
git commit -m "feat(trainer): implement cross-class Reports, Schedule, and Hours pages"
```

---

## Task 16: Frontend — DashboardView role routing fix

**Files:**
- Modify: `web/src/pages/DashboardView.tsx` (if needed)

- [ ] **Step 1: Ensure DashboardView routes trainers to TrainerDashboard**

Check `web/src/pages/DashboardView.tsx` to see how it currently routes by role. It should render `TrainerDashboard` for `role === 'trainer'`. If it already does this, no changes needed. If not, add the trainer case.

The `TrainerDashboard.tsx` component (enhanced in Task 8) is used here.

- [ ] **Step 2: Verify and commit (only if changes were needed)**

```bash
git add web/src/pages/DashboardView.tsx
git commit -m "fix(trainer): ensure DashboardView renders TrainerDashboard for trainer role"
```

---

## Task 17: Final verification and cleanup

- [ ] **Step 1: Full TypeScript check**

Run: `cd /home/gtse8/GatewayTrainingTool && cd server && npx tsc --noEmit && cd ../web && npx tsc --noEmit`
Expected: No type errors in either project

- [ ] **Step 2: Run the dev server and test manually**

Run: `cd /home/gtse8/GatewayTrainingTool && npm run dev` (or whatever the dev command is)

Test as a trainer user:
1. Login with a trainer account
2. Verify sidebar appears with correct nav items
3. Navigate through each page: Dashboard, My Classes, class detail tabs, Reports, Schedule, Hours
4. Create a report, log hours, create a drill
5. Test mobile layout (resize browser or use devtools)

- [ ] **Step 3: Verify coordinator view is unaffected**

Login as coordinator and verify all existing pages still work correctly.

- [ ] **Step 4: Final commit if any cleanup was needed**

```bash
git add -A
git commit -m "feat(trainer): trainer view implementation complete"
```
