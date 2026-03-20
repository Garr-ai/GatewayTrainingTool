/**
 * types/index.ts — Shared TypeScript types for the frontend
 *
 * This file is the single source of truth for all data shapes used
 * across the frontend. Every type here mirrors a Supabase database table or
 * a domain concept used in the UI.
 *
 * Types are exported and consumed by:
 *   - apiClient.ts  — for request/response typing
 *   - React components — for prop and state typing
 *   - reportPdf.ts  — for report generation
 *
 * Keep this file in sync with the backend database schema. When a new
 * column is added to Supabase, add it here first so TypeScript surfaces
 * any stale references across the codebase.
 */

/** The three roles a user can hold. Enforced by both the API and the UI. */
export type UserRole = 'trainee' | 'trainer' | 'coordinator'

/** Provinces where Gateway Casinos operates training programs. */
export type Province = 'BC' | 'AB' | 'ON'

/** A user account in the system, stored in the `profiles` table. */
export interface Profile {
  id: string           // UUID matching auth.users.id in Supabase
  email: string
  full_name: string | null
  role: UserRole
  province: Province | null  // Home province, used for multi-site filtering
  created_at: string
  updated_at: string
}

/** A training class — the central entity that groups trainers, students, schedule, and reports. */
export interface Class {
  id: string
  name: string          // Short identifier (e.g. "BJ-APR-01"), used as URL slug
  site: string          // Casino site code (e.g. "GVE", "SLE")
  province: Province
  game_type: string | null  // The casino game being trained (e.g. "Blackjack")
  start_date: string    // ISO date string (YYYY-MM-DD)
  end_date: string
  description: string | null
  archived: boolean     // Archived classes are hidden from the active list but not deleted
  created_at: string
  updated_at: string
}

/** Whether a class activity is a timed drill or a scored test. */
export type DrillType = 'drill' | 'test'

/**
 * A drill or test associated with a class.
 * `par_time_seconds` is the target completion time for drills.
 * `target_score` is the passing score for tests.
 */
export interface ClassDrill {
  id: string
  class_id: string
  name: string
  type: DrillType
  par_time_seconds: number | null
  target_score: number | null
  active: boolean       // Inactive drills are hidden from assessment forms
  created_at: string
}

/** Whether a trainer is the lead or a support trainer for a class. */
export type TrainerRole = 'primary' | 'assistant'

/**
 * A trainer assigned to a specific class.
 * Note: this is a denormalized snapshot of the trainer's name/email at the
 * time of assignment; it does not update if the profile changes.
 */
export interface ClassTrainer {
  id: string
  class_id: string
  trainer_name: string
  trainer_email: string
  role: TrainerRole
  created_at: string
}

/** Whether a student is actively in the class, on the waitlist, or has dropped. */
export type EnrollmentStatus = 'enrolled' | 'waitlist' | 'dropped'

/**
 * A single time block in a class's schedule.
 * `trainer_id` references `class_trainers.id` (not a user profile).
 * `group_label` (e.g. "A", "B") divides students into concurrent training groups.
 */
export interface ClassScheduleSlot {
  id: string
  class_id: string
  slot_date: string     // ISO date string
  start_time: string    // 24-hour time string (HH:MM)
  end_time: string
  notes: string | null
  trainer_id: string | null
  group_label: string | null
  created_at: string
}

/**
 * A student's enrollment in a class.
 * `group_label` assigns the student to a competency sub-group (e.g. "A", "B").
 */
export interface ClassEnrollment {
  id: string
  class_id: string
  student_name: string
  student_email: string
  status: EnrollmentStatus
  group_label: string | null
  created_at: string
}

/**
 * Daily performance rating scale used for trainee assessments.
 *   EE = Exceeds Expectations
 *   ME = Meets Expectations
 *   AD = Approaching Development
 *   NI = Needs Improvement
 */
export type DailyRating = 'EE' | 'ME' | 'AD' | 'NI'

/**
 * A daily report summarising one training session for a class group.
 * Nested data (timeline items and trainee progress rows) are stored in
 * separate tables and fetched separately via the `ReportWithNested` type in apiClient.ts.
 * The `override_*` fields allow coordinators to manually correct computed hour totals.
 */
export interface ClassDailyReport {
  id: string
  class_id: string
  report_date: string        // ISO date string
  group_label: string | null // Which student group this report covers
  game: string | null        // Game type trained that day
  session_label: string | null // Human-readable label (e.g. "Day 4 PM")
  class_start_time: string | null
  class_end_time: string | null
  mg_confirmed: number | null  // Meet-and-greet headcount confirmed
  mg_attended: number | null   // Meet-and-greet headcount actually present
  current_trainees: number | null
  licenses_received: number | null
  override_hours_to_date: number | null     // Manual override for cumulative training hours
  override_paid_hours_total: number | null  // Manual override for paid hours total
  override_live_hours_total: number | null  // Manual override for live floor hours total
  created_at: string
}

/** Junction record linking a trainer to a daily report (many-to-many). */
export interface ClassDailyReportTrainer {
  report_id: string
  trainer_id: string  // References class_trainers.id
}

/**
 * A single row in the daily training timeline table.
 * `position` is used to preserve the drag-and-drop ordering set by the coordinator.
 */
export interface ClassDailyReportTimelineItem {
  id: string
  report_id: string
  start_time: string | null
  end_time: string | null
  activity: string | null
  homework_handouts_tests: string | null  // Any homework, handouts, or tests in this block
  category: string | null  // E.g. "Lecture", "Dexterity", "Game simulation"
  position: number | null  // Display order (0-based)
  created_at: string
}

/**
 * A trainer's assessment of one student for a given daily report.
 * `gk_rating` = Game Knowledge, `dex_rating` = Dexterity, `hom_rating` = Hands on Mechanics.
 */
export interface ClassDailyReportTraineeProgress {
  id: string
  report_id: string
  enrollment_id: string     // References class_enrollments.id
  progress_text: string | null
  gk_rating: DailyRating | null
  dex_rating: DailyRating | null
  hom_rating: DailyRating | null
  coming_back_next_day: boolean | null
  homework_completed: boolean
  created_at: string
}

/** Whether the hours entry is for a trainer or a student (trainee). */
export type LoggedHoursPersonType = 'trainer' | 'student'

/**
 * A single hours-logged record for payroll tracking.
 * Either `trainer_id` or `enrollment_id` is set depending on `person_type`,
 * but never both.
 * `paid` distinguishes paid time from unpaid/volunteer hours.
 * `live_training` flags hours spent on the live casino floor (vs. classroom).
 */
export interface ClassLoggedHours {
  id: string
  class_id: string
  log_date: string       // ISO date string
  person_type: LoggedHoursPersonType
  trainer_id: string | null     // Set when person_type === 'trainer'
  enrollment_id: string | null  // Set when person_type === 'student'
  hours: number
  paid: boolean
  live_training: boolean
  notes: string | null
  created_at: string
}

/** Static list of supported provinces used for dropdowns and display labels. */
export const PROVINCES: { value: Province; label: string }[] = [
  { value: 'BC', label: 'British Columbia' },
  { value: 'AB', label: 'Alberta' },
  { value: 'ON', label: 'Ontario' },
]
