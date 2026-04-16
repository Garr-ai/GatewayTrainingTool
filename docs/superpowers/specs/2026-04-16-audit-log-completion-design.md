# Audit Log Completion — Design Spec

**Date:** 2026-04-16
**Status:** Draft (pending user review)
**Scope:** Finish the partially-implemented audit log: close coverage gaps, formalize the migration, extend `logAudit` for before/after snapshots on sensitive tables, and build a coordinator-only viewer (per-record drawer + global page).

---

## 1. Goals & non-goals

**Goals**

- **Compliance / dispute defense.** Every mutation in the system produces an audit event. The log is immutable and complete when asked for.
- **Coordinator troubleshooting.** Coordinators can answer "who changed this record?" in a few clicks, and see *what exactly* changed on sensitive tables.

**Non-goals (explicit)**

- No active oversight UI — no anomaly detection, no notifications, no real-time feed.
- No self-view for trainers/students on their own audit trail. Coordinator-only viewer.
- No new admin role tier. Coordinator role is sufficient.
- No retention / archival job. Keep events forever; revisit only on a cost signal.
- No audit of `READ` actions. The `READ` enum value stays reserved for future use but is not written by any route in this spec.
- No soft-delete flags on domain records (flagged as open question for later work).

---

## 2. Current state (what already exists)

- `server/src/lib/audit.ts` exports `logAudit({ userId, action, tableName, recordId, metadata?, ipAddress? })`. Never throws; logs to stderr on insert error.
- Called from ~25 sites across `reports.ts`, `selfService.ts`, `roleRequests.ts`, `profiles.ts`, `hours.ts`, `autoFail.ts`.
- `audit_logs` table exists ad-hoc in Supabase but has **no migration file in the repo** (only a stale comment referencing `supabase/migrations/002_audit_logs.sql` which does not exist).
- **No UI** to view audit events anywhere.
- **Coverage gaps** — the following route files have mutations that do not call `logAudit`:
  - `classes.ts`, `trainers.ts`, `drills.ts`, `schedule.ts`, `enrollments.ts` (~37 mutations total)

---

## 3. Design decisions (locked)

| Decision | Choice |
|---|---|
| Primary use case | Compliance + coordinator troubleshooting (no active oversight) |
| What to capture | Event metadata always; before/after snapshots on sensitive tables only |
| Sensitive tables | `class_daily_reports`, `class_daily_report_trainee_progress`, `class_logged_hours`, `profiles` |
| Viewer placement | Per-record drawer **and** global page |
| Who can view | Coordinators only |
| Instrumentation style | Explicit `logAudit()` calls with an extended signature (not Postgres triggers) |

---

## 4. Schema & migration

New migration: `server/src/migrations/009_audit_logs.sql`.

```sql
create table if not exists audit_logs (
  id           bigserial primary key,
  user_id      uuid not null references auth.users(id),
  action       text not null check (action in ('CREATE','READ','UPDATE','DELETE')),
  table_name   text not null,
  record_id    text not null,
  before_row   jsonb,            -- null for CREATE; populated on sensitive UPDATE/DELETE
  after_row    jsonb,            -- null for DELETE; populated on sensitive CREATE/UPDATE
  metadata     jsonb,
  ip_address   text,
  created_at   timestamptz not null default now()
);

-- Additive-only alters for environments where the table already exists
alter table audit_logs add column if not exists before_row jsonb;
alter table audit_logs add column if not exists after_row  jsonb;

create index if not exists audit_logs_record_idx   on audit_logs(table_name, record_id, created_at desc);
create index if not exists audit_logs_user_idx     on audit_logs(user_id, created_at desc);
create index if not exists audit_logs_created_idx  on audit_logs(created_at desc);

alter table audit_logs enable row level security;

drop policy if exists audit_logs_select_coordinator on audit_logs;
create policy audit_logs_select_coordinator on audit_logs
  for select using (
    exists (
      select 1 from profiles p
      where p.id = auth.uid() and p.role = 'coordinator'
    )
  );

-- Append-only at the DB level. Service role still inserts via server (bypasses RLS for INSERT).
revoke update, delete on audit_logs from service_role, authenticated, anon;
```

**Manual check before shipping:** compare the current Supabase DDL against the migration. If column names or types diverge, adjust the additive `alter` statements before running.

---

## 5. Server changes

### 5.1 Extend `logAudit` signature

`server/src/lib/audit.ts`:

```ts
export type AuditAction = 'CREATE' | 'READ' | 'UPDATE' | 'DELETE'

export const SENSITIVE_TABLES = [
  'class_daily_reports',
  'class_daily_report_trainee_progress',
  'class_logged_hours',
  'profiles',
] as const
export type SensitiveTable = typeof SENSITIVE_TABLES[number]

interface AuditEntry {
  userId: string
  action: AuditAction
  tableName: string
  recordId: string
  before?: Record<string, unknown> | null
  after?: Record<string, unknown> | null
  metadata?: Record<string, unknown>
  ipAddress?: string
}
```

- Backwards-compatible: existing 25 call sites type-check unchanged.
- **Missing-snapshot guard:** if `SENSITIVE_TABLES.includes(tableName)` and the required snapshot is absent for the action, `logAudit` emits `console.error('[audit] missing snapshot', { tableName, action, recordId })` but **still writes the event row**. The event stream stays complete; the gap is surfaced in logs.
- `logAudit` continues to never throw (existing contract per `AGENT_GUIDE.md`).

### 5.2 Close coverage gaps

Add `logAudit` calls to every mutation in:

| Route file | Mutations |
|---|---|
| `classes.ts` | POST, PUT, DELETE |
| `trainers.ts` | POST, PUT, DELETE |
| `drills.ts` | POST, PUT, DELETE |
| `schedule.ts` | POST, PUT, DELETE (coordinator-side) |
| `enrollments.ts` | POST (enroll), PUT (if any), DELETE (unenroll) |

For sensitive-table sites in `reports.ts`, `hours.ts`, `profiles.ts`, `selfService.ts`:
- UPDATE/DELETE handlers pre-read the row to capture `before` (the pre-read also doubles as existence/authorization check — keep it **outside** any `try/catch` that silences audit errors).
- CREATE handlers pass the inserted row as `after`.

### 5.3 Viewer API

New file: `server/src/routes/audit.ts`, mounted under `requireCoordinator` in `routes/index.ts`.

| Method | Path | Query params | Purpose |
|---|---|---|---|
| GET | `/audit/record/:tableName/:recordId` | `cursor?, limit?` | Per-record history for the drawer |
| GET | `/audit` | `userId?, tableName?, action?, from?, to?, cursor?, limit?` | Global feed |

- `limit` default 50, max 200.
- Pagination: keyset cursor over `(created_at desc, id desc)`, base64-encoded. Stable across inserts, cheaper than `OFFSET`.
- Both endpoints return `{ entries: AuditEntryDTO[], nextCursor: string | null }`.
- Empty result is `{ entries: [], nextCursor: null }` — never 404. Drawer renders an empty state cleanly.
- 400 on malformed cursor. 403 if somehow a non-coordinator slips past middleware (RLS backstops this).

**DTO shape:**

```ts
type AuditEntryDTO = {
  id: number
  userId: string
  userEmail: string | null    // joined from profiles for display
  action: AuditAction
  tableName: string
  recordId: string
  before: Record<string, unknown> | null
  after: Record<string, unknown> | null
  metadata: Record<string, unknown> | null
  ipAddress: string | null
  createdAt: string
}
```

---

## 6. Viewer UI

### 6.1 Per-record history drawer

New component: `web/src/components/AuditHistoryDrawer.tsx`. Slide-in panel (matches existing drawer idioms; falls back to a modal if no drawer primitive exists in the codebase).

**Placements** — one "History" button on each of:

- `ClassDetailView` → `classes / :classId`
- Report edit / detail (`ReportEditForm` or parent page) → `class_daily_reports / :reportId`
- Hours edit (`PayrollTable` row) → `class_logged_hours / :hoursId`
- Profile edit (`StudentSettingsPage` / coordinator profile edit) → `profiles / :userId`
- Roster row → enrollment record

**Drawer content**

- Header: table name, record ID, total event count
- Event list, newest first. Each row: timestamp · actor email · action badge (color-coded per CREATE/UPDATE/DELETE) · compact summary line
- Expand a row → render field-level diff from `before`/`after` if present; otherwise render `metadata` JSON
- Infinite scroll via `nextCursor`
- No real-time refresh — read on open

### 6.2 Global audit page

New page: `web/src/pages/AuditLogPage.tsx`. Route `/audit`, nav entry in `CoordinatorLayout`.

- Filter bar (reuses patterns from `ReportsFilterBar`): User typeahead · Table dropdown · Action multi-select · Date range
- Results table: timestamp · actor · action · table · record ID · summary · "View" → opens `AuditHistoryDrawer` scoped to that record
- Pagination via same `nextCursor` keyset

### 6.3 Diff rendering

`web/src/lib/auditDiff.ts`:

```ts
type FieldDiff = { field: string; before: unknown; after: unknown; kind: 'added' | 'removed' | 'changed' }
export function diffRows(
  before: Record<string, unknown> | null,
  after: Record<string, unknown> | null,
): FieldDiff[]
```

- Shallow diff over top-level keys, stable key order, skips structurally-equal values.
- Nested JSON columns rendered as collapsed JSON with line-level highlighting (stringify + line diff is fine for v1 — no deep-diff library).
- Ignores noise fields: `updated_at`, `created_at`.

### 6.4 Client API

Extend `web/src/lib/api.ts`:

```ts
api.audit.getForRecord(table, recordId, cursor?) → { entries, nextCursor }
api.audit.search({ userId?, tableName?, action?, from?, to?, cursor?, limit? }) → { entries, nextCursor }
```

Both use the existing authenticated `fetch` wrapper.

---

## 7. Permissions & immutability

- Route guards: `/audit/*` mounts behind `requireCoordinator`, same chain as `/classes`, `/reports`.
- RLS defense-in-depth: `audit_logs_select_coordinator` policy blocks non-coordinator reads even if a future route uses the anon key by accident.
- Service-role INSERT bypasses RLS (existing pattern for all server writes).
- `REVOKE UPDATE, DELETE ON audit_logs` — append-only at DB level.
- Application guard: a test asserts `grep -r "from('audit_logs')" server/src` yields only `.insert(` and `.select(` usages.

---

## 8. Error handling

- `logAudit()` never throws (existing contract). Primary operations never roll back on audit-write failure.
- Missing-snapshot on sensitive tables → structured `console.error`, event still written without snapshot.
- Sensitive-table pre-read failure → the route fails the whole operation (the pre-read also validates existence/authorization; skipping it would risk both audit gaps and authorization bugs).
- Viewer API: 400 on malformed cursor; empty result returns `{ entries: [], nextCursor: null }`, not 404.

---

## 9. Testing

Assumes a test runner is already set up in the repo; if not, the route-coverage test becomes a lint-style script. Verify before implementation.

- **Unit** — `diffRows` (empty/null inputs, added/removed/changed, noise-field skipping); cursor encode/decode round-trip.
- **Audit writer** — `logAudit` with stubbed supabase client: returns on insert error; emits missing-snapshot error for a sensitive table without snapshots.
- **Route coverage test** — greps every mutation handler and asserts `logAudit(` is present. Regression guard against the "forget to audit a new route" failure mode.
- **Viewer API integration** — insert synthetic audit rows, hit `/audit` with filters and pagination, assert keyset stability across inserts.
- **Permissions** — `/audit` as trainer/student → 403; as coordinator → 200.
- **Manual QA** — edit a daily report → drawer shows CREATE + UPDATE diff; delete a class → global page shows DELETE with `before_row`; filter by action/user → correct subsets; non-coordinator login → no `/audit` nav, drawer unreachable.

---

## 10. Rollout

1. Run `009_audit_logs.sql` in Supabase (idempotent against existing table; manual DDL diff first).
2. Deploy server changes. Signature extension is backwards-compatible; all existing call sites keep working.
3. Close coverage gaps (one PR per route file, or bundled — implementer's preference).
4. Deploy frontend (drawer + global page).
5. Verify manually on prod with one edit to a non-sensitive record (create a drill) and one to a sensitive record (edit a daily report).

---

## 11. Risks & mitigations

| Risk | Mitigation |
|---|---|
| Sensitive-table pre-read adds a query per mutation | Low-volume routes; acceptable. Profile only if flagged. |
| A new route added later without `logAudit` | Route coverage test + `AGENT_GUIDE.md` rule. |
| `before` captured from stale read during concurrent writes | Accept — the audit records this request's intended change. Row lock is over-engineering. |
| `before_row` / `after_row` inflate table size | Only 4 tables; indexed for per-record reads. Monitor size; add retention if needed later. |
| RLS blocks a coordinator mid-role-transition | Acceptable edge case. |
| Existing Supabase `audit_logs` DDL diverges from migration | Manual DDL diff before running. Additive `alter ... if not exists` pattern. |

---

## 12. Open questions for future work

- Soft-delete flags on domain records to let UIs render "deleted by X on Y" inline, without opening the drawer.
- Self-view for trainers/students on their own history if users ask for it.
- Retention / archival policy once storage volume warrants it.
