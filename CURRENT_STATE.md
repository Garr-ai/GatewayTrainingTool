# Gateway Training Tool — Current State

**Last updated:** March 2025

This document describes the project’s current implementation, structure, plan, and progress against the roadmap.

---

## 1. Project overview

**Gateway Training Tool** is an internal web app for Gateway Casinos. It supports:

- **Coordinators** — Create and manage classes, oversee training, (future) view dashboards and sign-offs.
- **Trainers** — (Planned) Run classes, log drills, track attendance.
- **Trainees / students** — (Planned) View schedules, complete drills, see progress.

The app is built for BC, AB, and ON properties with province-scoped content. The goal is a single place for drill logging, digital assessments, and scheduling.

---

## 2. Tech stack (current)

| Layer | Technology |
|-------|------------|
| **Frontend** | React 19, TypeScript, Vite 8, Tailwind CSS, React Router 7 |
| **Backend / data** | Supabase (PostgreSQL, Auth, RLS) — no separate Node/Express API yet |
| **Auth** | Supabase Auth: email/password and Google OAuth |
| **Hosting** | Vercel (frontend only); build from `web/`, output `web/dist` |

*Planned but not yet in use: Node.js + Express API, Railway, Supabase Storage, React Native (Phase 4).*

---

## 3. Repository structure

```
GatewayTrainingTool/
├── web/                    # React frontend (single app)
│   ├── src/
│   │   ├── components/     # Reusable UI (LoginForm, CreateClassModal, etc.)
│   │   ├── contexts/       # AuthContext (session, role, signOut)
│   │   ├── layouts/        # ProtectedLayout (auth + role-based shell)
│   │   ├── lib/            # Supabase client
│   │   ├── pages/          # Route-level views (LoginView, DashboardView, ClassesPage, etc.)
│   │   ├── types/          # Shared TypeScript types (UserRole, Class, Province)
│   │   ├── App.tsx         # Root: AuthProvider, BrowserRouter, Routes
│   │   ├── main.tsx        # Entry point
│   │   └── index.css       # Tailwind imports
│   ├── index.html
│   ├── package.json
│   ├── tailwind.config.js
│   ├── tsconfig.json
│   └── vite.config.ts
├── README.md               # Vision, tech stack, phased roadmap
├── roadmap.md              # Classes page feature list (planned)
├── CURRENT_STATE.md        # This file
└── vercel.json             # Vercel: build web/, output web/dist
```

- **supabase/migrations/** — SQL migrations for class-related tables. Run in Supabase SQL editor or via `supabase db push`.

---

## 4. What’s implemented

### 4.1 Authentication and roles

- **Supabase Auth** — Email/password sign in, sign up, forgot-password flow; Google OAuth (“Continue with Google”).
- **Profiles and roles** — Role stored in `profiles` (coordinator / trainer / trainee). RLS uses a helper (e.g. `get_my_role()`) to avoid recursion. Frontend loads role after session and exposes it via `AuthContext`.
- **Login experience** — Centered login page at `/login` with Gateway Training Tool title, email/password, Google button, and links for “Forgot password?” and “Sign up”.
- **Protected routes** — Unauthenticated users are redirected to `/login`. Authenticated users get a role-based layout (coordinator full app vs trainee/trainer “work in progress” on `/dashboard`).

### 4.2 Routing and layout

- **Routes**
  - `/login` — Login form; redirects to `/dashboard` if already signed in.
  - `/` — Redirects to `/dashboard`.
  - `/dashboard` — Coordinator: dashboard content; trainee/trainer: “Work in progress” message.
  - `/classes` — Coordinator only; list and create classes. Non-coordinators redirect to `/dashboard`.
  - `/settings` — Coordinator only; placeholder. Others redirect to `/dashboard`.
  - `*` — Unknown paths redirect to `/`.
- **Coordinator layout** — Full-screen: dark sidebar (Gateway branding, nav: Dashboard, Classes, Settings) and main content area. Sidebar uses `NavLink` for active state.
- **Trainee/trainer layout** — Header “Gateway Training Tool” + main area; only `/dashboard` is used and shows an “Work in progress” card with sign-out.

### 4.3 Coordinator features

- **Dashboard** — Header with search placeholder and user/sign-out; tiles for “Today’s classes”, “Attendance alerts”, “Pending sign-offs”; “Active classes” with “View all” linking to `/classes`; placeholder for more modules.
- **Classes page** — Table of classes from Supabase `classes` (name, site, province, game type, start/end dates). “+ Create class” in header and empty state. Create-class modal: name, site (text), province (BC/AB/ON), game type, start date (default today), end date, description. New class appears in list after create.
- **Settings** — Placeholder copy and sign-out; no real settings yet.

### 4.4 Data and types

- **Types** — `UserRole`, `Province`, `Profile`, `Class`, `PROVINCES` (see `web/src/types/index.ts`). Classes use `site` as text; province and game type aligned with product scope.
- **Supabase** — Client in `web/src/lib/supabase.ts`; env: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`. No backend API in repo; all data via Supabase client (auth + tables).

### 4.5 Deployment and tooling

- **Vercel** — `vercel.json` config: build command `cd web && npm install && npm run build`, output `web/dist`, framework Vite. Production branch (e.g. `Production`) deploys when env vars are set.
- **Dev** — `cd web && npm run dev`; optional Supabase status widget for connection check.

---

## 5. Plan and roadmap (summary)

The long-term plan is in **README.md** and **roadmap.md**. Condensed:

### Phase 1 — MVP: Core Foundation (Months 1–3)

- Role hierarchy and authentication → **Done** (coordinator/trainer/trainee + auth).
- Province selector (BC/AB/ON) → **Partial** (province in create-class and types; no global selector or list filtering yet).
- Class creation → **Done** (create-class modal and list).
- Class scheduling (time slots, visible to students) → **Not started**.
- Drill timer, drill entry, test scores → **Not started**.
- Daily report upload, attendance tracking → **Not started**.

### Phase 2 — Operations (Months 4–6)

- Competency sign-offs, graduation checklist, progress dashboards, retraining flags, digital forms, audit log, notifications, drill template builder → **Not started**.

### Phase 3 — Intelligence (Months 7–10)

- Slack, Percipio, regulatory modules, benchmarks, probation tracker, self-assessment, shift swap, alumni tracker → **Not started**.

### Phase 4 — Mobile (Months 11–14)

- React Native (Expo), offline mode, push, camera-assisted features, mobile UX → **Not started**.

### Classes page (roadmap.md)

- **Done:** List, empty state, create-class flow (modal), basic class fields.
- **Planned:** Class detail view, edit/cancel/archive, schedule (time slots), filters/search/sort, province/property scoping, trainer assignment in form, bulk actions, templates, calendar view.

---

## 6. Progress summary

| Area | Status | Notes |
|------|--------|--------|
| Supabase backend | ✅ In use | Email + Google auth; `profiles` + `classes` (migrations outside repo or separate) |
| Auth (email + Google) | ✅ Done | Login, sign up, reset, OAuth |
| Role-based access | ✅ Done | Coordinator vs trainee/trainer; protected routes |
| React + TypeScript + Vite + Tailwind | ✅ Done | Single app in `web/` |
| React Router | ✅ Done | `/login`, `/dashboard`, `/classes`, `/settings` |
| Coordinator dashboard | ✅ Done | Tiles + “View all” to classes |
| Classes list + create | ✅ Done | Table + modal; province, site, game type, dates |
| Settings page | 🔲 Placeholder | Copy only |
| Trainee/trainer UI | 🔲 Placeholder | “Work in progress” on `/dashboard` |
| Vercel deployment | ✅ Done | Config in repo; env in Vercel project |
| Node/Express API | ❌ Not started | Supabase client only for now |
| Class detail, edit, schedule | ❌ Not started | See roadmap.md |
| Drills, attendance, reports | ❌ Not started | Phase 1 |
| Province/list filtering | 🔲 Partial | Province in create and types; no list filter or global scope |

---

## 7. How to run and deploy

- **Local:**  
  - Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` (e.g. in `web/.env.local`).  
  - `cd web && npm install && npm run dev`.
- **Vercel:**  
  - Connect repo; set same env vars in project settings.  
  - Build uses `vercel.json`; deploy from `main` or `Production` (or your chosen branch).
- **Supabase:**  
  - Enable Email and Google auth; configure redirect URLs for app and Vercel domain.  
  - Ensure `profiles` (with `role`) and `classes` exist and RLS is applied.

---

## 8. Next steps (suggested)

1. **Class detail** — Click row → class detail view (or panel) with schedule/students placeholders.
2. **Edit class** — Edit name, site, province, game type, dates (and later trainer/schedule).
3. **Province and list UX** — Global province filter and/or filter Classes list by province/site.
4. **Trainer assignment** — Trainer field in create-class form and in class model once `profiles`/trainer list is available.
5. **Trainee/trainer flows** — Replace “Work in progress” with minimal schedule view and (when ready) drill/attendance entry.
6. **Migrations in repo** — Add `supabase/migrations` (or equivalent) and document how to run them for new environments.

---

*This file can be updated as features ship or the plan changes. For the full Classes roadmap, see `roadmap.md`; for vision and phased roadmap, see `README.md`.*
