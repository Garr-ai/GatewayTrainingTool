# UI Redesign — Gateway Training Tool

**Date:** 2026-04-02
**Status:** Approved
**Approach:** Contrast Zones (dark base, icon sidebar, zoned content)

---

## Overview

A full visual redesign of the Gateway Training Tool webapp to make it look modern, polished, and consistently branded. The current app suffers from a generic look, inconsistent styling across pages, and dated components. The redesign adopts a dark-mode "Contrast Zones" aesthetic built entirely with Tailwind CSS, preserving all existing Gateway brand colors and mobile responsiveness.

**Constraints:**
- Tailwind CSS only — no new UI libraries
- Keep existing Gateway brand color tokens
- Mobile-first — coordinators use the app on phones and tablets
- No changes to backend, routing, or data logic — UI/styling only

---

## Design System

### Color Palette

Two new Tailwind color tokens are added to `tailwind.config.js`:

| Token | Hex | Usage |
|---|---|---|
| `gw-darkest` | `#081C30` | Page background (existing) |
| `gw-dark` | `#134270` | — (existing, keep) |
| `gw-navy` | `#131371` | — (existing, keep) |
| `gw-teal` | `#137171` | Gradient end, accent (existing) |
| `gw-blue` | `#1E69B3` | Primary action, gradient start (existing) |
| `gw-blue-hover` | `#155A9A` | Button hover (existing) |
| `gw-surface` | `#0f1d2e` | **NEW** — cards, tables, modals |
| `gw-elevated` | `#111e30` | **NEW** — hover states, inputs, elevated rows |

**Surface layering system (3 tiers):**
- Layer 0 — Base: `bg-gw-darkest` (`#081C30`) — page background
- Layer 1 — Surface: `bg-gw-surface` (`#0f1d2e`) — cards, tables, modals, panels
- Layer 2 — Elevated: `bg-gw-elevated` (`#111e30`) — row hover, focused inputs, active states

**Accent / semantic colors (unchanged Tailwind defaults):**
- Primary gradient: `from-gw-blue to-gw-teal` (buttons, active stat cards, tab underlines)
- Success badges: `bg-emerald-500/15 text-emerald-300`
- Warning badges: `bg-amber-500/15 text-amber-300`
- Danger badges / archived: `bg-rose-500/15 text-rose-400`
- Province badges: BC = `bg-blue-500/15 text-blue-300`, AB = `bg-orange-400/15 text-orange-300`, ON = `bg-purple-500/15 text-purple-300`

**Border tokens:**
- Subtle (dividers): `border-white/[0.06]`
- Default (cards): `border-white/10`
- Focus / active: `border-gw-blue/40` + `ring-2 ring-gw-blue/15`

### Typography

Font stack unchanged (Tailwind system default / Inter where available).

| Role | Classes |
|---|---|
| Page title | `text-xl font-bold text-slate-100` |
| Section header | `text-xs font-semibold uppercase tracking-wider text-slate-400` |
| Body | `text-sm text-slate-300` |
| Label / caption | `text-xs uppercase tracking-wide text-slate-500` |
| Metric / stat | `text-2xl font-bold text-slate-100` |

### Spacing & Radius

| Element | Radius |
|---|---|
| Buttons, badges | `rounded-md` (6px) |
| Cards, inputs, table containers | `rounded-[10px]` |
| Modals, large panels | `rounded-[14px]` |
| Pills / status badges | `rounded-full` |

Page padding: `p-4` mobile / `p-6` desktop
Card padding: `p-4`
Section gap: `gap-4` mobile / `gap-6` desktop

---

## Navigation

### Desktop — Icon Sidebar (`w-16`)

A fixed 64px-wide sidebar replaces the current 224px text sidebar. It contains:
- **Logo mark** at top (gradient square with "G", `rounded-[10px]`)
- **Icon-only nav items** (`w-10 h-10 rounded-[10px]`): Dashboard, Classes, Students, Trainers, Schedule, Reports, Payroll
- **Active state:** `bg-gw-blue/20 border border-gw-blue/35`
- **Inactive state:** transparent, icon `text-slate-500`, hover `bg-white/5`
- **Settings** pinned to bottom
- **Avatar** (user initials circle) pinned above settings
- **Tooltips** on hover showing nav label (Tailwind `group/tooltip` pattern)

Sidebar background: `bg-white/[0.03] border-r border-white/[0.06]`

### Mobile — Top Bar + Bottom Nav

Replace the current hamburger + slide-out drawer with:
- **Top bar:** Logo mark + current page title + avatar. Height `h-14`. Background `bg-gw-darkest border-b border-white/[0.06]`.
- **Bottom nav:** 5 most-used destinations (Dashboard, Classes, Schedule, Reports, More). Fixed to bottom. Icons + labels. Active item: `text-gw-blue`. Background `bg-white/[0.02] border-t border-white/[0.06]`.
- **"More" item** opens a simple modal sheet for secondary nav items (Students, Trainers, Payroll, Settings).

---

## Components

### Buttons

| Variant | Classes |
|---|---|
| Primary | `bg-gradient-to-r from-gw-blue to-gw-teal text-white font-semibold rounded-md px-4 py-2 hover:brightness-110 transition-all duration-150` |
| Secondary | `bg-gw-surface text-slate-200 border border-white/10 rounded-md px-4 py-2 hover:bg-gw-elevated transition-colors duration-150` |
| Danger | `bg-rose-500/15 text-rose-400 border border-rose-500/25 rounded-md px-4 py-2 hover:bg-rose-500/20 transition-colors duration-150` |
| Ghost | `text-gw-blue underline underline-offset-2 hover:text-blue-300 transition-colors duration-150` |

### Stat Cards

Standard stat card (`bg-gw-surface rounded-[10px] p-4`):
- Label: `text-xs uppercase tracking-wide text-slate-500`
- Value: `text-2xl font-bold text-slate-100`
- Trend: `text-xs text-emerald-400` (positive) or `text-amber-400` (neutral)
- Icon: 36×36 rounded icon box, `bg-gw-blue/15` with matching stroke color

**Highlighted stat card** (active/key metric): `bg-gradient-to-br from-gw-blue/20 to-gw-teal/20 border border-gw-blue/25`

### Data Tables

Container: `bg-gw-surface rounded-[10px] overflow-hidden`

- Header row: `bg-white/[0.02] border-b border-white/[0.06]`, cells `text-xs uppercase tracking-wide text-slate-500 font-semibold`
- Body rows: no background, `border-b border-white/[0.03]`
- Hover row: `bg-gw-elevated`
- Alternating rows: optional `bg-white/[0.015]` on even rows
- Sub-text in cells (e.g., date range under class name): `text-xs text-slate-500`
- Action column: `text-slate-500 hover:text-slate-300` ellipsis or "View" link

### Form Inputs

All inputs: `bg-gw-elevated border border-white/10 rounded-md px-3 py-2 text-sm text-slate-200 placeholder:text-slate-500 outline-none`
Focus: `border-gw-blue/40 ring-2 ring-gw-blue/15`
Label: `text-xs font-medium text-slate-400 mb-1.5 block`

Selects follow same pattern; use a custom dropdown chevron icon in `text-slate-500`.

### Modals

Backdrop: `bg-black/60`
Container: `bg-gw-surface border border-white/[0.08] rounded-[14px] p-6 shadow-2xl`
Header: title `text-base font-bold text-slate-100` + close button `w-7 h-7 rounded-md bg-white/[0.06] text-slate-500 hover:text-slate-300`
Footer buttons: right-aligned, Secondary then Primary

Entrance animation: backdrop `animate-backdrop-in`, modal `animate-modal-in` (existing keyframes, update colors only).

### Status Badges

All badges: `text-xs font-medium px-2.5 py-0.5 rounded-full`

| Status | Classes |
|---|---|
| Active | `bg-emerald-500/15 text-emerald-300` |
| Pending | `bg-amber-500/15 text-amber-300` |
| Archived | `bg-rose-500/15 text-rose-400` |
| BC | `bg-blue-500/15 text-blue-300` |
| AB | `bg-orange-400/15 text-orange-300` |
| ON | `bg-purple-500/15 text-purple-300` |

### Tabs (Class Detail)

Tab bar: `border-b border-white/[0.06]`
Inactive tab: `text-sm text-slate-500 px-4 py-2.5 hover:text-slate-300 transition-colors`
Active tab: `text-sm font-semibold text-slate-100 px-4 py-2.5 relative` + a child `<span>` absolutely positioned at the bottom: `absolute bottom-[-1px] left-0 right-0 h-0.5 bg-gradient-to-r from-gw-blue to-gw-teal rounded-t`. The span is rendered conditionally (`isActive && <span ...>`), not via CSS pseudo-element, so it works with Tailwind's utility-only approach.

---

## Page Layouts

### Dashboard

```
[icon sidebar] | [page header: title + subtitle + CTA button]
               | [4-col stat row]
               | [2/3 recent classes table | 1/3 upcoming sessions]
```

- Page header shows current date and "N active sessions today"
- CTA: "+ New Class" primary button top-right
- Stat row collapses to 2×2 grid on mobile
- 2-col section stacks vertically on mobile

### Classes List

```
[icon sidebar] | [page header + "+ New Class"]
               | [search/filter bar (surface card)]
               | [classes table with status, site, trainee count, actions]
               | [pagination]
```

### Class Detail

```
[icon sidebar] | [breadcrumb + class name + badge row + action buttons]
               | [tab bar: Overview · Trainers · Students · Schedule · Drills · Reports]
               | [tab content area]
```

Overview tab: 3 stat cards (trainees, drills complete, avg score).
Other tabs: unchanged data, updated styling only.

### Reports

```
[icon sidebar] | [page header + "Export PDF" button]
               | [filter bar (surface card): class select, site select, date range, clear]
               | [reports table: date, class, province badge, present count, view link]
               | [pagination]
```

### All Other Pages (Students, Trainers, Schedule, Payroll, Settings)

Apply the same surface/elevated/base color system, updated table and form styles, and icon sidebar. No structural changes.

---

## Polish

### Loading Skeletons

Replace current `bg-slate-200 animate-pulse` skeletons with dark-theme shimmer:
- Base: `bg-gw-elevated rounded`
- Animation: new `@keyframes shimmer` in `index.css` — `background: linear-gradient(90deg, #111e30 25%, #1a2d42 50%, #111e30 75%)` with `background-size: 200% 100%` sweeping from `200% 0` to `-200% 0`
- Apply via a `animate-shimmer` utility class defined in `index.css`
- Stagger delays: `animation-delay: 0.1s` increments per element

### Empty States

Pattern: centered icon box + headline + body text + CTA
Icon box: `w-14 h-14 rounded-[14px] bg-gw-blue/15 border border-gw-blue/25` (primary) or `bg-white/[0.04] border-white/[0.08]` (neutral)
Headline: `text-base font-semibold text-slate-200`
Body: `text-sm text-slate-500`
CTA: Primary button (if there's an action) or Secondary button (e.g., "Clear Filters")

Replace all current dashed-border empty states with this pattern.

### Toast Notifications

Update existing toast component styling:
- Container: `bg-gw-surface border border-white/[0.08] rounded-[10px] px-4 py-3 shadow-xl`
- Left border accent: success `border-l-4 border-emerald-400`, error `border-l-4 border-rose-400`, info `border-l-4 border-gw-blue`
- Icon: small circle `w-5 h-5 rounded-full bg-{color}/15` with matching checkmark/×/i
- Title: `text-sm font-semibold text-slate-100`
- Body: `text-xs text-slate-500`
- Keep existing `animate-toast-in` keyframe, update colors only

### Transitions & Motion

| Interaction | Transition |
|---|---|
| Button hover | `transition-all duration-150` (brightness/color shift) |
| Row hover | `transition-colors duration-100` |
| Modal entrance | Backdrop fade + modal scale 95→100% + fade, `duration-150` |
| Tab switch | Gradient underline position, content fade `duration-150` |
| Toast slide-up | Existing `animate-toast-in`, retained |
| Page route change | Fade + `translate-y-1` → `translate-y-0`, `duration-200` |
| Mobile bottom nav | `transition-colors duration-100` on active state |

All transitions use `ease-out`. No bounce or spring animations — professional, not playful.

---

## Implementation Scope

**In scope:**
- `tailwind.config.js` — add `gw-surface`, `gw-elevated` color tokens
- `index.css` — update global body background, add any new keyframes
- `CoordinatorLayout.tsx` — full sidebar redesign (icon-only desktop, bottom nav mobile)
- `ProtectedLayout.tsx` — update shell background, mobile top bar
- All page components — apply new color tokens, updated table/card/form styles
- Shared components — Skeleton, Modal/ConfirmDialog, Toast (ToastContext), EmptyState (new shared component)

**Out of scope:**
- Routing changes
- Data fetching logic
- Backend / Supabase changes
- Trainer / Trainee dashboard views (currently "in progress" placeholders)
- New features of any kind
