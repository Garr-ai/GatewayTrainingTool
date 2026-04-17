# Mobile-Optimized Daily Report Entry — Design Spec

**Date:** 2026-04-16
**Status:** Draft (pending user review)
**Scope:** Refactor `ReportEditForm` into focused section components and add responsive mobile layouts — cards, a per-trainee detail modal, and a localStorage draft — so trainers can fill daily reports comfortably on a phone.

---

## 1. Goals & non-goals

**Goals**

- Daily report form is fully usable on a 390px-wide phone (iOS Safari + Android Chrome).
- No iOS zoom-on-focus on any input field.
- All tap targets ≥ 44×44px.
- Timeline reordering works on touch (arrow buttons replace drag).
- Per-trainee progress entry works on mobile (compact list → detail modal).
- Unsaved state survives an accidental app-switch or browser refresh (localStorage draft).
- `ReportEditForm`'s external props and `onSave` contract are unchanged — call sites need no edits.

**Non-goals (explicit)**

- Offline / service-worker support.
- PWA install prompt.
- Gesture interactions (swipe-to-delete, long-press menus).
- `StudentReportInput` mobile improvements (separate component, separate concern).
- Any server-side changes.
- Native app / React Native.

---

## 2. Current state (what exists)

- `web/src/components/ReportEditForm.tsx` — 562 lines, shared by `ClassReportsSection` (coordinator) and `TrainerReportsSection` (trainer). Manages all form state internally; calls `onSave(body)` on submit.
- Header fields use `grid-cols-1 md:grid-cols-3` — already responsive.
- Trainers, hours totals, coordinator notes are already single-column at mobile.
- **Timeline, per-trainee progress, drill times** are `overflow-auto` horizontal-scroll tables with inline inputs at `text-[11px]` — unusable on phone.
- Timeline uses HTML5 drag-and-drop (`draggable`, `onDragStart`, `onDrop`) which does not fire on touch devices.
- Rating buttons (EE/ME/AD/NI) are inline in the progress table, too small for reliable tapping.

---

## 3. Design decisions (locked)

| Decision | Choice |
|---|---|
| Scope | Full form, all users — one shared form, fully responsive |
| Layout strategy | Cards for timeline + drill times; compact list + detail modal for per-trainee progress |
| Timeline reordering | Arrow buttons (↑/↓) on all screen sizes; HTML5 drag removed entirely |
| Draft persistence | `localStorage`, debounced 500ms, keyed by `(classId, reportId\|'new')` |
| Offline support | Out of scope; localStorage draft covers the realistic failure cases |
| iOS zoom-on-focus | `text-base md:text-xs` on all inputs (≥16px on mobile) |
| Component refactor | Section components split out; state ownership stays in orchestrator |

---

## 4. Component structure

**New files:**

```
web/src/components/sections/
  HeaderFieldsSection.tsx
  TrainersSection.tsx
  HoursTotalsSection.tsx
  TimelineSection.tsx
  TraineeProgressSection.tsx
  DrillTimesSection.tsx
  CoordinatorNotesSection.tsx
web/src/components/TraineeProgressDetailModal.tsx
web/src/hooks/useReportDraft.ts
```

**Modified files:**

```
web/src/components/ReportEditForm.tsx   (orchestrator only — state, save, section glue)
```

**Unchanged:** all call sites (`ClassReportsSection`, `TrainerReportsSection`, `ReportPreviewModal`, PDF logic).

---

## 5. State ownership & data flow

All state stays in `ReportEditForm`. Each section receives typed props + an `onChange` callback. No context or new state manager.

```
ReportEditForm (owns all state)
  ├── HeaderFieldsSection({ reportDate, reportGame, reportGroup, … onChange })
  ├── TrainersSection({ trainers, selectedIds, onChange })
  ├── HoursTotalsSection({ reportDate, hours, overrides, onChange })
  ├── TimelineSection({ items, onChange })
  ├── TraineeProgressSection({ rows, enrollments, onChange })
  ├── DrillTimesSection({ rows, drills, onChange })
  └── CoordinatorNotesSection({ notes, canEdit, onChange })
```

`TraineeProgressDetailModal` receives a single row + its enrollment + callbacks; edits call `onChange(updatedRow)` immediately in orchestrator state (no separate modal-local state).

---

## 6. Mobile layouts

### 6.1 Header, trainers, hours totals, coordinator notes

Polish only — no structural change:
- Inputs: `text-base md:text-xs py-3 md:py-1.5` (prevents iOS zoom; larger touch target).
- Already single-column at mobile widths.

### 6.2 Timeline section

**Desktop (`md:block`):** existing table, no changes except drag handle removed.

**Mobile (`md:hidden`):** one card per timeline row.

```
┌─────────────────────────────────────┐
│  09:00 – 10:30              ↑  ↓  ✕ │
│  Activity: ___________________       │
│  Homework / handouts: _________      │
│  Category: ___________________       │
└─────────────────────────────────────┘
```

- `↑` / `↓` arrow buttons replace drag handle on all screen sizes (drag removed entirely).
- First row: `↑` disabled. Last row: `↓` disabled.
- `aria-label="Move up"` / `aria-label="Move down"` on arrow buttons.
- `+ Add time block` button: full-width on mobile.

### 6.3 Per-trainee progress section

**Desktop:** existing table, unchanged layout.

**Mobile — compact list (one row per trainee):**

```
┌─────────────────────────────────────┐
│  Sarah Chen      GK: ME  Dex: AD    │  ← tap to open detail modal
│  ✓ Attended  ✓ Coming back          │
└─────────────────────────────────────┘
```

Shows: name, GK/Dex/HoM rating abbreviations (or "—" if unset), attendance + coming-back icons. Entire row is tappable (large touch target).

**`TraineeProgressDetailModal` — full-screen overlay:**

```
┌─────────────────────────────────────┐
│  ← Sarah Chen                   ✕  │  header: name + close
│                                     │
│  Progress notes                     │
│  ┌─────────────────────────────┐    │
│  │                             │    │  full-width textarea
│  └─────────────────────────────┘    │
│                                     │
│  GK rating    [EE] [ME] [AD] [NI]  │  chips min 44px tall
│  Dex rating   [EE] [ME] [AD] [NI]  │
│  HoM rating   [EE] [ME] [AD] [NI]  │
│                                     │
│  [✓] Attended     [✓] Coming back  │
│  [  ] Late        [  ] HW done     │
│                                     │
│  ← Prev trainee       Next trainee →│
└─────────────────────────────────────┘
```

- Full-screen fixed overlay (`fixed inset-0 z-50`), white/dark-mode background matching app theme.
- Focus trapped; `Escape` closes; backdrop click closes; `<body>` gets `overflow-hidden` while open.
- Prev/Next buttons step through `progressRows` in order; no close-and-reopen required.
- Edits are immediately reflected in orchestrator state via `onChange(updatedRow)`.
- Only shown on mobile (`md:hidden` wrapper; detail modal never rendered on desktop).

### 6.4 Drill times section

**Desktop:** existing table, unchanged.

**Mobile — one card per drill:**

```
┌─────────────────────────────────────┐
│  Cut & Shuffle                       │  drill name (read-only header)
│  Time (sec): [        ]             │
│  Score:      [        ]             │
└─────────────────────────────────────┘
```

- `inputmode="decimal"` on time and score fields → numeric keyboard on mobile.
- Drill name rendered as text, not an input.

---

## 7. Draft persistence (`useReportDraft`)

**Signature:**

```ts
function useReportDraft(
  key: string,               // `report-draft-${classId}-${reportId ?? 'new'}`
  state: ReportDraftState,   // serializable subset of all form fields
  initialized: boolean,      // true after form's init useEffect ran
): {
  hasDraft: boolean
  discardDraft: () => void
}
```

**`ReportDraftState`** — plain serializable object containing all form fields *except* computed values (hours totals are always recomputed from the `hours` prop).

**Write path:** `useEffect` on `state`, debounced 500ms. Skips writes until `initialized = true` (prevents blank pre-init snapshot overwriting a real draft).

**Read path:** hook checks `localStorage` on mount. If key exists and JSON parses to a valid shape, sets `hasDraft = true`. Orchestrator passes draft values as init overrides instead of the server `report` prop.

**Clear path:** `discardDraft()` removes the key from `localStorage`. Called by the "Discard" button and automatically after a successful `onSave`.

**Error handling:** `localStorage` writes wrapped in `try/catch`; `QuotaExceededError` is caught and logged to console, not surfaced to the user. On restore, JSON parse failure or shape mismatch silently discards the draft (prevents stale data from a previous deploy breaking the form). A valid shape requires at minimum: `timelineItems`, `progressRows`, and `drillTimeRows` are arrays, and `reportDate` is a non-empty string — anything failing these checks is discarded.

**Draft banner** (rendered by `ReportEditForm` when `hasDraft` is true on mount):

```
┌────────────────────────────────────────────────────────┐
│  Unsaved draft restored from your last session  [Discard] │
└────────────────────────────────────────────────────────┘
```

`role="status"` so screen readers announce it on mount. Disappears after discard or on save.

---

## 8. Accessibility

| Rule | Implementation |
|---|---|
| Tap targets ≥ 44×44px | `min-h-[44px] min-w-[44px]` on rating chips, arrow buttons, modal prev/next, toggles |
| No iOS zoom-on-focus | `text-base md:text-xs` on all `<input>` and `<textarea>` |
| Modal focus trap | `tabIndex` managed; focus moves to modal header on open; returns to triggering row on close |
| Modal close | `Escape` key, × button, backdrop click |
| Body scroll lock | `overflow-hidden` on `<body>` while modal open |
| Arrow buttons | `aria-label="Move up"` / `aria-label="Move down"`, `disabled` prop on boundary rows |
| Draft banner | `role="status"` |

---

## 9. Testing (manual QA)

No test runner in this codebase. Verification via `tsc --noEmit` + manual QA on DevTools mobile emulator (iPhone 12 / 390px) and a real iOS device if available.

**Checklist:**

- [ ] Header inputs render single-column; no zoom on tap (iOS Safari)
- [ ] Timeline: cards on mobile, table on desktop; arrow buttons reorder correctly; no drag handle anywhere
- [ ] Add a timeline row on mobile → card appears; remove → gone; up/down at boundaries disabled
- [ ] Per-trainee progress: compact list on mobile; tap row → modal opens full-screen
- [ ] Modal: edit progress notes → compact list reflects immediately; change ratings, toggle flags
- [ ] Prev/Next in modal steps through all trainees; first trainee Prev disabled; last trainee Next disabled
- [ ] Drill times: cards on mobile; time/score use numeric keyboard
- [ ] Draft: partially fill form, hard-reload → banner appears, fields restored
- [ ] Draft: click Discard → form resets to server state; no draft on next reload
- [ ] Draft: fill form, save → reload → no draft banner
- [ ] Desktop: all existing behaviour unchanged (tables, no drag handle — intentional)
- [ ] `cd web && npx tsc --noEmit` passes
- [ ] Dark mode: all mobile cards and modal themed correctly

---

## 10. Rollout

Pure frontend change — no migration, no server changes, no API changes.

1. Deploy to staging.
2. Have at least one trainer test the progress-entry flow on their actual phone before merging.
3. Deploy to production.

Draft localStorage keys are namespaced by `(classId, reportId)` — existing production sessions won't surface stale drafts.

---

## 11. Open items for future work

- `StudentReportInput` mobile improvements (separate form, deliberately out of scope here).
- If `ReportEditForm` grows further, consider React Context for the section props to avoid prop-drilling across many fields.
- If drag-and-drop reordering is missed on desktop, `@dnd-kit/core` is the recommended replacement (touch-capable, accessible).
