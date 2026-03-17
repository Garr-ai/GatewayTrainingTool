# Classes page — feature list

Overview of planned features for the **Classes** section of the Gateway Training Tool webapp (coordinator-focused, with trainer visibility where noted).

---

## Overview & layout

- **Classes list (main view)**  
  - Table or card list of all classes, scoped by province (BC / AB / ON) and optionally by property.  
  - Columns/cards: class name, property, game type, assigned trainer, start/end dates, student count, status (e.g. upcoming, in progress, completed).  
  - Sort by date, name, or status; filter by property, trainer, game type, status.

- **Empty state**  
  - When there are no classes (or no matches): clear message and a primary “Create class” call-to-action.

- **Search**  
  - Search by class name, trainer name, or property so coordinators can find a class quickly.

---

## Class creation

- **“Add class” / “Create class” button**  
  - Prominent in the Classes page header or toolbar (in addition to coordinator dashboard).  
  - Opens a class-creation flow (modal or dedicated page).

- **Create-class form**  
  - **Required:** class name, property/location, game type, assigned trainer, start date, end date (or single date for one-off sessions).  
  - **Optional:** description, capacity, default time slots.  
  - Validation (e.g. end ≥ start, trainer exists, property in selected province).  
  - Submit creates the class and optionally redirects to the new class detail or back to the list with success feedback.

- **Post-creation**  
  - New class appears in the list and is available for scheduling and enrollment (when those features exist).

---

## Class detail & actions

- **Open a class**  
  - Clicking a row/card goes to a **class detail** view (or slide-out panel) for that class.

- **Class detail page/panel**  
  - Shows: name, property, game type, trainer, dates, status.  
  - Maybe generate an invite link for the class?
  - Sections (or placeholders) for:  
    - **Schedule** — time slots; add/edit/remove.  
    - **Students** — enrolled list; add/remove (when enrollment exists).  
    - **Attendance** — per session (when attendance feature exists).  
    - **Drills / scores** — link or summary to drill and test data (when implemented).  
    - **Daily reports** — link or list of uploads (when implemented).
    - Payroll hours - Calculate # of training hours for the day, total training hours to date, 
    - Ability to upload homework/assignments


- **Student Profiles**
  - Ability to upload payroll information, hours completed, games completed, etc.
  - Ability to track scores
  - 

- **Edit class**  
  - Coordinators can change name, property, game type, trainer, dates (and later schedule) from the detail view or list (e.g. “Edit” button).

- **Cancel or archive class**  
  - Option to cancel an upcoming class or mark it completed/archived so it no longer appears in “active” lists but remains in history/reports.

---

## Scheduling (classes page scope)

- **View schedule**  
  - From class detail, show time slots (e.g. days and times) for the class.

- **Add / edit time slots**  
  - Coordinators (and possibly assigned trainers) can add or edit slots; students see published schedule when that view exists.

---

## Permissions & scope

- **Coordinators**  
  - Full access: create, edit, cancel/archive, assign trainer, manage schedule and (when built) enrollment.

- **Trainers**  
  - View classes they’re assigned to; limited or no edit (e.g. view-only on class metadata, ability to log attendance/drills from their own view).

- **Province / property**  
  - List and filters respect user’s province and, if applicable, property so only relevant classes are shown.

---

## Future enhancements (for roadmap)

- **Bulk actions** — e.g. cancel multiple classes, export class list.  
- **Templates** — create a new class from a template (reuse property, game type, default schedule).  
- **Copy class** — duplicate an existing class (same trainer, property, game type; new dates).  
- **Calendar view** — classes on a calendar in addition to list view.  
- **Notifications** — reminders for class start, missing daily report, or incomplete attendance (can live in a shared “Notifications” area later).

---

## Out of scope for “Classes page” (handled elsewhere)

- Drill logging and drill timer — trainer/student flows.  
- Daily report upload — class-level or trainer flow.  
- User/role management — Settings or User Management.  
- Competency sign-offs, graduation checklist — student/trainer detail or separate sections.

---

*This list can be updated as the Classes page is implemented and new requirements appear.*
