# Audit Log Completion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Finish the partially-implemented audit log: formalize the migration, extend `logAudit` for before/after snapshots on sensitive tables, close coverage gaps across all mutation routes, and build a coordinator-only viewer (per-record drawer + global page).

**Architecture:** Server-side, keep the existing explicit `logAudit()` pattern but extend its signature to accept `before`/`after` JSON snapshots and enforce per-action snapshot expectations on a fixed list of sensitive tables. New migration formalizes the `audit_logs` table and makes it append-only via RLS + REVOKE. New coordinator-only API (`GET /audit`, `GET /audit/record/:tableName/:recordId`) exposes the log with keyset pagination. Frontend adds a reusable `AuditHistoryDrawer` placed on each audited entity page plus a global `/audit` page.

**Tech Stack:** TypeScript, Express 4, Supabase/PostgreSQL, React 19 + Vite + Tailwind, Supabase JS client.

**Testing note:** This codebase has no test runner set up. Verification relies on `tsc` (type-check), small Node scripts for coverage/immutability asserts, and the Manual QA checklist at the end. Adding vitest/jest is out of scope.

**Spec reference:** `docs/superpowers/specs/2026-04-16-audit-log-completion-design.md`

---

## File Structure

**New files:**
- `server/src/migrations/009_audit_logs.sql` — formalize table, RLS, revokes
- `server/src/routes/audit.ts` — viewer API (`GET /audit`, `GET /audit/record/...`)
- `server/src/lib/auditCursor.ts` — keyset cursor encode/decode
- `server/scripts/verify-audit-coverage.ts` — fails if any mutation handler lacks `logAudit(`
- `server/scripts/verify-audit-immutability.ts` — fails if any non-insert/non-select op touches `audit_logs`
- `web/src/lib/auditDiff.ts` — row diff helper
- `web/src/components/AuditHistoryDrawer.tsx` — reusable drawer
- `web/src/components/HistoryButton.tsx` — small button that opens the drawer for a given `(tableName, recordId)`
- `web/src/pages/AuditLogPage.tsx` — global coordinator-only page

**Modified files:**
- `server/src/lib/audit.ts` — extend signature + `SENSITIVE_TABLES` + missing-snapshot guard
- `server/src/routes/index.ts` — mount `auditRouter` under `requireCoordinator`
- `server/src/routes/classes.ts`, `trainers.ts`, `drills.ts`, `schedule.ts`, `enrollments.ts` — add `logAudit` calls (coverage closure)
- `server/src/routes/reports.ts`, `hours.ts`, `profiles.ts`, `selfService.ts` — pass `before`/`after` on sensitive-table mutations
- `web/src/lib/apiClient.ts` — add `api.audit.*`
- `web/src/types/*` — export `AuditEntry` / `AuditAction` types
- `web/src/components/CoordinatorLayout.tsx` — nav entry for `/audit`
- `web/src/App.tsx` — route for `/audit`
- `web/src/pages/ClassDetailView.tsx`, report edit page, `PayrollTable.tsx`, `StudentSettingsPage.tsx`, roster row — drop in `<HistoryButton tableName="..." recordId={...} />`

---

## Task 1: Create the migration

**Files:**
- Create: `server/src/migrations/009_audit_logs.sql`

- [ ] **Step 1: Write migration**

```sql
-- 009_audit_logs.sql
-- Formalizes the audit_logs table. Idempotent against environments where
-- a previous ad-hoc version exists.

create table if not exists audit_logs (
  id           bigserial primary key,
  user_id      uuid not null references auth.users(id),
  action       text not null,
  table_name   text not null,
  record_id    text not null,
  metadata     jsonb,
  ip_address   text,
  created_at   timestamptz not null default now()
);

-- Additive columns for the hybrid snapshot behavior on sensitive tables
alter table audit_logs add column if not exists before_row jsonb;
alter table audit_logs add column if not exists after_row  jsonb;

-- Tighten the action check if it isn't already in place
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'audit_logs_action_check'
  ) then
    alter table audit_logs
      add constraint audit_logs_action_check
      check (action in ('CREATE','READ','UPDATE','DELETE'));
  end if;
end$$;

create index if not exists audit_logs_record_idx
  on audit_logs(table_name, record_id, created_at desc);
create index if not exists audit_logs_user_idx
  on audit_logs(user_id, created_at desc);
create index if not exists audit_logs_created_idx
  on audit_logs(created_at desc);

alter table audit_logs enable row level security;

drop policy if exists audit_logs_select_coordinator on audit_logs;
create policy audit_logs_select_coordinator on audit_logs
  for select using (
    exists (
      select 1 from profiles p
      where p.id = auth.uid() and p.role = 'coordinator'
    )
  );

-- Append-only at the DB level. Server inserts use the service-role key,
-- which bypasses RLS for INSERT. UPDATE/DELETE are revoked from every role.
revoke update, delete on audit_logs from service_role;
revoke update, delete on audit_logs from authenticated;
revoke update, delete on audit_logs from anon;
```

- [ ] **Step 2: Manual DDL diff** — compare current Supabase DDL against the migration. If column names/types diverge, adjust the additive `alter` statements before running. Document result in the PR description.

- [ ] **Step 3: Run in Supabase SQL editor** against the target environment.

- [ ] **Step 4: Commit**

```bash
git add server/src/migrations/009_audit_logs.sql
git commit -m "feat(audit): add 009_audit_logs migration with RLS and append-only revokes"
```

---

## Task 2: Extend `logAudit` signature and add sensitive-table guard

**Files:**
- Modify: `server/src/lib/audit.ts` (full rewrite — small file)

- [ ] **Step 1: Rewrite `server/src/lib/audit.ts`**

```ts
import { supabase } from './supabase'

export type AuditAction = 'CREATE' | 'READ' | 'UPDATE' | 'DELETE'

export const SENSITIVE_TABLES = [
  'class_daily_reports',
  'class_daily_report_trainee_progress',
  'class_logged_hours',
  'profiles',
] as const
export type SensitiveTable = (typeof SENSITIVE_TABLES)[number]

export interface AuditEntry {
  userId: string
  action: AuditAction
  tableName: string
  recordId: string
  before?: Record<string, unknown> | null
  after?: Record<string, unknown> | null
  metadata?: Record<string, unknown>
  ipAddress?: string
}

function isSensitive(tableName: string): tableName is SensitiveTable {
  return (SENSITIVE_TABLES as readonly string[]).includes(tableName)
}

function checkSnapshotExpectations(entry: AuditEntry): string | null {
  if (!isSensitive(entry.tableName)) return null
  switch (entry.action) {
    case 'CREATE':
      if (entry.after == null) return 'CREATE on sensitive table requires after'
      if (entry.before != null) return 'CREATE on sensitive table must not include before'
      return null
    case 'UPDATE':
      if (entry.before == null) return 'UPDATE on sensitive table requires before'
      if (entry.after == null)  return 'UPDATE on sensitive table requires after'
      return null
    case 'DELETE':
      if (entry.before == null) return 'DELETE on sensitive table requires before'
      if (entry.after != null)  return 'DELETE on sensitive table must not include after'
      return null
    case 'READ':
      return null
  }
}

/**
 * Write an immutable audit log entry. Never throws — an audit write failure
 * must NOT roll back the primary operation. Failures log to stderr.
 *
 * On sensitive tables (SENSITIVE_TABLES), callers must supply before/after
 * per action. Missing snapshots are logged to stderr but the event row is
 * still written (keeps the event stream complete while surfacing the bug).
 */
export async function logAudit(entry: AuditEntry): Promise<void> {
  const violation = checkSnapshotExpectations(entry)
  if (violation) {
    console.error('[audit] missing snapshot:', violation, {
      tableName: entry.tableName,
      action: entry.action,
      recordId: entry.recordId,
    })
  }
  try {
    const { error } = await supabase.from('audit_logs').insert({
      user_id: entry.userId,
      action: entry.action,
      table_name: entry.tableName,
      record_id: entry.recordId,
      before_row: entry.before ?? null,
      after_row: entry.after ?? null,
      metadata: entry.metadata ?? null,
      ip_address: entry.ipAddress ?? null,
    })
    if (error) {
      console.error('[audit] Failed to write audit log:', error.message, entry)
    }
  } catch (err) {
    console.error('[audit] Unexpected error writing audit log:', err, entry)
  }
}
```

- [ ] **Step 2: Type-check**

Run: `cd server && npx tsc --noEmit`
Expected: no errors. Existing call sites still type-check (new fields are optional).

- [ ] **Step 3: Commit**

```bash
git add server/src/lib/audit.ts
git commit -m "feat(audit): extend logAudit with before/after and sensitive-table guard"
```

---

## Task 3: Enrich `reports.ts` sensitive-table call sites

The 3 existing `logAudit` calls in `reports.ts` touch `class_daily_reports` (sensitive). Add `before`/`after` to each. For CREATE, pass the inserted row. For UPDATE, pre-read the row, then pass old as `before` and final as `after`. For DELETE, pre-read the row and pass as `before`.

**Files:**
- Modify: `server/src/routes/reports.ts:340-355` (POST — CREATE)
- Modify: `server/src/routes/reports.ts:488-500` (PUT — UPDATE)
- Modify: `server/src/routes/reports.ts:524-535` (DELETE)

(Use `grep -n "logAudit" server/src/routes/reports.ts` to re-confirm exact line numbers.)

- [ ] **Step 1: POST — add `after` snapshot**

In the POST handler, the inserted report row is already available as `report`. Change the `logAudit` call to:

```ts
await logAudit({
  userId: req.userId!,
  action: 'CREATE',
  tableName: 'class_daily_reports',
  recordId: reportId,
  after: report as unknown as Record<string, unknown>,
  metadata: { class_id: req.params.classId, report_date },
  ipAddress: req.ip,
})
```

- [ ] **Step 2: PUT — pre-read `before` and pass `after`**

Just before the existing update logic, add a pre-read. Place this read *outside* the try/catch that silences audit errors — failure to pre-read should fail the whole request.

```ts
const { data: beforeRow, error: beforeErr } = await supabase
  .from('class_daily_reports')
  .select('*')
  .eq('id', req.params.id)
  .single()
if (beforeErr || !beforeRow) {
  res.status(404).json({ error: 'Report not found' })
  return
}
```

Then after the update completes and you have the updated `report` row, call:

```ts
await logAudit({
  userId: req.userId!,
  action: 'UPDATE',
  tableName: 'class_daily_reports',
  recordId: req.params.id as string,
  before: beforeRow as unknown as Record<string, unknown>,
  after: report as unknown as Record<string, unknown>,
  metadata: { class_id: req.params.classId },
  ipAddress: req.ip,
})
```

- [ ] **Step 3: DELETE — pre-read `before`**

Before the delete query, add:

```ts
const { data: beforeRow, error: beforeErr } = await supabase
  .from('class_daily_reports')
  .select('*')
  .eq('id', req.params.id)
  .single()
if (beforeErr || !beforeRow) {
  res.status(404).json({ error: 'Report not found' })
  return
}
```

Then the `logAudit` call becomes:

```ts
await logAudit({
  userId: req.userId!,
  action: 'DELETE',
  tableName: 'class_daily_reports',
  recordId: req.params.id as string,
  before: beforeRow as unknown as Record<string, unknown>,
  metadata: { class_id: req.params.classId },
  ipAddress: req.ip,
})
```

- [ ] **Step 4: Also enrich any `class_daily_report_trainee_progress` call sites** in the same file (if any) following the same CREATE/UPDATE/DELETE pattern. The `class_daily_report_trainee_progress` table is sensitive, so the same guard applies.

- [ ] **Step 5: Type-check**

Run: `cd server && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add server/src/routes/reports.ts
git commit -m "feat(audit): capture before/after snapshots on class_daily_reports routes"
```

---

## Task 4: Enrich `hours.ts` sensitive-table call sites

All 3 `logAudit` calls in `hours.ts` touch `class_logged_hours` (sensitive).

**Files:**
- Modify: `server/src/routes/hours.ts` (3 sites — use `grep -n logAudit server/src/routes/hours.ts` for exact lines)

- [ ] **Step 1: POST — pass `after`**

The inserted row is already returned by Supabase in the existing handler. Update the `logAudit` call to include `after: insertedRow as unknown as Record<string, unknown>`.

- [ ] **Step 2: PUT — pre-read `before`, pass `after`**

Pre-read identical in shape to Task 3 Step 2, but querying `class_logged_hours`:

```ts
const { data: beforeRow, error: beforeErr } = await supabase
  .from('class_logged_hours')
  .select('*')
  .eq('id', req.params.id)
  .single()
if (beforeErr || !beforeRow) {
  res.status(404).json({ error: 'Hours row not found' })
  return
}
```

Pass `before: beforeRow, after: updatedRow` in the `logAudit` call.

- [ ] **Step 3: DELETE — pre-read `before`**

Same pre-read as Step 2. Pass `before: beforeRow` in the `logAudit` call.

- [ ] **Step 4: Type-check**

Run: `cd server && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add server/src/routes/hours.ts
git commit -m "feat(audit): capture before/after snapshots on class_logged_hours routes"
```

---

## Task 5: Enrich `profiles.ts` sensitive-table call sites

Both `logAudit` calls in `profiles.ts` touch `profiles` (sensitive).

**Files:**
- Modify: `server/src/routes/profiles.ts` (2 sites)

- [ ] **Step 1:** Apply the CREATE-or-UPDATE-or-DELETE pattern from Task 3 to each `logAudit` call in `profiles.ts`, pre-reading the profile row when needed. The pre-read query:

```ts
const { data: beforeRow, error: beforeErr } = await supabase
  .from('profiles')
  .select('*')
  .eq('id', profileId)
  .single()
if (beforeErr || !beforeRow) {
  res.status(404).json({ error: 'Profile not found' })
  return
}
```

- [ ] **Step 2: Type-check**

Run: `cd server && npx tsc --noEmit`

- [ ] **Step 3: Commit**

```bash
git add server/src/routes/profiles.ts
git commit -m "feat(audit): capture before/after snapshots on profile routes"
```

---

## Task 6: Enrich `selfService.ts` sensitive-table call sites

`selfService.ts` has 14 `logAudit` calls. Identify which touch sensitive tables by inspecting each call's `tableName` argument (`grep -n "tableName:" server/src/routes/selfService.ts`). Sensitive ones: `class_daily_reports`, `class_daily_report_trainee_progress`, `class_logged_hours`, `profiles`.

**Files:**
- Modify: `server/src/routes/selfService.ts` (subset of 14 sites — only sensitive ones)

- [ ] **Step 1:** For each sensitive-table `logAudit` call, apply the Task 3 pattern: pre-read for UPDATE/DELETE; attach `after` for CREATE. Use the same pre-read skeleton as Task 3 Step 2, swapping the table name.

- [ ] **Step 2: Sanity check**

Run: `grep -nE "tableName: '(class_daily_reports|class_daily_report_trainee_progress|class_logged_hours|profiles)'" server/src/routes/selfService.ts | wc -l`

Then confirm every match has a nearby `before:` or `after:` field in the same `logAudit` call.

- [ ] **Step 3: Type-check**

Run: `cd server && npx tsc --noEmit`

- [ ] **Step 4: Commit**

```bash
git add server/src/routes/selfService.ts
git commit -m "feat(audit): capture before/after snapshots on self-service sensitive routes"
```

---

## Task 7: Close coverage gap — `classes.ts`

**Files:**
- Modify: `server/src/routes/classes.ts` — add `logAudit` import and calls in POST, PUT, DELETE handlers.

- [ ] **Step 1:** Add import at the top of the file:

```ts
import { logAudit } from '../lib/audit'
```

- [ ] **Step 2: POST /classes** — after the insert succeeds and you have the inserted row:

```ts
await logAudit({
  userId: req.userId!,
  action: 'CREATE',
  tableName: 'classes',
  recordId: data.id,
  metadata: { name: data.name },
  ipAddress: req.ip,
})
```

(`classes` is **not** in `SENSITIVE_TABLES`, so no `before`/`after` required.)

- [ ] **Step 3: PUT /classes/:id** — after the update succeeds:

```ts
await logAudit({
  userId: req.userId!,
  action: 'UPDATE',
  tableName: 'classes',
  recordId: req.params.id as string,
  metadata: { updated_fields: Object.keys(req.body ?? {}) },
  ipAddress: req.ip,
})
```

- [ ] **Step 4: DELETE /classes/:id** — after the delete succeeds:

```ts
await logAudit({
  userId: req.userId!,
  action: 'DELETE',
  tableName: 'classes',
  recordId: req.params.id as string,
  ipAddress: req.ip,
})
```

- [ ] **Step 5: Type-check**

Run: `cd server && npx tsc --noEmit`

- [ ] **Step 6: Commit**

```bash
git add server/src/routes/classes.ts
git commit -m "feat(audit): log mutations on classes routes"
```

---

## Task 8: Close coverage gap — `trainers.ts`

**Files:**
- Modify: `server/src/routes/trainers.ts`

- [ ] **Step 1:** Add `import { logAudit } from '../lib/audit'`.

- [ ] **Step 2:** For each mutation handler (POST, PUT, DELETE), add a `logAudit` call right before sending the response. Use `tableName: 'class_trainers'` (confirm actual table name by inspecting the `.from(...)` call in the handler). Example for POST:

```ts
await logAudit({
  userId: req.userId!,
  action: 'CREATE',
  tableName: 'class_trainers',
  recordId: data.id,
  metadata: { class_id: req.params.classId, trainer_id: req.body.trainer_id },
  ipAddress: req.ip,
})
```

Mirror the pattern for PUT and DELETE with `recordId: req.params.id as string`.

- [ ] **Step 3: Type-check, commit**

```bash
cd server && npx tsc --noEmit
git add server/src/routes/trainers.ts
git commit -m "feat(audit): log mutations on trainers routes"
```

---

## Task 9: Close coverage gap — `drills.ts`

**Files:**
- Modify: `server/src/routes/drills.ts`

- [ ] **Step 1:** Same pattern as Task 8, with `tableName: 'class_drills'` (verify from the `.from(...)` call). Add to POST, PUT, DELETE.

- [ ] **Step 2: Type-check, commit**

```bash
cd server && npx tsc --noEmit
git add server/src/routes/drills.ts
git commit -m "feat(audit): log mutations on drills routes"
```

---

## Task 10: Close coverage gap — `schedule.ts`

**Files:**
- Modify: `server/src/routes/schedule.ts`

- [ ] **Step 1:** Same pattern, `tableName: 'class_schedule_slots'` (verify). Add to every coordinator-side mutation handler.

- [ ] **Step 2: Type-check, commit**

```bash
cd server && npx tsc --noEmit
git add server/src/routes/schedule.ts
git commit -m "feat(audit): log mutations on schedule routes"
```

---

## Task 11: Close coverage gap — `enrollments.ts`

**Files:**
- Modify: `server/src/routes/enrollments.ts`

- [ ] **Step 1:** Same pattern, `tableName: 'class_enrollments'` (verify). Add to POST (enroll), DELETE (unenroll), and any PUT handlers (status/role changes).

- [ ] **Step 2: Type-check, commit**

```bash
cd server && npx tsc --noEmit
git add server/src/routes/enrollments.ts
git commit -m "feat(audit): log mutations on enrollments routes"
```

---

## Task 12: Coverage verification script

**Files:**
- Create: `server/scripts/verify-audit-coverage.ts`

- [ ] **Step 1: Write the script**

```ts
/**
 * Fails if any mutation handler in server/src/routes is missing a logAudit( call.
 * A "mutation handler" is an arrow/callback registered on .post/.put/.patch/.delete.
 *
 * This is a heuristic — it looks inside handler function bodies for `logAudit(`.
 * Not perfect, but catches the "forgot to add audit" regression.
 */
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const routesDir = join(__dirname, '..', 'src', 'routes')
const files = readdirSync(routesDir).filter((f) => f.endsWith('.ts'))

let violations = 0

for (const file of files) {
  const src = readFileSync(join(routesDir, file), 'utf8')
  const handlerRegex = /\.(post|put|patch|delete)\(\s*['"`][^'"`]+['"`]\s*,\s*async[^\{]*\{([\s\S]*?)\n\}\)/g
  let m: RegExpExecArray | null
  while ((m = handlerRegex.exec(src)) !== null) {
    const method = m[1]
    const body = m[2]
    if (!body.includes('logAudit(')) {
      const precedingLine = src.slice(0, m.index).split('\n').length
      console.error(`[audit-coverage] ${file}:${precedingLine} ${method.toUpperCase()} handler missing logAudit(`)
      violations++
    }
  }
}

if (violations > 0) {
  console.error(`\n${violations} audit coverage violation(s)`)
  process.exit(1)
}
console.log('audit coverage OK')
```

- [ ] **Step 2: Add script entry** to `server/package.json`:

```json
"scripts": {
  "verify:audit-coverage": "tsx scripts/verify-audit-coverage.ts"
}
```

- [ ] **Step 3: Run it**

Run: `cd server && npm run verify:audit-coverage`
Expected: `audit coverage OK` (exit 0). If it reports false positives (e.g., a handler that legitimately has no mutation effect), adjust the handler's implementation to call `logAudit` with `action: 'READ'` OR add a line-level comment exemption — prefer adjusting the handler.

- [ ] **Step 4: Commit**

```bash
git add server/scripts/verify-audit-coverage.ts server/package.json
git commit -m "feat(audit): add coverage verification script"
```

---

## Task 13: Immutability verification script

**Files:**
- Create: `server/scripts/verify-audit-immutability.ts`

- [ ] **Step 1: Write the script**

```ts
/**
 * Fails if any server code calls update/delete/upsert on the audit_logs table.
 * The table is append-only; only .insert and .select are allowed.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

function* walk(dir: string): Generator<string> {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) yield* walk(p)
    else if (p.endsWith('.ts')) yield p
  }
}

const srcDir = join(__dirname, '..', 'src')
const forbiddenMethods = ['update', 'delete', 'upsert']

let violations = 0

for (const file of walk(srcDir)) {
  const src = readFileSync(file, 'utf8')
  // Find any occurrence like .from('audit_logs')... .update/.delete/.upsert
  const chunks = src.match(/\.from\(\s*['"]audit_logs['"]\s*\)[\s\S]{0,400}/g) ?? []
  for (const chunk of chunks) {
    for (const m of forbiddenMethods) {
      if (chunk.includes(`.${m}(`)) {
        console.error(`[audit-immutability] ${file} uses forbidden .${m}() on audit_logs`)
        violations++
      }
    }
  }
}

if (violations > 0) process.exit(1)
console.log('audit immutability OK')
```

- [ ] **Step 2: Add script entry**

```json
"scripts": {
  "verify:audit-immutability": "tsx scripts/verify-audit-immutability.ts"
}
```

- [ ] **Step 3: Run**

Run: `cd server && npm run verify:audit-immutability`
Expected: `audit immutability OK`.

- [ ] **Step 4: Commit**

```bash
git add server/scripts/verify-audit-immutability.ts server/package.json
git commit -m "feat(audit): add immutability verification script"
```

---

## Task 14: Keyset cursor helpers

**Files:**
- Create: `server/src/lib/auditCursor.ts`

- [ ] **Step 1: Write the helpers**

```ts
/**
 * Base64-encoded keyset cursor over (created_at DESC, id DESC).
 * Opaque to clients; server uses it to resume a page.
 */

export interface AuditCursor {
  createdAt: string  // ISO timestamp
  id: number
}

export function encodeCursor(c: AuditCursor): string {
  return Buffer.from(JSON.stringify(c), 'utf8').toString('base64url')
}

export function decodeCursor(raw: string): AuditCursor {
  let parsed: unknown
  try {
    parsed = JSON.parse(Buffer.from(raw, 'base64url').toString('utf8'))
  } catch {
    throw new Error('Invalid cursor')
  }
  if (
    typeof parsed !== 'object' || parsed === null ||
    typeof (parsed as AuditCursor).createdAt !== 'string' ||
    typeof (parsed as AuditCursor).id !== 'number'
  ) {
    throw new Error('Invalid cursor')
  }
  return parsed as AuditCursor
}
```

- [ ] **Step 2: Type-check + commit**

```bash
cd server && npx tsc --noEmit
git add server/src/lib/auditCursor.ts
git commit -m "feat(audit): keyset cursor helpers"
```

---

## Task 15: Viewer API (`auditRouter`)

**Files:**
- Create: `server/src/routes/audit.ts`
- Modify: `server/src/routes/index.ts`

- [ ] **Step 1: Write `server/src/routes/audit.ts`**

```ts
/**
 * server/src/routes/audit.ts — Coordinator-only audit log viewer API.
 *
 * Mounted behind requireCoordinator. Defense-in-depth: the audit_logs table
 * also has an RLS select policy that restricts reads to coordinators.
 */
import { Router, type Request, type Response, type NextFunction } from 'express'
import { supabase } from '../lib/supabase'
import { encodeCursor, decodeCursor } from '../lib/auditCursor'

export const auditRouter = Router()

type AuditEntryDTO = {
  id: number
  userId: string
  userEmail: string | null
  action: 'CREATE' | 'READ' | 'UPDATE' | 'DELETE'
  tableName: string
  recordId: string
  before: Record<string, unknown> | null
  after: Record<string, unknown> | null
  metadata: Record<string, unknown> | null
  ipAddress: string | null
  createdAt: string
}

interface RawRow {
  id: number
  user_id: string
  action: 'CREATE' | 'READ' | 'UPDATE' | 'DELETE'
  table_name: string
  record_id: string
  before_row: Record<string, unknown> | null
  after_row: Record<string, unknown> | null
  metadata: Record<string, unknown> | null
  ip_address: string | null
  created_at: string
  profiles?: { email: string | null } | null
}

function toDTO(r: RawRow): AuditEntryDTO {
  return {
    id: r.id,
    userId: r.user_id,
    userEmail: r.profiles?.email ?? null,
    action: r.action,
    tableName: r.table_name,
    recordId: r.record_id,
    before: r.before_row,
    after: r.after_row,
    metadata: r.metadata,
    ipAddress: r.ip_address,
    createdAt: r.created_at,
  }
}

function clampLimit(raw: unknown): number {
  const n = typeof raw === 'string' ? parseInt(raw, 10) : NaN
  if (!Number.isFinite(n) || n <= 0) return 50
  return Math.min(n, 200)
}

// Supabase PostgREST `.or()` composition — pick rows strictly before the cursor
// in (created_at DESC, id DESC) order. Tuple comparison approximated as:
//   created_at < X  OR  (created_at = X AND id < Y)
function cursorFilter(cursor: string): string {
  const { createdAt, id } = decodeCursor(cursor)
  return `created_at.lt.${createdAt},and(created_at.eq.${createdAt},id.lt.${id})`
}

/**
 * GET /audit/record/:tableName/:recordId
 * Per-record history. Query params: cursor?, limit?
 */
auditRouter.get(
  '/audit/record/:tableName/:recordId',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const limit = clampLimit(req.query.limit)
      let query = supabase
        .from('audit_logs')
        .select('*, profiles:user_id ( email )')
        .eq('table_name', req.params.tableName)
        .eq('record_id', req.params.recordId)
        .order('created_at', { ascending: false })
        .order('id', { ascending: false })
        .limit(limit + 1)
      if (typeof req.query.cursor === 'string') query = query.or(cursorFilter(req.query.cursor))
      const { data, error } = await query
      if (error) throw error
      const rows = (data ?? []) as RawRow[]
      const hasMore = rows.length > limit
      const page = hasMore ? rows.slice(0, limit) : rows
      const nextCursor =
        hasMore && page.length > 0
          ? encodeCursor({ createdAt: page[page.length - 1].created_at, id: page[page.length - 1].id })
          : null
      res.json({ entries: page.map(toDTO), nextCursor })
    } catch (err) {
      if (err instanceof Error && err.message === 'Invalid cursor') {
        res.status(400).json({ error: err.message })
        return
      }
      next(err)
    }
  },
)

/**
 * GET /audit
 * Global feed. Query params: userId?, tableName?, action?, from?, to?, cursor?, limit?
 */
auditRouter.get('/audit', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const limit = clampLimit(req.query.limit)
    let query = supabase
      .from('audit_logs')
      .select('*, profiles:user_id ( email )')
      .order('created_at', { ascending: false })
      .order('id', { ascending: false })
      .limit(limit + 1)
    if (typeof req.query.userId === 'string')    query = query.eq('user_id',    req.query.userId)
    if (typeof req.query.tableName === 'string') query = query.eq('table_name', req.query.tableName)
    if (typeof req.query.action === 'string')    query = query.eq('action',     req.query.action)
    if (typeof req.query.from === 'string')      query = query.gte('created_at', req.query.from)
    if (typeof req.query.to === 'string')        query = query.lte('created_at', req.query.to)
    query = applyCursor(query as never, req.query.cursor as string | undefined)
    const { data, error } = await query
    if (error) throw error
    const rows = (data ?? []) as RawRow[]
    const hasMore = rows.length > limit
    const page = hasMore ? rows.slice(0, limit) : rows
    const nextCursor =
      hasMore && page.length > 0
        ? encodeCursor({ createdAt: page[page.length - 1].created_at, id: page[page.length - 1].id })
        : null
    res.json({ entries: page.map(toDTO), nextCursor })
  } catch (err) {
    if (err instanceof Error && err.message === 'Invalid cursor') {
      res.status(400).json({ error: err.message })
      return
    }
    next(err)
  }
})
```

- [ ] **Step 2: Mount router** — edit `server/src/routes/index.ts`, add the import and mount **after** `requireCoordinator`:

```ts
import { auditRouter } from './audit'
// ...existing imports and setup...

// Add after the other coordinator routers, e.g. after roleRequestsRouter:
router.use(auditRouter)
```

- [ ] **Step 3: Type-check**

Run: `cd server && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Smoke test locally**

- Start server: `cd server && npm run dev`
- With a coordinator-session cookie/token, hit `GET /api/audit?limit=5` and `GET /api/audit/record/classes/<some-id>`
- Confirm 200 response with `{ entries, nextCursor }` shape
- With a trainer token, hit `GET /api/audit` — expect 403 from `requireCoordinator`

- [ ] **Step 5: Commit**

```bash
git add server/src/routes/audit.ts server/src/routes/index.ts
git commit -m "feat(audit): viewer API with per-record and global endpoints"
```

---

## Task 16: Client API extension + types

**Files:**
- Modify: `web/src/lib/apiClient.ts`
- Modify: `web/src/types/index.ts` (or wherever shared types live — inspect `web/src/types/`)

- [ ] **Step 1: Add shared types**

Add to the types file:

```ts
export type AuditAction = 'CREATE' | 'READ' | 'UPDATE' | 'DELETE'

export interface AuditEntry {
  id: number
  userId: string
  userEmail: string | null
  action: AuditAction
  tableName: string
  recordId: string
  before: Record<string, unknown> | null
  after: Record<string, unknown> | null
  metadata: Record<string, unknown> | null
  ipAddress: string | null
  createdAt: string
}

export interface AuditPage {
  entries: AuditEntry[]
  nextCursor: string | null
}
```

- [ ] **Step 2: Add `api.audit` in `apiClient.ts`**

Locate the `api` object literal and add a new group:

```ts
import type { AuditPage, AuditAction } from '../types'

// ...inside the api object:
audit: {
  getForRecord(tableName: string, recordId: string, cursor?: string, limit = 50): Promise<AuditPage> {
    const params = new URLSearchParams()
    if (cursor) params.set('cursor', cursor)
    params.set('limit', String(limit))
    return req<AuditPage>(`/audit/record/${encodeURIComponent(tableName)}/${encodeURIComponent(recordId)}?${params}`)
  },
  search(
    filters: {
      userId?: string
      tableName?: string
      action?: AuditAction
      from?: string
      to?: string
      cursor?: string
      limit?: number
    } = {},
  ): Promise<AuditPage> {
    const params = new URLSearchParams()
    for (const [k, v] of Object.entries(filters)) {
      if (v != null && v !== '') params.set(k, String(v))
    }
    const qs = params.toString()
    return req<AuditPage>(`/audit${qs ? `?${qs}` : ''}`)
  },
},
```

- [ ] **Step 3: Type-check**

Run: `cd web && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add web/src/lib/apiClient.ts web/src/types/
git commit -m "feat(audit): client API for audit log"
```

---

## Task 17: Row diff utility

**Files:**
- Create: `web/src/lib/auditDiff.ts`

- [ ] **Step 1: Write the utility**

```ts
export type DiffKind = 'added' | 'removed' | 'changed'

export interface FieldDiff {
  field: string
  before: unknown
  after: unknown
  kind: DiffKind
}

const NOISE_FIELDS = new Set(['created_at', 'updated_at'])

function structurallyEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true
  if (a == null || b == null) return a === b
  if (typeof a !== typeof b) return false
  if (typeof a !== 'object') return false
  try {
    return JSON.stringify(a) === JSON.stringify(b)
  } catch {
    return false
  }
}

/**
 * Shallow diff over top-level keys. Skips noise fields (created_at, updated_at)
 * and structurally-equal values. Keys are returned in sorted order for stability.
 */
export function diffRows(
  before: Record<string, unknown> | null,
  after: Record<string, unknown> | null,
): FieldDiff[] {
  const b = before ?? {}
  const a = after ?? {}
  const keys = new Set<string>([...Object.keys(b), ...Object.keys(a)])
  const out: FieldDiff[] = []
  for (const key of [...keys].sort()) {
    if (NOISE_FIELDS.has(key)) continue
    const hasBefore = Object.prototype.hasOwnProperty.call(b, key)
    const hasAfter = Object.prototype.hasOwnProperty.call(a, key)
    if (hasBefore && !hasAfter) {
      out.push({ field: key, before: b[key], after: undefined, kind: 'removed' })
    } else if (!hasBefore && hasAfter) {
      out.push({ field: key, before: undefined, after: a[key], kind: 'added' })
    } else if (!structurallyEqual(b[key], a[key])) {
      out.push({ field: key, before: b[key], after: a[key], kind: 'changed' })
    }
  }
  return out
}
```

- [ ] **Step 2: Type-check + commit**

```bash
cd web && npx tsc --noEmit
git add web/src/lib/auditDiff.ts
git commit -m "feat(audit): row diff utility for audit viewer"
```

---

## Task 18: `AuditHistoryDrawer` component

**Files:**
- Create: `web/src/components/AuditHistoryDrawer.tsx`
- Create: `web/src/components/HistoryButton.tsx`

- [ ] **Step 1: Inspect existing overlays** — open `web/src/components/ConfirmDialog.tsx` and any other modal/drawer component in the folder. Use whichever overlay pattern already exists as the container shape (fixed-position panel + backdrop). No new overlay library should be added.

- [ ] **Step 2: Write `HistoryButton.tsx`** — thin wrapper that opens the drawer:

```tsx
import { useState } from 'react'
import { AuditHistoryDrawer } from './AuditHistoryDrawer'

interface Props {
  tableName: string
  recordId: string
  label?: string
  className?: string
}

export function HistoryButton({ tableName, recordId, label = 'History', className = '' }: Props) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`text-sm text-gray-600 hover:text-gray-900 underline ${className}`}
      >
        {label}
      </button>
      {open && (
        <AuditHistoryDrawer
          tableName={tableName}
          recordId={recordId}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  )
}
```

- [ ] **Step 3: Write `AuditHistoryDrawer.tsx`**

```tsx
import { useEffect, useState, useCallback } from 'react'
import { api } from '../lib/apiClient'
import type { AuditEntry } from '../types'
import { diffRows, type FieldDiff } from '../lib/auditDiff'

interface Props {
  tableName: string
  recordId: string
  onClose: () => void
}

function ActionBadge({ action }: { action: AuditEntry['action'] }) {
  const color =
    action === 'CREATE' ? 'bg-green-100 text-green-800' :
    action === 'UPDATE' ? 'bg-blue-100 text-blue-800'   :
    action === 'DELETE' ? 'bg-red-100 text-red-800'     :
                          'bg-gray-100 text-gray-800'
  return <span className={`px-2 py-0.5 rounded text-xs font-medium ${color}`}>{action}</span>
}

function DiffRow({ d }: { d: FieldDiff }) {
  const label =
    d.kind === 'added'   ? '+ added'   :
    d.kind === 'removed' ? '− removed' :
                           '~ changed'
  return (
    <li className="text-sm font-mono">
      <span className="text-gray-500 mr-2">{label}</span>
      <span className="font-semibold">{d.field}</span>
      {d.kind !== 'added'   && <div className="ml-6 text-red-700">- {JSON.stringify(d.before)}</div>}
      {d.kind !== 'removed' && <div className="ml-6 text-green-700">+ {JSON.stringify(d.after)}</div>}
    </li>
  )
}

export function AuditHistoryDrawer({ tableName, recordId, onClose }: Props) {
  const [entries, setEntries] = useState<AuditEntry[]>([])
  const [cursor, setCursor] = useState<string | null | undefined>(undefined) // undefined = not loaded; null = end
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<Set<number>>(new Set())

  const loadMore = useCallback(async () => {
    if (loading || cursor === null) return
    setLoading(true)
    setError(null)
    try {
      const page = await api.audit.getForRecord(tableName, recordId, cursor ?? undefined)
      setEntries((prev) => [...prev, ...page.entries])
      setCursor(page.nextCursor)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load history')
    } finally {
      setLoading(false)
    }
  }, [tableName, recordId, cursor, loading])

  useEffect(() => {
    void loadMore()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const toggleExpanded = (id: number) => {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="flex-1 bg-black/30" onClick={onClose} />
      <div className="w-full max-w-lg bg-white dark:bg-gray-900 shadow-xl h-full overflow-y-auto">
        <header className="sticky top-0 bg-white dark:bg-gray-900 border-b px-6 py-4 flex items-center justify-between">
          <div>
            <h2 className="font-semibold">History</h2>
            <p className="text-xs text-gray-500">
              {tableName} · {recordId} · {entries.length} event{entries.length === 1 ? '' : 's'}
            </p>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-900">✕</button>
        </header>

        <div className="p-4 space-y-3">
          {entries.length === 0 && !loading && !error && (
            <p className="text-sm text-gray-500">No audit events for this record yet.</p>
          )}

          {entries.map((e) => {
            const isOpen = expanded.has(e.id)
            const diffs = isOpen ? diffRows(e.before, e.after) : []
            return (
              <div key={e.id} className="border rounded p-3">
                <button
                  onClick={() => toggleExpanded(e.id)}
                  className="w-full text-left flex items-center justify-between gap-2"
                >
                  <div className="flex items-center gap-2">
                    <ActionBadge action={e.action} />
                    <span className="text-sm">{e.userEmail ?? e.userId}</span>
                  </div>
                  <span className="text-xs text-gray-500">{new Date(e.createdAt).toLocaleString()}</span>
                </button>
                {isOpen && (
                  <div className="mt-3 border-t pt-3">
                    {diffs.length > 0 ? (
                      <ul className="space-y-1">
                        {diffs.map((d) => <DiffRow key={d.field} d={d} />)}
                      </ul>
                    ) : e.metadata ? (
                      <pre className="text-xs bg-gray-50 dark:bg-gray-800 p-2 rounded overflow-x-auto">
                        {JSON.stringify(e.metadata, null, 2)}
                      </pre>
                    ) : (
                      <p className="text-xs text-gray-500">No additional details.</p>
                    )}
                  </div>
                )}
              </div>
            )
          })}

          {error && <p className="text-sm text-red-600">{error}</p>}

          {cursor !== null && (
            <button
              disabled={loading}
              onClick={() => void loadMore()}
              className="w-full text-sm py-2 border rounded hover:bg-gray-50 disabled:opacity-50"
            >
              {loading ? 'Loading…' : entries.length === 0 ? 'Load' : 'Load more'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Type-check + commit**

```bash
cd web && npx tsc --noEmit
git add web/src/components/AuditHistoryDrawer.tsx web/src/components/HistoryButton.tsx
git commit -m "feat(audit): AuditHistoryDrawer and HistoryButton components"
```

---

## Task 19: Drop `HistoryButton` onto audited entity pages

**Files:**
- Modify: `web/src/pages/ClassDetailView.tsx` — class row history
- Modify: report edit / detail entry point (likely `web/src/pages/ClassDetail/…` — inspect the folder and find the page that renders `ReportEditForm`)
- Modify: `web/src/components/PayrollTable.tsx` — per hours row
- Modify: `web/src/pages/StudentSettingsPage.tsx` — profile history
- Modify: roster row (inspect `web/src/pages/RosterPage.tsx` or the row subcomponent) — enrollment history

- [ ] **Step 1: Class detail** — in `ClassDetailView.tsx`, near the page header action row, add:

```tsx
import { HistoryButton } from '../components/HistoryButton'
// ...
<HistoryButton tableName="classes" recordId={classId} />
```

- [ ] **Step 2: Daily report** — in the daily report page (the one that renders `ReportEditForm`), near the header add:

```tsx
<HistoryButton tableName="class_daily_reports" recordId={reportId} />
```

- [ ] **Step 3: Hours row** — in `PayrollTable.tsx`, add a trailing cell with `<HistoryButton tableName="class_logged_hours" recordId={row.id} />` for each row.

- [ ] **Step 4: Profile settings** — in `StudentSettingsPage.tsx`, near the save button area add `<HistoryButton tableName="profiles" recordId={userId} />`.

- [ ] **Step 5: Roster row (enrollments)** — in the roster row subcomponent, add `<HistoryButton tableName="class_enrollments" recordId={enrollment.id} />`.

- [ ] **Step 6: Dev-server smoke check**

Run `cd web && npm run dev` and visit each page above. Click the "History" button; drawer opens; shows events if any exist; empty state shows when none. Expand a sensitive-table event and verify the diff renders.

- [ ] **Step 7: Type-check + commit**

```bash
cd web && npx tsc --noEmit
git add web/src/pages/ClassDetailView.tsx web/src/components/PayrollTable.tsx web/src/pages/StudentSettingsPage.tsx web/src/pages/<report-edit-page>.tsx web/src/pages/<roster-row>.tsx
git commit -m "feat(audit): HistoryButton placements on audited entity pages"
```

---

## Task 20: Global `AuditLogPage` + nav + route

**Files:**
- Create: `web/src/pages/AuditLogPage.tsx`
- Modify: `web/src/App.tsx` — add `/audit` route
- Modify: `web/src/components/CoordinatorLayout.tsx` — add nav entry

- [ ] **Step 1: Write the page**

```tsx
import { useEffect, useRef, useState, useCallback } from 'react'
import { api } from '../lib/apiClient'
import type { AuditEntry, AuditAction } from '../types'
import { AuditHistoryDrawer } from '../components/AuditHistoryDrawer'

const ACTIONS: AuditAction[] = ['CREATE', 'UPDATE', 'DELETE']
const TABLES = [
  'classes','class_trainers','class_drills','class_schedule_slots','class_enrollments',
  'class_daily_reports','class_daily_report_trainee_progress','class_logged_hours','profiles',
]

export default function AuditLogPage() {
  const [entries, setEntries] = useState<AuditEntry[]>([])
  // cursor semantics: undefined = not yet loaded; null = end-of-results; string = next page token
  const [cursor, setCursor] = useState<string | null | undefined>(undefined)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [userId, setUserId]       = useState('')
  const [tableName, setTableName] = useState('')
  const [action, setAction]       = useState<'' | AuditAction>('')
  const [from, setFrom]           = useState('')
  const [to, setTo]               = useState('')
  const [drawer, setDrawer]       = useState<{ tableName: string; recordId: string } | null>(null)

  // Hold current filter values in a ref so loadMore always sees the latest values
  // without being re-created on every keystroke.
  const filtersRef = useRef({ userId, tableName, action, from, to })
  filtersRef.current = { userId, tableName, action, from, to }

  const loadMore = useCallback(async (opts?: { reset?: boolean; resumeCursor?: string | null | undefined }) => {
    if (loading) return
    const resume = opts?.reset ? undefined : opts?.resumeCursor
    if (!opts?.reset && resume === null) return
    setLoading(true)
    setError(null)
    try {
      const f = filtersRef.current
      const page = await api.audit.search({
        userId:    f.userId    || undefined,
        tableName: f.tableName || undefined,
        action:    f.action    || undefined,
        from:      f.from      || undefined,
        to:        f.to        || undefined,
        cursor:    resume ?? undefined,
      })
      if (opts?.reset) {
        setEntries(page.entries)
      } else {
        setEntries((prev) => [...prev, ...page.entries])
      }
      setCursor(page.nextCursor)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load')
    } finally {
      setLoading(false)
    }
  }, [loading])

  // Initial load once on mount.
  useEffect(() => {
    void loadMore({ reset: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const applyFilters = () => {
    void loadMore({ reset: true })
  }

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-2xl font-semibold">Audit log</h1>
      <div className="flex flex-wrap gap-2 items-end">
        <label className="text-sm">User ID
          <input value={userId} onChange={(e) => setUserId(e.target.value)} className="ml-2 border rounded px-2 py-1" />
        </label>
        <label className="text-sm">Table
          <select value={tableName} onChange={(e) => setTableName(e.target.value)} className="ml-2 border rounded px-2 py-1">
            <option value="">(any)</option>
            {TABLES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </label>
        <label className="text-sm">Action
          <select value={action} onChange={(e) => setAction(e.target.value as '' | AuditAction)} className="ml-2 border rounded px-2 py-1">
            <option value="">(any)</option>
            {ACTIONS.map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
        </label>
        <label className="text-sm">From
          <input type="datetime-local" value={from} onChange={(e) => setFrom(e.target.value)} className="ml-2 border rounded px-2 py-1" />
        </label>
        <label className="text-sm">To
          <input type="datetime-local" value={to} onChange={(e) => setTo(e.target.value)} className="ml-2 border rounded px-2 py-1" />
        </label>
        <button onClick={applyFilters} className="px-3 py-1 rounded bg-gray-900 text-white text-sm">Apply</button>
      </div>

      <table className="w-full text-sm">
        <thead className="text-left text-gray-500 border-b">
          <tr><th>Time</th><th>Actor</th><th>Action</th><th>Table</th><th>Record</th><th></th></tr>
        </thead>
        <tbody>
          {entries.map((e) => (
            <tr key={e.id} className="border-b">
              <td className="py-1">{new Date(e.createdAt).toLocaleString()}</td>
              <td>{e.userEmail ?? e.userId}</td>
              <td>{e.action}</td>
              <td>{e.tableName}</td>
              <td className="font-mono text-xs">{e.recordId}</td>
              <td>
                <button onClick={() => setDrawer({ tableName: e.tableName, recordId: e.recordId })}
                        className="text-xs underline">View</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {error && <p className="text-sm text-red-600">{error}</p>}
      {cursor !== null && entries.length > 0 && (
        <button disabled={loading}
                onClick={() => void loadMore({ resumeCursor: cursor })}
                className="text-sm underline disabled:opacity-50">
          {loading ? 'Loading…' : 'Load more'}
        </button>
      )}

      {drawer && <AuditHistoryDrawer tableName={drawer.tableName} recordId={drawer.recordId} onClose={() => setDrawer(null)} />}
    </div>
  )
}
```

- [ ] **Step 2: Route wiring** — in `web/src/App.tsx`, locate the coordinator routes block and add:

```tsx
import AuditLogPage from './pages/AuditLogPage'
// inside the coordinator <Routes>:
<Route path="/audit" element={<AuditLogPage />} />
```

- [ ] **Step 3: Nav entry** — in `web/src/components/CoordinatorLayout.tsx`, add an `/audit` link alongside the other coordinator nav items (Classes, Reports, etc.). Match the existing NavLink styling.

- [ ] **Step 4: Dev-server smoke check**

- Start `npm run dev` in `/web`
- Log in as coordinator, click "Audit log" in nav
- Apply a filter (e.g., `action=DELETE`) → results update
- Click "View" on any row → drawer opens for that record
- Log in as a trainer → "Audit log" nav link hidden; visiting `/audit` either redirects or shows a 403 from the API

- [ ] **Step 5: Type-check + commit**

```bash
cd web && npx tsc --noEmit
git add web/src/pages/AuditLogPage.tsx web/src/App.tsx web/src/components/CoordinatorLayout.tsx
git commit -m "feat(audit): global audit log page + nav entry"
```

---

## Task 21: Manual QA pass + final checks

- [ ] **Step 1: Verification scripts pass**

```bash
cd server
npm run verify:audit-coverage
npm run verify:audit-immutability
```

Expected: both print `... OK`.

- [ ] **Step 2: Manual QA checklist**

Against a local or staging environment seeded with at least: 1 class, 2 trainers, 2 students, 1 daily report, 1 hours row.

- [ ] Create a class → History on class detail shows CREATE with metadata
- [ ] Edit a daily report → History drawer shows CREATE + UPDATE, expanding UPDATE shows a field-level diff
- [ ] Delete a class → global audit page shows DELETE row; "View" opens drawer with the class's audit trail
- [ ] Edit a trainer's profile → History on settings shows UPDATE with a diff
- [ ] Delete an hours row → History on that hours row shows CREATE + DELETE (DELETE includes `before_row`)
- [ ] Global page: filter by `action=DELETE` → only deletes show; filter by a specific user → only their actions
- [ ] Pagination: with >50 events total, "Load more" fetches the next page; no duplicates; keyset works across concurrent inserts (create a new event in another tab, click Load more — new event does not reappear)
- [ ] Trainer login: no "Audit log" nav entry; `GET /api/audit` returns 403; History buttons not visible on pages that are coordinator-only
- [ ] Student login: same as trainer

- [ ] **Step 3: Final type-check across both packages**

```bash
cd server && npx tsc --noEmit
cd ../web && npx tsc --noEmit
```

- [ ] **Step 4: Final commit (if any cleanup)**

```bash
git commit -am "chore(audit): QA pass cleanups" --allow-empty-message || true
```

---

## Open items for future work

- Self-view for trainers / students on their own audit trail
- Retention / archival job if `audit_logs` grows large
- Soft-delete flags on domain records so UIs can render "deleted by X on Y" inline without opening the drawer
- Formal test framework (vitest or jest) — would replace the verification scripts with real test coverage
