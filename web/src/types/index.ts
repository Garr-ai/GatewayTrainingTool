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

export const PROVINCES: { value: Province; label: string }[] = [
  { value: 'BC', label: 'British Columbia' },
  { value: 'AB', label: 'Alberta' },
  { value: 'ON', label: 'Ontario' },
]
