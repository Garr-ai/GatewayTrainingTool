export type UserRole = 'trainee' | 'trainer' | 'coordinator'
export type Province = 'BC' | 'AB' | 'ON'

export interface Profile {
  id: string
  email: string
  full_name: string | null
  role: UserRole
  province: Province | null
  created_at: string
  updated_at: string
}

export interface Class {
  id: string
  name: string
  site: string
  province: Province
  game_type: string | null
  start_date: string
  end_date: string
  description: string | null
  archived: boolean
  created_at: string
  updated_at: string
}

export type DrillType = 'drill' | 'test'

export interface ClassDrill {
  id: string
  class_id: string
  name: string
  type: DrillType
  par_time_seconds: number | null
  target_score: number | null
  active: boolean
  created_at: string
}

export type TrainerRole = 'primary' | 'assistant'

export interface ClassTrainer {
  id: string
  class_id: string
  trainer_name: string
  trainer_email: string
  role: TrainerRole
  created_at: string
}

export type EnrollmentStatus = 'enrolled' | 'waitlist' | 'dropped'

export interface ClassScheduleSlot {
  id: string
  class_id: string
  slot_date: string
  start_time: string
  end_time: string
  notes: string | null
  trainer_id: string | null
  group_label: string | null
  created_at: string
}

export interface ClassEnrollment {
  id: string
  class_id: string
  student_name: string
  student_email: string
  status: EnrollmentStatus
  group_label: string | null
  created_at: string
}

export type DailyRating = 'EE' | 'ME' | 'AD' | 'NI'

export interface ClassDailyReport {
  id: string
  class_id: string
  report_date: string
  group_label: string | null
  game: string | null
  session_label: string | null
  class_start_time: string | null
  class_end_time: string | null
  mg_confirmed: number | null
  mg_attended: number | null
  current_trainees: number | null
  licenses_received: number | null
  override_hours_to_date: number | null
  override_paid_hours_total: number | null
  override_live_hours_total: number | null
  created_at: string
}

export interface ClassDailyReportTrainer {
  report_id: string
  trainer_id: string
}

export interface ClassDailyReportTimelineItem {
  id: string
  report_id: string
  start_time: string | null
  end_time: string | null
  activity: string | null
  homework_handouts_tests: string | null
  category: string | null
  position: number | null
  created_at: string
}

export interface ClassDailyReportTraineeProgress {
  id: string
  report_id: string
  enrollment_id: string
  progress_text: string | null
  gk_rating: DailyRating | null
  dex_rating: DailyRating | null
  hom_rating: DailyRating | null
  coming_back_next_day: boolean | null
  created_at: string
}

export type LoggedHoursPersonType = 'trainer' | 'student'

export interface ClassLoggedHours {
  id: string
  class_id: string
  log_date: string
  person_type: LoggedHoursPersonType
  trainer_id: string | null
  enrollment_id: string | null
  hours: number
  paid: boolean
  live_training: boolean
  notes: string | null
  created_at: string
}

export const PROVINCES: { value: Province; label: string }[] = [
  { value: 'BC', label: 'British Columbia' },
  { value: 'AB', label: 'Alberta' },
  { value: 'ON', label: 'Ontario' },
]
