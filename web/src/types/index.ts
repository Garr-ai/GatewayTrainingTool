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

export interface ClassEnrollment {
  id: string
  class_id: string
  student_name: string
  student_email: string
  status: EnrollmentStatus
  group_label: string | null
  created_at: string
}

export const PROVINCES: { value: Province; label: string }[] = [
  { value: 'BC', label: 'British Columbia' },
  { value: 'AB', label: 'Alberta' },
  { value: 'ON', label: 'Ontario' },
]
