# Agent Guide — Gateway Training Tool

Everything a coding agent (Claude, Copilot, Cursor, etc.) needs to know to work on this project correctly and efficiently. Read this file before making any changes.

---

## 1. What this project is

An internal training management platform for **Gateway Casinos**. Coordinators create and manage training classes for casino table games (Blackjack, Baccarat, etc.) across properties in **BC, AB, and ON**. Trainers run the classes; students (trainees) attend them.

The app tracks: classes, schedules, drill/test scores, daily reports, trainer assignments, student enrollments, and logged hours (for payroll).

---

## 2. Repository layout

```
GatewayTrainingTool/
├── api/index.ts                  # Vercel serverless entry — re-exports server/src/index.ts
├── server/                       # Express REST API (TypeScript)
│   └── src/
│       ├── index.ts              # Express app bootstrap (middleware stack)
│       ├── lib/
│       │   ├── supabase.ts       # Supabase client (service role key — bypasses RLS)
│       │   ├── encryption.ts     # AES-256-GCM field-level encryption
│       │   └── audit.ts          # Immutable audit log writer
│       ├── middleware/
│       │   ├── auth.ts           # JWT validation + role extraction (requireAuth, requireCoordinator, requirePayrollAdmin)
│       │   ├── error.ts          # Global error handler (hides stack traces in prod)
│       │   └── security.ts       # Additional security headers (helmet backup)
│       └── routes/
│           ├── index.ts          # Router assembly — middleware order matters (see below)
│           ├── profiles.ts       # GET /profiles/me, GET /profiles?role=&search=
│           ├── classes.ts        # CRUD /classes, /classes/by-name/:name
│           ├── drills.ts         # CRUD /classes/:classId/drills
│           ├── trainers.ts       # CRUD /classes/:classId/trainers
│           ├── enrollments.ts    # CRUD /classes/:classId/enrollments
│           ├── schedule.ts       # CRUD /classes/:classId/schedule + GET /schedule (global)
│           ├── reports.ts        # CRUD /classes/:classId/reports + GET /reports (global) + GET /reports/:id (nested)
│           └── hours.ts          # CRUD /classes/:classId/hours
├── web/                          # React SPA (TypeScript + Vite + Tailwind)
│   └── src/
│       ├── App.tsx               # Route tree (BrowserRouter + all route definitions)
│       ├── main.tsx              # React entry point
│       ├── contexts/
│       │   ├── AuthContext.tsx    # Session + role + signOut (useAuth hook)
│       │   └── ClassesContext.tsx # Cached active/archived class lists (useClasses hook)
│       ├── layouts/
│       │   ├── ProtectedLayout.tsx   # Auth gate + coordinator sidebar / non-coordinator header
│       │   └── CoordinatorRoute.tsx  # Role guard wrapper (redirects non-coordinators)
│       ├── components/
│       │   ├── CoordinatorLayout.tsx  # Dark sidebar nav (mobile drawer + desktop persistent)
│       │   ├── LoginForm.tsx          # Email/password form
│       │   ├── GoogleLoginForm.tsx    # Google OAuth button
│       │   ├── CreateClassModal.tsx   # Class creation modal form
│       │   └── ReportPreviewModal.tsx # Report preview + PDF download
│       ├── pages/
│       │   ├── LoginView.tsx           # Public login page
│       │   ├── DashboardView.tsx       # Coordinator dashboard with tiles
│       │   ├── ClassesPage.tsx         # Class list + create button
│       │   ├── ClassDetailView.tsx     # Slug → name conversion wrapper
│       │   ├── ClassDetailPage.tsx     # Tabbed class detail (fetches class by name)
│       │   ├── ClassDetail/            # Tab sections:
│       │   │   ├── ClassOverviewSection.tsx
│       │   │   ├── ClassScheduleSection.tsx
│       │   │   ├── ClassStudentsSection.tsx
│       │   │   ├── ClassTrainersSection.tsx
│       │   │   ├── ClassDrillsSection.tsx
│       │   │   └── ClassReportsSection.tsx
│       │   ├── RosterPage.tsx          # Reusable trainer/student list (role prop)
│       │   ├── ReportsPage.tsx         # Cross-class daily reports
│       │   ├── SchedulePage.tsx        # Upcoming schedule across classes
│       │   ├── SettingsContent.tsx      # Account settings placeholder
│       │   └── InProgressPage.tsx       # "Work in progress" placeholder for non-coordinators
│       ├── lib/
│       │   ├── supabase.ts       # Supabase client (anon key — respects RLS)
│       │   ├── apiClient.ts      # Typed HTTP client (api.classes.list(), api.reports.get(), etc.)
│       │   ├── reportPdf.ts      # PDF report generation via html2pdf.js
│       │   └── utils.ts          # Helpers: classSlug(), formatTime(), etc.
│       └── types/index.ts        # All shared TypeScript types (single source of truth)
├── vercel.json                   # Deployment config (builds both server + web)
├── package.json                  # Root package (minimal)
├── tsconfig.json                 # Root TypeScript config
├── claude.md                     # Claude Code instructions
├── README.md                     # Vision + tech stack + phased roadmap
├── CURRENT_STATE.md              # Implementation status snapshot
└── roadmap.md                    # Classes page feature checklist
```

---

## 3. Tech stack

| Layer | Technology | Version |
|-------|-----------|---------|
| Frontend | React + TypeScript | 19 |
| Build | Vite | 8 |
| Styling | Tailwind CSS | 3 |
| Routing | React Router | 7 |
| Backend | Express | 4 |
| Language | TypeScript | 5.9 |
| Database | PostgreSQL via Supabase | — |
| Auth | Supabase Auth (email/password + Google OAuth) | — |
| Security | Helmet, express-rate-limit, AES-256-GCM | — |
| Hosting | Vercel (frontend + serverless API), Railway (standalone backend) | — |

---

## 4. Architecture patterns you MUST follow

### 4.1 TypeScript conventions
- **Use `type` over `interface`** — except where `interface` is already used (e.g. the existing types in `types/index.ts` use `interface` and that's fine to continue).
- **Never use `enum`** — use string literal unions: `type DrillType = 'drill' | 'test'`
- **Never use `any`** without explicit approval.
- All types live in `web/src/types/index.ts` — this is the single source of truth for data shapes. Add new types here first.

### 4.2 API pattern
Every backend route follows this structure:
```typescript
router.get('/path', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { data, error } = await supabase.from('table').select('*')...
    if (error) throw error
    res.json(data)
  } catch (err) {
    next(err)  // Global error handler in middleware/error.ts
  }
})
```

Key patterns:
- All routes use `try/catch` with `next(err)` for error propagation.
- Supabase error code `PGRST116` means "no rows found" — return 404.
- Write operations on reports/hours use `logAudit()` for compliance tracking.
- The `writeLimiter` from `server/src/index.ts` is applied to sensitive write endpoints.
- All route files export a named Router (e.g. `export const classesRouter = Router()`).

### 4.3 Frontend data flow
```
Component → api.resource.method() → fetch()/authHeaders() → Express API → Supabase → PostgreSQL
```
- **Never call Supabase directly from components** (except for auth via `supabase.auth`). All data goes through `apiClient.ts`.
- `apiClient.ts` automatically attaches the JWT from `supabase.auth.getSession()`.
- Use the `useAuth()` hook for session/role/signOut. Use `useClasses()` for the cached class list.

### 4.4 Route middleware order (critical)
In `server/src/routes/index.ts`:
1. `requireAuth` — applied to ALL routes (no anonymous access)
2. `profilesRouter` — mounted BEFORE `requireCoordinator` (all authenticated users need `/profiles/me`)
3. `requireCoordinator` — applied to all subsequent routers
4. All other routers (classes, drills, trainers, enrollments, schedule, reports, hours)

**If you add a new route that non-coordinators need**, mount it BEFORE `requireCoordinator`.

### 4.5 URL slug convention
- Class names are used as URL slugs: `"BJ APR 01"` → `/classes/BJ-APR-01`
- Hyphens are disallowed in class names (they're the slug separator).
- `ClassDetailView.tsx` converts the slug back: `BJ-APR-01` → `BJ APR 01`.
- The API then looks up the class by name via `GET /classes/by-name/:name`.

### 4.6 Reports — nested data pattern
Reports are the most complex entity. A single report has:
- Main row in `class_daily_reports`
- Trainer links in `class_daily_report_trainers` (many-to-many)
- Timeline items in `class_daily_report_timeline_items` (ordered by position)
- Trainee progress in `class_daily_report_trainee_progress` (per-student ratings)

**GET** fetches all four tables in parallel via `Promise.all`.
**PUT** uses a full-replace strategy: delete all nested rows, then re-insert. No merge/diff logic.

### 4.7 Color palette
The Gateway brand colors are defined in `web/tailwind.config.js`:
- `gw-darkest`: `#081C30` — sidebar gradient start
- `gw-dark`: `#134270` — primary brand color, sidebar gradient end
- `gw-navy`: `#131371`
- `gw-teal`: `#137171`
- `gw-blue`: `#1E69B3`

Use white backgrounds with `#134270` accents for the main UI. Sidebar uses the dark gradient.

---

## 5. Authentication and authorization

### Frontend auth flow
1. User signs in via Supabase Auth (LoginForm or GoogleLoginForm).
2. `AuthContext` listens for auth state changes, fetches the role from the `profiles` table.
3. `ProtectedLayout` checks `session` and `role` — redirects to `/login` if unauthenticated.
4. `CoordinatorRoute` redirects non-coordinators to `/dashboard`.

### Backend auth flow
1. Frontend sends `Authorization: Bearer <JWT>` via `apiClient.ts`.
2. `requireAuth` middleware validates JWT via `supabase.auth.getUser(token)`, then fetches `profiles.role`.
3. Sets `req.userId` and `req.userRole` on the Express Request object.
4. `requireCoordinator` checks `req.userRole === 'coordinator'`.

### Roles
| Role | Access |
|------|--------|
| `coordinator` | Full CRUD on all class management endpoints |
| `trainer` | Read own profile only (class management UI not yet built) |
| `trainee` | Read own profile only (dashboard shows "in progress") |
| `payroll_admin` | Future: sensitive financial/HR data (separate from coordinator) |

---

## 6. Database schema

All tables live in Supabase PostgreSQL. Migrations are run in the Supabase SQL editor (not stored in repo — see `claude.md`).

### Core tables
| Table | Purpose | Key relationships |
|-------|---------|-------------------|
| `profiles` | User accounts (role, province) | FK → auth.users.id |
| `classes` | Training classes | Parent of all class_* tables |
| `class_drills` | Drills and tests per class | FK → classes.id |
| `class_trainers` | Trainer assignments (snapshot) | FK → classes.id |
| `class_enrollments` | Student enrollments | FK → classes.id |
| `class_schedule_slots` | Time blocks | FK → classes.id, FK → class_trainers.id |
| `class_daily_reports` | Daily session reports | FK → classes.id |
| `class_daily_report_trainers` | Report ↔ trainer junction | FK → reports.id, FK → class_trainers.id |
| `class_daily_report_timeline_items` | Ordered training blocks | FK → reports.id |
| `class_daily_report_trainee_progress` | Per-student daily assessment | FK → reports.id, FK → class_enrollments.id |
| `class_logged_hours` | Payroll hour tracking | FK → classes.id |
| `audit_logs` | Immutable audit trail | FK → auth.users.id |

### Important schema notes
- `class_trainers` is a **snapshot** — stores trainer_name and trainer_email at assignment time, does NOT auto-update if the profile changes.
- `class_daily_report_timeline_items` has a `position` column for drag-and-drop ordering.
- `class_daily_report_trainee_progress` rates students on three axes: GK (Game Knowledge), Dex (Dexterity), HOM (Hands-on Mechanics), each using the `DailyRating` scale (EE/ME/AD/NI).
- `class_logged_hours` uses `person_type` to distinguish trainer vs student hours; either `trainer_id` or `enrollment_id` is set, never both.
- All tables use UUIDs as primary keys.
- Delete cascades exist at the DB level for nested data.

---

## 7. Security architecture

- **Helmet** — comprehensive response headers (HSTS, CSP, X-Frame-Options, etc.)
- **Rate limiting** — 100 req/15min global, 30 req/15min for write operations
- **CORS** — restricted to `FRONTEND_URL` in production; open in development
- **Body size limit** — 50 KB max JSON body
- **IDOR protection** — all write queries match both the record ID and the parent classId
- **Field-level encryption** — AES-256-GCM for sensitive data (SSN, SIN, salary); not yet wired to specific columns
- **Audit logging** — all mutations logged to `audit_logs` (who, what, when, IP); `logAudit()` never throws (silent failure with stderr logging)
- **RLS** — Row-Level Security enabled on Supabase tables; the backend uses the service role key to bypass RLS (it enforces access via middleware instead)

---

## 8. Environment variables

### Backend (`server/.env`)
```
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJxxx...      # Bypasses RLS — keep secret
FRONTEND_URL=https://your-app.vercel.app  # CORS origin in production
NODE_ENV=production|development
PORT=3001                                 # Local dev only
FIELD_ENCRYPTION_KEY=<64-char hex>        # For AES-256-GCM (optional until sensitive fields exist)
```

### Frontend (`web/.env`)
```
VITE_SUPABASE_URL=https://xxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJxxx...         # Public anon key (safe to expose)
VITE_API_URL=http://localhost:3001        # Local dev only; leave empty for production
```

---

## 9. Deployment

### Vercel (primary)
- `vercel.json` builds both server and web.
- Frontend: `web/dist` (Vite output).
- Backend: `api/index.ts` is a Vercel serverless function that re-exports the Express app.
- Rewrites: `/api/*` → serverless function; `/*` → SPA (React Router handles client-side routes).

### How it works on Vercel
1. Build command installs both `server/` and `web/` dependencies, then runs `vite build`.
2. `api/index.ts` imports `server/src/index.ts` which exports the Express app as default.
3. Vercel wraps the Express app in a serverless function handler automatically.
4. The `app.listen()` block in `server/src/index.ts` is skipped when `NODE_ENV === 'production'`.

### Local development
```bash
# Terminal 1 — Backend
cd server && npm run dev    # tsx watch on port 3001

# Terminal 2 — Frontend
cd web && npm run dev       # Vite on port 5173
```
Set `VITE_API_URL=http://localhost:3001` in `web/.env` for local dev.

---

## 10. Adding new features — checklist

When adding a new resource (e.g. "attendance"):

1. **Types** — Add interfaces/types to `web/src/types/index.ts`.
2. **Database** — Write the CREATE TABLE SQL. Paste it in the chat (don't create migration files — per `claude.md`).
3. **Backend route** — Create `server/src/routes/attendance.ts` following the existing CRUD pattern. Export a named Router.
4. **Mount the route** — Add it to `server/src/routes/index.ts` in the correct position (before or after `requireCoordinator`).
5. **API client** — Add methods to the `api` object in `web/src/lib/apiClient.ts`.
6. **Frontend pages/components** — Create page components, add routes to `App.tsx`.
7. **Audit logging** — Call `logAudit()` on all mutations if the data is sensitive.

---

## 11. Common pitfalls

- **`/classes/by-name/:name` must be registered before `/classes/:id`** in the Express router, or Express will try to parse "by-name" as a UUID.
- **The Supabase service role key bypasses RLS entirely** — all access control is done in Express middleware, not database policies.
- **`logAudit()` never throws** — it catches errors internally and logs to stderr. Don't wrap it in try/catch expecting to handle audit failures.
- **Class names cannot contain hyphens** — they're used as URL slug separators.
- **Reports use full-replace on PUT** — the entire nested data set is deleted and re-inserted. Don't try to do incremental updates.
- **`PGRST116`** is Supabase's error code for "no rows found" when using `.single()` — check for it to return proper 404s.
- **Two Supabase clients exist**: `server/src/lib/supabase.ts` (service role key, bypasses RLS) and `web/src/lib/supabase.ts` (anon key, respects RLS). Never mix them up.
- **Don't call Supabase directly from React components for data** — use `apiClient.ts`. The only exception is `supabase.auth.*` for authentication.

---

## 12. What's NOT implemented yet

Refer to `CURRENT_STATE.md` for the full status, but the main gaps:
- Trainer and trainee dashboards (show "in progress" placeholder)
- Drill timer and drill entry UI
- Attendance tracking UI
- Province-based filtering on class lists
- Settings page (placeholder only)
- Database migrations are NOT in the repo — run SQL in Supabase SQL editor
- No automated tests exist yet
- No CI/CD pipeline (Vercel auto-deploys from the Production branch)
