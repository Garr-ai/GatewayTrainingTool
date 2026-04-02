# UI Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restyle the Gateway Training Tool from a light-mode app to a dark "Contrast Zones" design using the existing Tailwind setup — no new libraries.

**Architecture:** Add two new Tailwind color tokens (`gw-surface`, `gw-elevated`), replace the text sidebar with a 64px icon-only sidebar + mobile bottom nav, then restyle all components and pages to use the 3-tier dark surface system. Pure styling changes — no routing, data, or logic changes.

**Tech Stack:** React 19, TypeScript, Tailwind CSS v3, Vite. Run `cd web && npm run build` to verify TypeScript compiles. No test suite — verify visually with `npm run dev`.

---

## File Map

| File | Change |
|---|---|
| `web/tailwind.config.js` | Add `gw-surface` (#0f1d2e) and `gw-elevated` (#111e30) tokens |
| `web/src/index.css` | Add `@keyframes shimmer` + `.animate-shimmer` utility |
| `web/src/layouts/ProtectedLayout.tsx` | Dark shell bg, dark mobile top bar, bottom nav support, dark non-coordinator header |
| `web/src/components/CoordinatorLayout.tsx` | Full rewrite: 64px icon sidebar (desktop) + bottom nav sheet (mobile) |
| `web/src/components/Skeleton.tsx` | Replace `bg-slate-200 animate-pulse` with `animate-shimmer` dark shimmer |
| `web/src/components/EmptyState.tsx` | Dark icon box, dark text colors, primary gradient button |
| `web/src/components/ConfirmDialog.tsx` | Dark modal: `bg-gw-surface`, dark text, updated button variants |
| `web/src/contexts/ToastContext.tsx` | Dark toast: `bg-gw-surface` + colored left border |
| `web/src/components/Pagination.tsx` | Dark button styles |
| `web/src/pages/DashboardContent.tsx` | Dark cards, dark table, dark province badges, dark buttons |
| `web/src/pages/ClassesPage.tsx` | Dark filter bar, dark tables, dark empty states, dark buttons |
| `web/src/pages/ClassDetailPage.tsx` | Dark tab bar with gradient underline indicator |
| `web/src/pages/ClassDetailView.tsx` | Dark page header, dark stat cards |
| `web/src/pages/ReportsPage.tsx` | Dark page header + Export button |
| `web/src/components/ReportsFilterBar.tsx` | Dark filter bar |
| `web/src/components/ReportsTable.tsx` | Dark table |
| `web/src/pages/RosterPage.tsx` | Dark page header, dark search bar, dark table |
| `web/src/pages/SchedulePage.tsx` | Dark page header, dark filter/table |
| `web/src/components/ScheduleFilterBar.tsx` | Dark filter bar |
| `web/src/components/ScheduleTable.tsx` | Dark table |
| `web/src/components/ScheduleCalendar.tsx` | Dark calendar |
| `web/src/pages/TrainerPayrollPage.tsx` | Dark page header |
| `web/src/pages/StudentPayrollPage.tsx` | Dark page header |
| `web/src/components/PayrollFilterBar.tsx` | Dark filter bar |
| `web/src/components/PayrollTable.tsx` | Dark table |
| `web/src/pages/SettingsContent.tsx` | Dark settings page |
| `web/src/pages/StudentProgressPage.tsx` | Dark page |
| `web/src/components/CreateClassModal.tsx` | Dark modal form |
| `web/src/components/EditClassModal.tsx` | Dark modal form |
| `web/src/components/ReportPreviewModal.tsx` | Dark modal |
| `web/src/pages/LoginView.tsx` | Dark login page |

---

## Task 1: Design Tokens + Shimmer Animation

**Files:**
- Modify: `web/tailwind.config.js`
- Modify: `web/src/index.css`

- [ ] **Step 1: Add gw-surface and gw-elevated to tailwind.config.js**

```js
// web/tailwind.config.js
/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        gw: {
          darkest:     '#081C30',
          dark:        '#134270',
          navy:        '#131371',
          teal:        '#137171',
          blue:        '#1E69B3',
          'blue-hover':'#155A9A',
          surface:     '#0f1d2e',
          elevated:    '#111e30',
        },
      },
    },
  },
  plugins: [],
}
```

- [ ] **Step 2: Add shimmer keyframe to index.css**

```css
/* web/src/index.css */
@tailwind base;
@tailwind components;
@tailwind utilities;

/* Toast enter animation */
@keyframes toast-in {
  from { opacity: 0; transform: translateY(1rem); }
  to   { opacity: 1; transform: translateY(0); }
}
.animate-toast-in { animation: toast-in 0.25s ease-out; }

/* Modal enter animations */
@keyframes backdrop-in {
  from { opacity: 0; }
  to   { opacity: 1; }
}
@keyframes modal-in {
  from { opacity: 0; transform: translateY(0.5rem) scale(0.97); }
  to   { opacity: 1; transform: translateY(0) scale(1); }
}
.animate-backdrop-in { animation: backdrop-in 0.15s ease-out; }
.animate-modal-in    { animation: modal-in 0.15s ease-out; }

/* Dark shimmer skeleton animation */
@keyframes shimmer {
  0%   { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}
.animate-shimmer {
  background: linear-gradient(90deg, #111e30 25%, #1a2d42 50%, #111e30 75%);
  background-size: 200% 100%;
  animation: shimmer 1.6s ease-in-out infinite;
}
```

- [ ] **Step 3: Verify TypeScript build passes**

```bash
cd /Users/garr/Documents/GatewayTrainingTool/web && npm run build
```
Expected: build succeeds (no TypeScript errors).

- [ ] **Step 4: Commit**

```bash
cd /Users/garr/Documents/GatewayTrainingTool
git add web/tailwind.config.js web/src/index.css
git commit -m "feat: add gw-surface/gw-elevated tokens and shimmer animation"
```

---

## Task 2: Navigation — CoordinatorLayout + ProtectedLayout

**Files:**
- Modify: `web/src/components/CoordinatorLayout.tsx`
- Modify: `web/src/layouts/ProtectedLayout.tsx`

This is the biggest structural change. The `CoordinatorLayout` props interface stays the same (`mobileOpen`, `onMobileClose`) to avoid cascading changes. On desktop: a 64px icon-only sidebar. On mobile: the sidebar is hidden (`md:flex hidden`) and instead a bottom nav is rendered inside `ProtectedLayout`.

- [ ] **Step 1: Rewrite CoordinatorLayout.tsx**

```tsx
// web/src/components/CoordinatorLayout.tsx
import { NavLink } from 'react-router-dom'

interface CoordinatorLayoutProps {
  mobileOpen: boolean
  onMobileClose: () => void
}

type NavItem = { to: string; label: string; icon: React.ReactNode }

const icon = (d: string, viewBox = '0 0 24 24') => (
  <svg width="20" height="20" fill="none" viewBox={viewBox} stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
    <path d={d} />
  </svg>
)

const NAV_ITEMS: NavItem[] = [
  { to: '/dashboard',       label: 'Dashboard',       icon: icon('M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2V9z') },
  { to: '/classes',         label: 'Classes',          icon: icon('M4 19.5A2.5 2.5 0 016.5 17H20M4 19.5A2.5 2.5 0 004 17V5a2 2 0 012-2h14a2 2 0 012 2v12a2.5 2.5 0 01-2.5 2.5H4z') },
  { to: '/students',        label: 'Students',         icon: icon('M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M9 11a4 4 0 100-8 4 4 0 000 8zM23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75') },
  { to: '/trainers',        label: 'Trainers',         icon: icon('M16 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M8.5 11a4 4 0 100-8 4 4 0 000 8zM20 8v6M23 11h-6') },
  { to: '/reports',         label: 'Reports',          icon: icon('M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8zM14 2v6h6M16 13H8M16 17H8M10 9H8') },
  { to: '/schedule',        label: 'Schedule',         icon: icon('M19 4H5a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2V6a2 2 0 00-2-2zM16 2v4M8 2v4M3 10h18') },
  { to: '/payroll/trainers',label: 'Trainer Payroll',  icon: icon('M12 1v22M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6') },
  { to: '/payroll/students',label: 'Student Payroll',  icon: icon('M12 1v22M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6') },
]

const settingsPath = 'M12 15a3 3 0 100-6 3 3 0 000 6zM19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 01-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z'

export function CoordinatorLayout({ onMobileClose }: CoordinatorLayoutProps) {
  return (
    <aside className="hidden md:flex flex-col flex-shrink-0 w-16 bg-white/[0.03] border-r border-white/[0.06] py-4 items-center gap-1 min-h-screen sticky top-0">
      {/* Logo mark */}
      <div className="w-9 h-9 rounded-[10px] bg-gradient-to-br from-gw-blue to-gw-teal flex items-center justify-center mb-3 shrink-0">
        <span className="text-white font-bold text-sm select-none">G</span>
      </div>
      <div className="w-8 h-px bg-white/[0.08] mb-1" />

      {/* Nav items */}
      <nav className="flex flex-col items-center gap-1 flex-1 w-full px-2" aria-label="Main navigation">
        {NAV_ITEMS.map(({ to, label, icon: navIcon }) => (
          <NavLink
            key={to}
            to={to}
            onClick={onMobileClose}
            title={label}
            className={({ isActive }) =>
              `group relative w-10 h-10 flex items-center justify-center rounded-[10px] transition-colors duration-150 ${
                isActive
                  ? 'bg-gw-blue/20 border border-gw-blue/35 text-blue-300'
                  : 'text-slate-500 hover:bg-white/[0.05] hover:text-slate-300'
              }`
            }
          >
            {navIcon}
            {/* Tooltip */}
            <span className="pointer-events-none absolute left-full ml-2 px-2 py-1 rounded-md bg-gw-surface border border-white/10 text-xs text-slate-200 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-150 z-50 shadow-lg">
              {label}
            </span>
          </NavLink>
        ))}
      </nav>

      {/* Settings pinned bottom */}
      <div className="w-full px-2 mt-auto flex flex-col items-center gap-1">
        <NavLink
          to="/settings"
          onClick={onMobileClose}
          title="Settings"
          className={({ isActive }) =>
            `group relative w-10 h-10 flex items-center justify-center rounded-[10px] transition-colors duration-150 ${
              isActive
                ? 'bg-gw-blue/20 border border-gw-blue/35 text-blue-300'
                : 'text-slate-500 hover:bg-white/[0.05] hover:text-slate-300'
            }`
          }
        >
          {icon(settingsPath)}
          <span className="pointer-events-none absolute left-full ml-2 px-2 py-1 rounded-md bg-gw-surface border border-white/10 text-xs text-slate-200 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-150 z-50 shadow-lg">
            Settings
          </span>
        </NavLink>
      </div>
    </aside>
  )
}
```

- [ ] **Step 2: Rewrite ProtectedLayout.tsx**

```tsx
// web/src/layouts/ProtectedLayout.tsx
import { NavLink, Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { CoordinatorLayout } from '../components/CoordinatorLayout'

const BOTTOM_NAV = [
  { to: '/dashboard', label: 'Home',     d: 'M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2V9z' },
  { to: '/classes',   label: 'Classes',  d: 'M4 19.5A2.5 2.5 0 016.5 17H20M4 19.5A2.5 2.5 0 004 17V5a2 2 0 012-2h14a2 2 0 012 2v12a2.5 2.5 0 01-2.5 2.5H4z' },
  { to: '/schedule',  label: 'Schedule', d: 'M19 4H5a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2V6a2 2 0 00-2-2zM16 2v4M8 2v4M3 10h18' },
  { to: '/reports',   label: 'Reports',  d: 'M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8zM14 2v6h6M16 13H8M16 17H8M10 9H8' },
]

function PageTitle() {
  const { pathname } = useLocation()
  const map: Record<string, string> = {
    '/dashboard': 'Dashboard', '/classes': 'Classes', '/students': 'Students',
    '/trainers': 'Trainers', '/reports': 'Reports', '/schedule': 'Schedule',
    '/payroll/trainers': 'Trainer Payroll', '/payroll/students': 'Student Payroll',
    '/settings': 'Settings',
  }
  if (pathname.startsWith('/classes/')) return 'Class Detail'
  if (pathname.startsWith('/students/progress/')) return 'Student Progress'
  return map[pathname] ?? 'Gateway'
}

export function ProtectedLayout() {
  const { session, role, loading, signOut } = useAuth()

  if (loading || role === null) {
    if (!session && !loading) return <Navigate to="/login" replace />
    return (
      <div className="min-h-screen flex items-center justify-center bg-gw-darkest text-slate-500 text-sm">
        Loading…
      </div>
    )
  }

  if (!session) return <Navigate to="/login" replace />

  if (role === 'coordinator') {
    return (
      <div className="min-h-screen w-screen flex bg-gw-darkest text-slate-100">
        {/* Desktop icon sidebar */}
        <CoordinatorLayout mobileOpen={false} onMobileClose={() => {}} />

        <div className="flex-1 flex flex-col min-h-screen min-w-0">
          {/* Mobile top bar */}
          <div className="md:hidden flex items-center justify-between bg-gw-darkest border-b border-white/[0.06] px-4 h-14 shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-[8px] bg-gradient-to-br from-gw-blue to-gw-teal flex items-center justify-center">
                <span className="text-white font-bold text-xs select-none">G</span>
              </div>
              <span className="text-sm font-semibold text-slate-100"><PageTitle /></span>
            </div>
            <button
              type="button"
              onClick={signOut}
              className="text-xs text-slate-500 hover:text-slate-300 transition-colors"
            >
              Sign out
            </button>
          </div>

          {/* Main content */}
          <main className="flex-1 px-4 md:px-6 py-4 md:py-6 pb-20 md:pb-6 overflow-auto">
            <Outlet />
          </main>
        </div>

        {/* Mobile bottom nav */}
        <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 flex justify-around items-center bg-gw-darkest/95 border-t border-white/[0.06] backdrop-blur-sm pb-safe">
          {BOTTOM_NAV.map(({ to, label, d }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `flex flex-col items-center gap-0.5 py-2.5 px-4 transition-colors duration-100 ${
                  isActive ? 'text-gw-blue' : 'text-slate-500'
                }`
              }
            >
              <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                <path d={d} />
              </svg>
              <span className="text-[10px] font-medium">{label}</span>
            </NavLink>
          ))}
        </nav>
      </div>
    )
  }

  // Non-coordinator layout
  return (
    <div className="min-h-screen bg-gw-darkest flex flex-col">
      <header className="px-6 py-4 border-b border-white/[0.06] bg-gw-surface flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-[8px] bg-gradient-to-br from-gw-blue to-gw-teal flex items-center justify-center">
            <span className="text-white font-bold text-xs select-none">G</span>
          </div>
          <h1 className="text-sm font-semibold text-slate-100">Gateway Training Tool</h1>
        </div>
        <button
          type="button"
          onClick={signOut}
          className="rounded-md border border-rose-500/25 bg-rose-500/10 px-3 py-1.5 text-sm font-medium text-rose-400 hover:bg-rose-500/20 transition-colors duration-150"
        >
          Sign out
        </button>
      </header>
      <main className="flex-1 flex items-start justify-center px-4 py-10">
        <Outlet />
      </main>
    </div>
  )
}
```

- [ ] **Step 3: Verify build**

```bash
cd /Users/garr/Documents/GatewayTrainingTool/web && npm run build
```
Expected: build succeeds.

- [ ] **Step 4: Commit**

```bash
cd /Users/garr/Documents/GatewayTrainingTool
git add web/src/components/CoordinatorLayout.tsx web/src/layouts/ProtectedLayout.tsx
git commit -m "feat: replace sidebar with 64px icon nav, add mobile bottom nav"
```

---

## Task 3: Skeleton Component

**Files:**
- Modify: `web/src/components/Skeleton.tsx`

- [ ] **Step 1: Rewrite Skeleton.tsx with dark shimmer**

```tsx
// web/src/components/Skeleton.tsx
const WIDTHS = ['w-full', 'w-3/4', 'w-1/2', 'w-5/6']

const shimmer = 'animate-shimmer rounded'

export function SkeletonText({ className = '' }: { className?: string }) {
  return <div className={`h-3 ${shimmer} ${className}`} />
}

export function SkeletonCard({ lines = 3 }: { lines?: number }) {
  return (
    <div className="rounded-[10px] bg-gw-surface p-4">
      <div className={`h-4 w-1/3 ${shimmer} mb-3`} />
      {Array.from({ length: lines }, (_, i) => (
        <div
          key={i}
          className={`h-3 ${shimmer} mt-2 ${WIDTHS[i % WIDTHS.length]}`}
          style={{ animationDelay: `${i * 0.1}s` }}
        />
      ))}
    </div>
  )
}

export function SkeletonTable({ rows = 5, cols = 4 }: { rows?: number; cols?: number }) {
  return (
    <div className="rounded-[10px] bg-gw-surface overflow-hidden">
      <div className="bg-white/[0.02] px-4 py-3 flex gap-4 border-b border-white/[0.06]">
        {Array.from({ length: cols }, (_, i) => (
          <div key={i} className={`h-3 w-20 ${shimmer}`} style={{ animationDelay: `${i * 0.05}s` }} />
        ))}
      </div>
      {Array.from({ length: rows }, (_, r) => (
        <div key={r} className="border-t border-white/[0.03] px-4 py-3 flex gap-4">
          {Array.from({ length: cols }, (_, c) => (
            <div
              key={c}
              className={`h-3 ${shimmer} ${c === 0 ? 'w-[30%]' : 'w-[15%]'}`}
              style={{ animationDelay: `${(r * cols + c) * 0.04}s` }}
            />
          ))}
        </div>
      ))}
    </div>
  )
}
```

- [ ] **Step 2: Verify build**

```bash
cd /Users/garr/Documents/GatewayTrainingTool/web && npm run build
```

- [ ] **Step 3: Commit**

```bash
cd /Users/garr/Documents/GatewayTrainingTool
git add web/src/components/Skeleton.tsx
git commit -m "feat: dark shimmer skeletons"
```

---

## Task 4: EmptyState, ConfirmDialog, Toast

**Files:**
- Modify: `web/src/components/EmptyState.tsx`
- Modify: `web/src/components/ConfirmDialog.tsx`
- Modify: `web/src/contexts/ToastContext.tsx`

- [ ] **Step 1: Rewrite EmptyState.tsx**

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
    <div className="flex flex-col items-center justify-center py-12 text-center">
      {icon && (
        <div className="mb-4 w-14 h-14 rounded-[14px] bg-gw-blue/15 border border-gw-blue/25 flex items-center justify-center text-blue-400">
          {icon}
        </div>
      )}
      <p className="text-base font-semibold text-slate-200">{title}</p>
      {description && <p className="mt-1.5 text-sm text-slate-500 max-w-xs">{description}</p>}
      {action && (
        <button
          type="button"
          onClick={action.onClick}
          className="mt-4 inline-flex items-center gap-1.5 rounded-md bg-gradient-to-r from-gw-blue to-gw-teal px-4 py-2 text-sm font-semibold text-white hover:brightness-110 transition-all duration-150"
        >
          {action.label}
        </button>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Rewrite ConfirmDialog.tsx**

```tsx
// web/src/components/ConfirmDialog.tsx
type ConfirmDialogProps = {
  open: boolean
  title: string
  message: string
  confirmLabel?: string
  confirmVariant?: 'danger' | 'primary'
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Confirm',
  confirmVariant = 'primary',
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  if (!open) return null

  const confirmClass =
    confirmVariant === 'danger'
      ? 'bg-rose-500/15 text-rose-400 border border-rose-500/25 hover:bg-rose-500/25'
      : 'bg-gradient-to-r from-gw-blue to-gw-teal text-white hover:brightness-110'

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 animate-backdrop-in"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-title"
    >
      <div className="w-full max-w-sm rounded-[14px] bg-gw-surface border border-white/[0.08] shadow-2xl animate-modal-in">
        <div className="px-5 py-5">
          <h2 id="confirm-dialog-title" className="text-base font-bold text-slate-100">
            {title}
          </h2>
          <p className="mt-2 text-sm text-slate-400">{message}</p>
        </div>
        <div className="flex gap-2 justify-end border-t border-white/[0.06] px-5 py-3">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-md bg-gw-elevated border border-white/10 px-4 py-2 text-sm font-medium text-slate-300 hover:bg-white/[0.08] transition-colors duration-150"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={`rounded-md px-4 py-2 text-sm font-medium transition-all duration-150 ${confirmClass}`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Rewrite toast rendering in ToastContext.tsx**

Replace only the `TOAST_COLORS` constant and the JSX inside the `ToastProvider` return. The state/hook logic is unchanged.

```tsx
// web/src/contexts/ToastContext.tsx
// Replace TOAST_COLORS with:
const TOAST_LEFT_BORDER: Record<ToastType, string> = {
  success: 'border-l-emerald-400',
  error:   'border-l-rose-400',
  info:    'border-l-gw-blue',
}

const TOAST_ICON_COLOR: Record<ToastType, string> = {
  success: 'text-emerald-400 bg-emerald-400/10',
  error:   'text-rose-400 bg-rose-400/10',
  info:    'text-blue-400 bg-blue-400/10',
}

const TOAST_ICON: Record<ToastType, string> = {
  success: '✓',
  error:   '✕',
  info:    'i',
}
```

Replace the JSX return inside `ToastProvider` with:

```tsx
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 pointer-events-none">
        {toasts.map(t => (
          <div
            key={t.id}
            className={`pointer-events-auto animate-toast-in flex items-start gap-3 rounded-[10px] border border-white/[0.08] border-l-4 ${TOAST_LEFT_BORDER[t.type]} bg-gw-surface px-4 py-3 shadow-xl min-w-[260px] max-w-sm`}
          >
            <div className={`mt-0.5 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${TOAST_ICON_COLOR[t.type]}`}>
              {TOAST_ICON[t.type]}
            </div>
            <span className="flex-1 text-sm text-slate-200">{t.message}</span>
            <button
              type="button"
              onClick={() => removeToast(t.id)}
              className="ml-1 shrink-0 rounded p-0.5 text-slate-500 hover:text-slate-300 transition-colors"
              aria-label="Dismiss"
            >
              <svg className="h-3.5 w-3.5" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M1 1l12 12M13 1L1 13" />
              </svg>
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
```

- [ ] **Step 4: Verify build**

```bash
cd /Users/garr/Documents/GatewayTrainingTool/web && npm run build
```

- [ ] **Step 5: Commit**

```bash
cd /Users/garr/Documents/GatewayTrainingTool
git add web/src/components/EmptyState.tsx web/src/components/ConfirmDialog.tsx web/src/contexts/ToastContext.tsx
git commit -m "feat: dark EmptyState, ConfirmDialog, and Toast components"
```

---

## Task 5: Pagination Component

**Files:**
- Modify: `web/src/components/Pagination.tsx`

- [ ] **Step 1: Read the current Pagination.tsx to understand its structure**

Read `web/src/components/Pagination.tsx` and replace the button/text classes:
- Container: keep structure, change any `bg-white` → `bg-gw-surface` or remove
- Buttons: `rounded-md bg-gw-elevated border border-white/10 px-3 py-1.5 text-xs text-slate-300 hover:bg-white/[0.08] disabled:opacity-40 disabled:cursor-not-allowed transition-colors duration-150`
- Page info text: `text-xs text-slate-500`
- Active page indicator if any: `bg-gw-blue/20 text-blue-300 border-gw-blue/35`

- [ ] **Step 2: Verify build**

```bash
cd /Users/garr/Documents/GatewayTrainingTool/web && npm run build
```

- [ ] **Step 3: Commit**

```bash
cd /Users/garr/Documents/GatewayTrainingTool
git add web/src/components/Pagination.tsx
git commit -m "feat: dark Pagination component"
```

---

## Task 6: Dashboard Page

**Files:**
- Modify: `web/src/pages/DashboardContent.tsx`

Key changes:
- Remove the sign-out button from the page header (it's now in the sidebar/top bar)
- Section cards: `bg-white shadow-sm` → `bg-gw-surface`
- Card headings: `text-slate-900` → `text-slate-100`
- Stat values: `text-gw-dark` → `text-slate-100`
- Province badges (dark-mode versions)
- Table: `border-slate-200 bg-white` → `bg-gw-surface`, header `bg-slate-100` → `bg-white/[0.02] border-b border-white/[0.06]`
- Row hover: `hover:bg-slate-50` → `hover:bg-gw-elevated`
- Quick action buttons: primary → gradient, secondary → dark surface
- Alert section: amber dark version
- Subtitle text: `text-slate-500` → `text-slate-500` (same, keep)

- [ ] **Step 1: Replace provinceBadge map**

In `DashboardContent.tsx`, find:
```tsx
const provinceBadge: Record<Province, string> = {
  BC: 'bg-emerald-100 text-emerald-700',
  AB: 'bg-amber-100 text-amber-700',
  ON: 'bg-blue-100 text-blue-700',
}
```
Replace with:
```tsx
const provinceBadge: Record<Province, string> = {
  BC: 'bg-blue-500/15 text-blue-300',
  AB: 'bg-orange-400/15 text-orange-300',
  ON: 'bg-purple-500/15 text-purple-300',
}
```

- [ ] **Step 2: Update page header — remove sign-out, darken text**

Replace:
```tsx
      <header className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Dashboard</h2>
          <p className="mt-0.5 text-xs text-slate-500">Coordinator overview</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex flex-col items-end gap-1">
            <span className="text-[10px] font-semibold tracking-[0.16em] uppercase text-slate-500">Coordinator</span>
            <span className="text-xs text-slate-800">{email}</span>
            <button
              type="button"
              className="mt-1 inline-flex items-center rounded-md border border-slate-300 px-2 py-1 text-[11px] text-slate-700 hover:border-slate-400"
              onClick={signOut}
            >
              Sign out
            </button>
          </div>
        </div>
      </header>
```
With:
```tsx
      <header className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-100">Dashboard</h2>
          <p className="mt-0.5 text-xs text-slate-500">Coordinator overview · {email}</p>
        </div>
        <button
          type="button"
          onClick={() => setCreateOpen(true)}
          className="inline-flex items-center gap-1.5 rounded-md bg-gradient-to-r from-gw-blue to-gw-teal px-4 py-2 text-sm font-semibold text-white hover:brightness-110 transition-all duration-150"
        >
          <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M12 5v14M5 12h14"/></svg>
          Create class
        </button>
      </header>
```
Also remove the `signOut` import destructure from `useAuth()` if it's no longer used (keep `email`).

- [ ] **Step 3: Update summary cards**

Replace each `<section className="rounded-xl bg-white p-4 shadow-sm min-h-[110px]">` with `<section className="rounded-[10px] bg-gw-surface p-4 min-h-[110px]">`.

Replace `<h3 className="text-sm font-semibold text-slate-900 mb-2">` with `<h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">`.

Replace `<p className="text-2xl font-bold text-gw-dark">` with `<p className="text-2xl font-bold text-slate-100">`.

The "Active classes" card — keep it as the highlighted gradient variant:
```tsx
        <section className="rounded-[10px] p-4 min-h-[110px] bg-gradient-to-br from-gw-blue/20 to-gw-teal/20 border border-gw-blue/25">
```

- [ ] **Step 4: Remove the separate quick actions section**

Delete the entire `{/* ── Quick actions ─────────────────────────────────────────── */}` block (the three navigation buttons) since the CTA is now in the header and navigation is in the sidebar.

- [ ] **Step 5: Update alert section**

Replace:
```tsx
        <section className="mt-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
```
With:
```tsx
        <section className="mt-2 rounded-[10px] border border-amber-500/25 bg-amber-500/10 px-4 py-3">
```
Replace `text-amber-800` → `text-amber-300`, `text-amber-700` → `text-amber-400`, `text-amber-600` → `text-amber-400`, `hover:text-amber-900` → `hover:text-amber-200`.

- [ ] **Step 6: Update today's sessions section**

Replace `<section className="mt-2 rounded-xl bg-white p-4 shadow-sm">` with `<section className="mt-2 rounded-[10px] bg-gw-surface p-4">`.

Table changes:
- `border-b border-slate-200 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500` → keep as-is (already matches spec)
- `border-b border-slate-100 last:border-0 cursor-pointer hover:bg-slate-50 transition-colors` → `border-b border-white/[0.03] last:border-0 cursor-pointer hover:bg-gw-elevated transition-colors duration-100`
- `font-medium text-gw-dark` → `font-medium text-slate-200`
- `text-slate-600` (time/trainer/group cells) → `text-slate-400`
- Empty state paragraph: `text-xs text-slate-500` → keep same

- [ ] **Step 7: Update active classes section**

Replace section wrapper: `bg-white p-4 shadow-sm` → `bg-gw-surface p-4`.
`text-slate-900` heading → `text-slate-100`.
`text-gw-blue hover:underline` "View all" link → `text-blue-400 hover:text-blue-300 transition-colors`.
List items: `hover:bg-slate-50` → `hover:bg-gw-elevated`, `divide-slate-100` → `divide-white/[0.04]`.
Class name `text-gw-dark` → `text-slate-200`.
Site `text-slate-500` → `text-slate-500` (unchanged).

- [ ] **Step 8: Verify build**

```bash
cd /Users/garr/Documents/GatewayTrainingTool/web && npm run build
```

- [ ] **Step 9: Commit**

```bash
cd /Users/garr/Documents/GatewayTrainingTool
git add web/src/pages/DashboardContent.tsx
git commit -m "feat: dark dashboard page"
```

---

## Task 7: Classes Page

**Files:**
- Modify: `web/src/pages/ClassesPage.tsx`

- [ ] **Step 1: Remove sign-out button from header, darken header text**

Replace the entire `<header>` block's content with:
```tsx
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 flex-shrink-0">
        <div>
          <h2 className="text-xl font-bold text-slate-100">Classes</h2>
          <p className="mt-0.5 text-xs text-slate-500">Create and manage training classes</p>
        </div>
        <button
          type="button"
          onClick={() => setCreateOpen(true)}
          className="inline-flex items-center rounded-md bg-gradient-to-r from-gw-blue to-gw-teal px-4 py-2 text-sm font-semibold text-white hover:brightness-110 transition-all duration-150"
        >
          + Create class
        </button>
      </header>
```
Remove `email` and `signOut` from `useAuth()` destructure if no longer used.

- [ ] **Step 2: Update the selectClass shared style variable**

Replace:
```tsx
  const selectClass = "rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-700 focus:border-gw-blue focus:outline-none focus:ring-1 focus:ring-gw-blue"
```
With:
```tsx
  const selectClass = "rounded-md border border-white/10 bg-gw-elevated px-2.5 py-1.5 text-xs text-slate-300 focus:border-gw-blue/40 focus:outline-none focus:ring-2 focus:ring-gw-blue/15 placeholder:text-slate-500"
```

- [ ] **Step 3: Update filter bar container**

Replace `<div className="mt-4 rounded-xl border border-slate-200 bg-white p-3 flex-shrink-0">` with `<div className="mt-4 rounded-[10px] bg-gw-surface p-3 flex-shrink-0">`.

Replace each `<label className="block text-[11px] font-medium text-slate-600">` with `<label className="block text-[11px] font-medium text-slate-400">`.

Replace Reset button: `text-gw-dark hover:underline` → `text-slate-400 hover:text-slate-200 transition-colors`.

- [ ] **Step 4: Update "no results" empty state**

Replace the inline dashed-border empty state when `filteredActive.length === 0 && filteredArchived.length === 0 && hasFilters`:
```tsx
          <div className="rounded-[10px] bg-gw-surface p-10 text-center">
            <p className="text-sm text-slate-400">No classes match your filters</p>
            <button
              type="button"
              onClick={resetFilters}
              className="mt-3 text-xs text-blue-400 hover:text-blue-300 transition-colors"
            >
              Reset filters
            </button>
          </div>
```

- [ ] **Step 5: Update section headings**

`text-slate-500` → `text-slate-400` for "Active" heading (already correct).
`text-slate-400` → `text-slate-500` for "Archived" heading.

- [ ] **Step 6: Update "no active classes" empty state**

Replace dashed-border block inside `filteredActive.length === 0`:
```tsx
                <div className="rounded-[10px] bg-gw-surface p-10 text-center">
                  <p className="text-base font-semibold text-slate-200">No active classes</p>
                  <p className="mt-1.5 text-sm text-slate-500">Create your first class to get started.</p>
                  <button
                    type="button"
                    onClick={() => setCreateOpen(true)}
                    className="mt-4 inline-flex items-center rounded-md bg-gradient-to-r from-gw-blue to-gw-teal px-4 py-2 text-sm font-semibold text-white hover:brightness-110 transition-all duration-150"
                  >
                    + Create class
                  </button>
                </div>
```

- [ ] **Step 7: Update active classes table**

Table container: `rounded-xl border border-slate-200 bg-white overflow-hidden` → `rounded-[10px] bg-gw-surface overflow-hidden`.

Header row: `border-b border-slate-200 bg-gw-dark` → `border-b border-white/[0.06] bg-white/[0.02]`.
Header cells: `font-medium text-white` → `text-xs font-semibold uppercase tracking-wide text-slate-500`.

Body rows: `border-b border-slate-100 hover:bg-blue-50 cursor-pointer` → `border-b border-white/[0.03] hover:bg-gw-elevated cursor-pointer transition-colors duration-100`.
Name cell: `font-medium text-gw-dark` → `font-medium text-slate-200`.
Other cells: `text-slate-600` → `text-slate-400`.

Archive button: `rounded-md border border-slate-300 px-2 py-1 text-[11px] text-slate-600 hover:bg-slate-50` → `rounded-md border border-white/10 bg-gw-elevated px-2 py-1 text-[11px] text-slate-400 hover:bg-white/[0.08] transition-colors`.

- [ ] **Step 8: Update archived classes table**

Container: `rounded-xl border border-slate-200 bg-white overflow-hidden opacity-80` → `rounded-[10px] bg-gw-surface overflow-hidden opacity-70`.

Header row: `border-b border-slate-200 bg-slate-100` → `border-b border-white/[0.06] bg-white/[0.02]`.
Header cells: `font-medium text-slate-600` → `text-xs font-semibold uppercase tracking-wide text-slate-500`.

Body rows: `border-b border-slate-100` → `border-b border-white/[0.03]`.
Name cell: `font-medium text-slate-500` → `font-medium text-slate-400`.
Other cells: `text-slate-400` → `text-slate-500`.

Unarchive button: `rounded-md border border-slate-300 px-2 py-1 text-[11px] text-slate-600 hover:bg-slate-50` → `rounded-md border border-white/10 bg-gw-elevated px-2 py-1 text-[11px] text-slate-400 hover:bg-white/[0.08] transition-colors`.
Delete button: `rounded-md border border-rose-200 px-2 py-1 text-[11px] text-rose-600 hover:bg-rose-50` → `rounded-md border border-rose-500/25 bg-rose-500/10 px-2 py-1 text-[11px] text-rose-400 hover:bg-rose-500/20 transition-colors`.

- [ ] **Step 9: Verify build**

```bash
cd /Users/garr/Documents/GatewayTrainingTool/web && npm run build
```

- [ ] **Step 10: Commit**

```bash
cd /Users/garr/Documents/GatewayTrainingTool
git add web/src/pages/ClassesPage.tsx
git commit -m "feat: dark Classes page"
```

---

## Task 8: Class Detail Pages

**Files:**
- Modify: `web/src/pages/ClassDetailPage.tsx`
- Modify: `web/src/pages/ClassDetailView.tsx`

- [ ] **Step 1: Read ClassDetailPage.tsx and ClassDetailView.tsx**

Read both files before editing. `ClassDetailPage.tsx` likely owns the tab bar; `ClassDetailView.tsx` owns the tab content layout.

- [ ] **Step 2: Update ClassDetailPage.tsx — tab bar**

Find the tab bar rendering. Replace each inactive tab with:
```tsx
className={`relative px-4 py-2.5 text-sm transition-colors duration-150 ${
  isActive
    ? 'font-semibold text-slate-100'
    : 'text-slate-500 hover:text-slate-300'
}`}
```
Add a conditional gradient underline span for the active tab:
```tsx
{isActive && (
  <span className="absolute bottom-[-1px] left-0 right-0 h-0.5 bg-gradient-to-r from-gw-blue to-gw-teal rounded-t" />
)}
```
Tab bar container: `border-b border-slate-200` → `border-b border-white/[0.06]`.

Page header: any `bg-white`, `text-slate-900`, `border-slate-200` → dark equivalents per spec.
Back link: `text-slate-500 hover:underline` → `text-slate-500 hover:text-slate-300 transition-colors text-sm`.
Page title: `text-xl font-bold text-slate-100`.
Action buttons: apply primary gradient and dark secondary styles from spec.

- [ ] **Step 3: Update ClassDetailView.tsx — overview stat cards and content**

Stat cards: `bg-white shadow-sm rounded-xl` → `bg-gw-surface rounded-[10px]`.
Card headings: `text-slate-900` / `text-sm font-semibold` → `text-xs font-semibold uppercase tracking-wider text-slate-400`.
Stat values: `text-gw-dark` / large numbers → `text-slate-100`.
Any tables within tabs: apply same dark table pattern from Task 7, steps 7–8.
Status badge classes: update to match spec (emerald/amber/rose on dark).
Any `bg-slate-100`, `border-slate-200` dividers → `border-white/[0.06]`.

- [ ] **Step 4: Verify build**

```bash
cd /Users/garr/Documents/GatewayTrainingTool/web && npm run build
```

- [ ] **Step 5: Commit**

```bash
cd /Users/garr/Documents/GatewayTrainingTool
git add web/src/pages/ClassDetailPage.tsx web/src/pages/ClassDetailView.tsx
git commit -m "feat: dark Class detail pages with gradient tab underline"
```

---

## Task 9: Reports Page + Components

**Files:**
- Modify: `web/src/pages/ReportsPage.tsx`
- Modify: `web/src/components/ReportsFilterBar.tsx`
- Modify: `web/src/components/ReportsTable.tsx`

- [ ] **Step 1: Read all three files**

Read each before editing.

- [ ] **Step 2: Update ReportsPage.tsx header**

```tsx
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 flex-shrink-0">
        <div>
          <h2 className="text-xl font-bold text-slate-100">Daily Reports</h2>
          <p className="mt-0.5 text-xs text-slate-500">{total} report{total !== 1 ? 's' : ''} found</p>
        </div>
        <button
          type="button"
          onClick={handleExport}
          className="inline-flex items-center gap-1.5 rounded-md bg-gradient-to-r from-gw-blue to-gw-teal px-4 py-2 text-sm font-semibold text-white hover:brightness-110 transition-all duration-150 disabled:opacity-50"
          disabled={reports.length === 0}
        >
          Export PDF
        </button>
      </header>
```
(Keep existing `handleExport` logic — only change the JSX.)

Remove any sign-out or email display from the page header.

- [ ] **Step 3: Update ReportsFilterBar.tsx**

Filter bar container: `rounded-xl border border-slate-200 bg-white p-3` → `rounded-[10px] bg-gw-surface p-3`.
Labels: `text-slate-600` → `text-slate-400`.
Select/input elements: apply `selectClass` pattern: `rounded-md border border-white/10 bg-gw-elevated px-2.5 py-1.5 text-xs text-slate-300 focus:border-gw-blue/40 focus:outline-none focus:ring-2 focus:ring-gw-blue/15`.
Reset/Clear button: `text-gw-dark hover:underline` → `text-slate-400 hover:text-slate-200 transition-colors text-xs`.
Checkbox label text: `text-slate-700` → `text-slate-300`.

- [ ] **Step 4: Update ReportsTable.tsx**

Table container: `rounded-xl border border-slate-200 bg-white overflow-hidden` → `rounded-[10px] bg-gw-surface overflow-hidden`.
Header row: `bg-slate-50` or `bg-gw-dark` → `bg-white/[0.02] border-b border-white/[0.06]`.
Header cells: `text-xs font-semibold uppercase tracking-wide text-slate-500`.
Body rows: `border-b border-slate-100 hover:bg-slate-50` → `border-b border-white/[0.03] hover:bg-gw-elevated transition-colors duration-100`.
Text cells: `text-slate-600` → `text-slate-400`, key cells → `text-slate-200`.
Province badges: replace existing badge classes with:
  - BC: `bg-blue-500/15 text-blue-300`
  - AB: `bg-orange-400/15 text-orange-300`
  - ON: `bg-purple-500/15 text-purple-300`
"View" link: `text-gw-blue hover:underline` → `text-blue-400 hover:text-blue-300 transition-colors text-sm`.
Loading spinner: any light spinner → replace with `<div className="w-4 h-4 rounded-full border-2 border-gw-blue/30 border-t-gw-blue animate-spin" />`.

- [ ] **Step 5: Verify build**

```bash
cd /Users/garr/Documents/GatewayTrainingTool/web && npm run build
```

- [ ] **Step 6: Commit**

```bash
cd /Users/garr/Documents/GatewayTrainingTool
git add web/src/pages/ReportsPage.tsx web/src/components/ReportsFilterBar.tsx web/src/components/ReportsTable.tsx
git commit -m "feat: dark Reports page and components"
```

---

## Task 10: Roster, Schedule, Payroll, Settings, StudentProgress Pages

**Files:**
- Modify: `web/src/pages/RosterPage.tsx`
- Modify: `web/src/pages/SchedulePage.tsx`
- Modify: `web/src/components/ScheduleFilterBar.tsx`
- Modify: `web/src/components/ScheduleTable.tsx`
- Modify: `web/src/components/ScheduleCalendar.tsx`
- Modify: `web/src/pages/TrainerPayrollPage.tsx`
- Modify: `web/src/pages/StudentPayrollPage.tsx`
- Modify: `web/src/components/PayrollFilterBar.tsx`
- Modify: `web/src/components/PayrollTable.tsx`
- Modify: `web/src/pages/SettingsContent.tsx`
- Modify: `web/src/pages/StudentProgressPage.tsx`

Read each file before editing. Apply the same consistent dark patterns throughout:

**Page header pattern** (apply to every page):
```tsx
<header className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 flex-shrink-0 mb-4">
  <div>
    <h2 className="text-xl font-bold text-slate-100">{PAGE_TITLE}</h2>
    <p className="mt-0.5 text-xs text-slate-500">{SUBTITLE}</p>
  </div>
  {/* CTA button if applicable */}
</header>
```

**Filter bar pattern** (apply to every filter bar component):
- Container: `rounded-[10px] bg-gw-surface p-3`
- Labels: `text-[11px] font-medium text-slate-400`
- Inputs/selects: `rounded-md border border-white/10 bg-gw-elevated px-2.5 py-1.5 text-xs text-slate-300 focus:border-gw-blue/40 focus:outline-none focus:ring-2 focus:ring-gw-blue/15`

**Table pattern** (apply to every table component):
- Container: `rounded-[10px] bg-gw-surface overflow-hidden`
- Header: `bg-white/[0.02] border-b border-white/[0.06]`, cells `text-xs font-semibold uppercase tracking-wide text-slate-500`
- Body rows: `border-b border-white/[0.03] hover:bg-gw-elevated transition-colors duration-100`
- Text: primary cell content `text-slate-200`, secondary `text-slate-400`

**ScheduleCalendar.tsx specific:**
- Calendar container: `bg-gw-surface rounded-[10px]`
- Day cells: default `bg-gw-elevated`, today highlight `bg-gw-blue/20 border border-gw-blue/35`
- Day number: `text-slate-300`, today `text-blue-300`
- Event pills: `bg-gw-blue/20 text-blue-300 text-xs rounded px-1.5`
- Nav buttons (prev/next month): dark secondary style

**SettingsContent.tsx specific:**
- Section cards: `bg-gw-surface rounded-[10px] p-4`
- Form labels: `text-xs font-medium text-slate-400`
- Form inputs: dark input pattern
- Save/update buttons: primary gradient

**Remove sign-out buttons from all page headers** — they're handled by the shell layout now.

- [ ] **Step 1: Read and update RosterPage.tsx**

```tsx
// Page header:
<header className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 flex-shrink-0 mb-4">
  <div>
    <h2 className="text-xl font-bold text-slate-100">{title}</h2>
    <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p>
  </div>
</header>
// Search input: apply dark input pattern (border-white/10 bg-gw-elevated text-slate-300)
// Table: apply dark table pattern
// Empty state text: text-slate-500
// Row click highlight: hover:bg-gw-elevated
```

- [ ] **Step 2: Read and update SchedulePage.tsx, ScheduleFilterBar.tsx, ScheduleTable.tsx, ScheduleCalendar.tsx**

Apply header, filter bar, table, and calendar patterns described above.

- [ ] **Step 3: Read and update TrainerPayrollPage.tsx, StudentPayrollPage.tsx, PayrollFilterBar.tsx, PayrollTable.tsx**

Apply header, filter bar, and table patterns.

- [ ] **Step 4: Read and update SettingsContent.tsx**

Apply settings card pattern. Remove any sign-out button.

- [ ] **Step 5: Read and update StudentProgressPage.tsx**

Apply header and table/card patterns. Province badges: use dark versions.

- [ ] **Step 6: Verify build**

```bash
cd /Users/garr/Documents/GatewayTrainingTool/web && npm run build
```

- [ ] **Step 7: Commit**

```bash
cd /Users/garr/Documents/GatewayTrainingTool
git add web/src/pages/RosterPage.tsx web/src/pages/SchedulePage.tsx \
  web/src/components/ScheduleFilterBar.tsx web/src/components/ScheduleTable.tsx \
  web/src/components/ScheduleCalendar.tsx web/src/pages/TrainerPayrollPage.tsx \
  web/src/pages/StudentPayrollPage.tsx web/src/components/PayrollFilterBar.tsx \
  web/src/components/PayrollTable.tsx web/src/pages/SettingsContent.tsx \
  web/src/pages/StudentProgressPage.tsx
git commit -m "feat: dark Roster, Schedule, Payroll, Settings, and StudentProgress pages"
```

---

## Task 11: Modals (CreateClassModal, EditClassModal, ReportPreviewModal)

**Files:**
- Modify: `web/src/components/CreateClassModal.tsx`
- Modify: `web/src/components/EditClassModal.tsx`
- Modify: `web/src/components/ReportPreviewModal.tsx`

Read each file before editing. Apply the dark modal pattern:

**Modal container pattern:**
```tsx
// Backdrop
<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 animate-backdrop-in">
  // Modal panel
  <div className="w-full max-w-lg rounded-[14px] bg-gw-surface border border-white/[0.08] shadow-2xl animate-modal-in">
    // Header
    <div className="flex items-center justify-between px-6 py-5 border-b border-white/[0.06]">
      <h2 className="text-base font-bold text-slate-100">{TITLE}</h2>
      <button onClick={onClose} className="w-7 h-7 rounded-md bg-white/[0.06] flex items-center justify-center text-slate-500 hover:text-slate-300 transition-colors">
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
      </button>
    </div>
    // Body
    <div className="px-6 py-5 flex flex-col gap-4">
      {/* Form fields */}
    </div>
    // Footer
    <div className="flex justify-end gap-2 px-6 py-4 border-t border-white/[0.06]">
      <button className="rounded-md bg-gw-elevated border border-white/10 px-4 py-2 text-sm font-medium text-slate-300 hover:bg-white/[0.08] transition-colors">Cancel</button>
      <button className="rounded-md bg-gradient-to-r from-gw-blue to-gw-teal px-4 py-2 text-sm font-semibold text-white hover:brightness-110 transition-all">{ACTION}</button>
    </div>
  </div>
</div>
```

**Form field pattern:**
```tsx
<div>
  <label className="block text-xs font-medium text-slate-400 mb-1.5">{LABEL}</label>
  <input
    className="w-full rounded-md border border-white/10 bg-gw-elevated px-3 py-2 text-sm text-slate-200 placeholder:text-slate-500 outline-none focus:border-gw-blue/40 focus:ring-2 focus:ring-gw-blue/15 transition-colors"
    ...
  />
</div>
```
Select elements: same classes as input but add appearance-none and a custom chevron, or just apply same border/bg/text pattern.

**ReportPreviewModal.tsx specific:** This modal likely shows a PDF preview. Keep the iframe/preview area intact. Apply dark modal chrome (header, close button, footer). The PDF preview area itself may remain white (PDFs are white) — wrap it in `<div className="bg-white rounded overflow-hidden">` to isolate it.

- [ ] **Step 1: Read and update CreateClassModal.tsx**

Apply modal container and form field patterns throughout. Remove any `bg-white`, `border-slate-200`, `text-slate-900`, `text-slate-700` modal chrome. Keep all form state, validation, and submission logic unchanged.

- [ ] **Step 2: Read and update EditClassModal.tsx**

Same as CreateClassModal — apply patterns, keep logic.

- [ ] **Step 3: Read and update ReportPreviewModal.tsx**

Apply dark modal chrome. Wrap the preview/iframe content in `<div className="bg-white rounded overflow-hidden">` if it renders HTML content.

- [ ] **Step 4: Verify build**

```bash
cd /Users/garr/Documents/GatewayTrainingTool/web && npm run build
```

- [ ] **Step 5: Commit**

```bash
cd /Users/garr/Documents/GatewayTrainingTool
git add web/src/components/CreateClassModal.tsx web/src/components/EditClassModal.tsx web/src/components/ReportPreviewModal.tsx
git commit -m "feat: dark modals (CreateClass, EditClass, ReportPreview)"
```

---

## Task 12: Login Page

**Files:**
- Modify: `web/src/pages/LoginView.tsx`

- [ ] **Step 1: Read LoginView.tsx**

Read the file, then apply:
- Page background: `bg-gw-darkest min-h-screen flex items-center justify-center`
- Card: `bg-gw-surface rounded-[14px] border border-white/[0.08] p-8 w-full max-w-sm shadow-2xl`
- Logo mark at top of card: `w-10 h-10 rounded-[12px] bg-gradient-to-br from-gw-blue to-gw-teal flex items-center justify-center mx-auto mb-5`
  - Inner: `<span className="text-white font-bold text-base">G</span>`
- Heading: `text-lg font-bold text-slate-100 text-center mb-1`
- Subheading: `text-sm text-slate-500 text-center mb-6`
- Form labels: `text-xs font-medium text-slate-400 mb-1.5 block`
- Form inputs: dark input pattern
- Submit button: primary gradient pattern
- Error text: `text-xs text-rose-400 mt-1`
- Any secondary links: `text-blue-400 hover:text-blue-300`

- [ ] **Step 2: Verify build**

```bash
cd /Users/garr/Documents/GatewayTrainingTool/web && npm run build
```

- [ ] **Step 3: Commit**

```bash
cd /Users/garr/Documents/GatewayTrainingTool
git add web/src/pages/LoginView.tsx
git commit -m "feat: dark Login page"
```

---

## Task 13: CollapsibleSection Component + Final Polish

**Files:**
- Modify: `web/src/components/CollapsibleSection.tsx`
- Modify: `web/src/components/PayrollFilterBar.tsx` (if not already done in Task 10)

- [ ] **Step 1: Read CollapsibleSection.tsx and apply dark styles**

Container: `bg-gw-surface rounded-[10px]`.
Header/trigger: `text-slate-300 hover:text-slate-100`, chevron icon `text-slate-500`.
Divider: `border-white/[0.06]`.
Body: keep structure, remove any `bg-white` or `border-slate-200`.

- [ ] **Step 2: Final build check**

```bash
cd /Users/garr/Documents/GatewayTrainingTool/web && npm run build
```
Expected: zero TypeScript errors.

- [ ] **Step 3: Start dev server and do a visual pass**

```bash
cd /Users/garr/Documents/GatewayTrainingTool/web && npm run dev
```
Open http://localhost:5173 and check:
- [ ] Login page looks dark and branded
- [ ] Dashboard loads with dark stat cards, dark tables
- [ ] Sidebar icon-only on desktop, bottom nav on mobile (resize browser)
- [ ] Classes page filter bar, tables are dark
- [ ] Toasts appear dark with colored left border (trigger an action)
- [ ] Modal opens with dark chrome (try creating a class)
- [ ] Empty states show the new icon pattern

- [ ] **Step 4: Final commit**

```bash
cd /Users/garr/Documents/GatewayTrainingTool
git add web/src/components/CollapsibleSection.tsx
git commit -m "feat: dark CollapsibleSection — UI redesign complete"
```
