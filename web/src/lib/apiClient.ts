import { supabase } from './supabase'
import type {
  Class,
  ClassDrill,
  ClassTrainer,
  ClassEnrollment,
  ClassScheduleSlot,
  ClassDailyReport,
  ClassDailyReportTimelineItem,
  ClassDailyReportTraineeProgress,
  ClassLoggedHours,
  Profile,
  DrillType,
  TrainerRole,
  EnrollmentStatus,
  LoggedHoursPersonType,
  Province,
  DailyRating,
} from '../types'

// In production (same Vercel project) this is empty → relative URLs /api/...
// In local dev set VITE_API_URL=http://localhost:3001 in web/.env
const API_BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? ''

async function authHeaders(): Promise<HeadersInit> {
  const {
    data: { session },
  } = await supabase.auth.getSession()
  if (!session?.access_token) throw new Error('Not authenticated')
  return { Authorization: `Bearer ${session.access_token}` }
}

async function req<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = await authHeaders()
  const res = await fetch(`${API_BASE}/api${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...headers,
      ...(init.headers ?? {}),
    },
  })
  if (res.status === 204) return undefined as T
  const body = await res.json()
  if (!res.ok) throw new Error((body as { error?: string }).error ?? `Request failed: ${res.status}`)
  return body as T
}

// ─── Nested report types ────────────────────────────────────────────────────

export interface ReportWithNested extends ClassDailyReport {
  trainer_ids: string[]
  timeline: ClassDailyReportTimelineItem[]
  progress: ClassDailyReportTraineeProgress[]
}

interface TimelineItemInput {
  start_time: string | null
  end_time: string | null
  activity: string | null
  homework_handouts_tests: string | null
  category: string | null
}

interface ProgressRowInput {
  enrollment_id: string
  progress_text: string | null
  gk_rating: DailyRating | null
  dex_rating: DailyRating | null
  hom_rating: DailyRating | null
  coming_back_next_day: boolean | null
}

interface ReportBody {
  report_date: string
  group_label?: string | null
  game?: string | null
  session_label?: string | null
  class_start_time?: string | null
  class_end_time?: string | null
  mg_confirmed?: number | null
  mg_attended?: number | null
  current_trainees?: number | null
  licenses_received?: number | null
  override_hours_to_date?: number | null
  override_paid_hours_total?: number | null
  override_live_hours_total?: number | null
  trainer_ids: string[]
  timeline: TimelineItemInput[]
  progress: ProgressRowInput[]
}

// ─── API client ─────────────────────────────────────────────────────────────

export const api = {
  classes: {
    list: (params?: { archived?: boolean }) => {
      const qs = params?.archived !== undefined ? `?archived=${params.archived}` : ''
      return req<Class[]>(`/classes${qs}`)
    },
    getByName: (name: string) =>
      req<Class>(`/classes/by-name/${encodeURIComponent(name)}`),
    get: (id: string) => req<Class>(`/classes/${id}`),
    create: (body: {
      name: string
      site: string
      province: Province
      game_type?: string | null
      start_date: string
      end_date: string
      description?: string | null
    }) => req<Class>('/classes', { method: 'POST', body: JSON.stringify(body) }),
    update: (id: string, body: Partial<Class>) =>
      req<Class>(`/classes/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
    archive: (id: string) =>
      req<Class>(`/classes/${id}`, { method: 'PUT', body: JSON.stringify({ archived: true }) }),
    unarchive: (id: string) =>
      req<Class>(`/classes/${id}`, { method: 'PUT', body: JSON.stringify({ archived: false }) }),
    delete: (id: string) => req<void>(`/classes/${id}`, { method: 'DELETE' }),
  },

  drills: {
    list: (classId: string) => req<ClassDrill[]>(`/classes/${classId}/drills`),
    create: (
      classId: string,
      body: {
        name: string
        type: DrillType
        par_time_seconds?: number | null
        target_score?: number | null
      },
    ) =>
      req<ClassDrill>(`/classes/${classId}/drills`, {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    update: (id: string, body: Partial<ClassDrill>) =>
      req<ClassDrill>(`/drills/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
    delete: (id: string) => req<void>(`/drills/${id}`, { method: 'DELETE' }),
  },

  trainers: {
    list: (classId: string) => req<ClassTrainer[]>(`/classes/${classId}/trainers`),
    create: (
      classId: string,
      body: { trainer_name: string; trainer_email: string; role: TrainerRole },
    ) =>
      req<ClassTrainer>(`/classes/${classId}/trainers`, {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    update: (id: string, body: Partial<ClassTrainer>) =>
      req<ClassTrainer>(`/trainers/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
    delete: (id: string) => req<void>(`/trainers/${id}`, { method: 'DELETE' }),
  },

  enrollments: {
    list: (classId: string, status?: EnrollmentStatus) =>
      req<ClassEnrollment[]>(
        `/classes/${classId}/enrollments${status ? `?status=${status}` : ''}`,
      ),
    create: (
      classId: string,
      body: {
        student_name: string
        student_email: string
        status: EnrollmentStatus
        group_label?: string | null
      },
    ) =>
      req<ClassEnrollment>(`/classes/${classId}/enrollments`, {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    update: (id: string, body: { status: EnrollmentStatus; group_label?: string | null }) =>
      req<ClassEnrollment>(`/enrollments/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
    delete: (id: string) => req<void>(`/enrollments/${id}`, { method: 'DELETE' }),
  },

  schedule: {
    list: (classId: string) => req<ClassScheduleSlot[]>(`/classes/${classId}/schedule`),
    create: (
      classId: string,
      body: {
        slot_date: string
        start_time: string
        end_time: string
        notes?: string | null
        trainer_id?: string | null
        group_label?: string | null
      },
    ) =>
      req<ClassScheduleSlot>(`/classes/${classId}/schedule`, {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    update: (id: string, body: Partial<ClassScheduleSlot>) =>
      req<ClassScheduleSlot>(`/schedule/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
    delete: (id: string) => req<void>(`/schedule/${id}`, { method: 'DELETE' }),
  },

  reports: {
    list: (classId: string) => req<ClassDailyReport[]>(`/classes/${classId}/reports`),
    get: (id: string) => req<ReportWithNested>(`/reports/${id}`),
    create: (classId: string, body: ReportBody) =>
      req<ClassDailyReport>(`/classes/${classId}/reports`, {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    update: (id: string, body: ReportBody) =>
      req<ClassDailyReport>(`/reports/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
    delete: (id: string) => req<void>(`/reports/${id}`, { method: 'DELETE' }),
  },

  hours: {
    list: (classId: string) => req<ClassLoggedHours[]>(`/classes/${classId}/hours`),
    create: (
      classId: string,
      body: {
        log_date: string
        person_type: LoggedHoursPersonType
        trainer_id?: string | null
        enrollment_id?: string | null
        hours: number
        paid?: boolean
        live_training?: boolean
        notes?: string | null
      },
    ) =>
      req<ClassLoggedHours>(`/classes/${classId}/hours`, {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    update: (id: string, body: Partial<ClassLoggedHours>) =>
      req<ClassLoggedHours>(`/hours/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
    delete: (id: string) => req<void>(`/hours/${id}`, { method: 'DELETE' }),
  },

  profiles: {
    search: (params: { role?: string; search?: string }) => {
      const qs = new URLSearchParams(
        Object.fromEntries(
          Object.entries(params).filter(([, v]) => v !== undefined && v !== ''),
        ) as Record<string, string>,
      ).toString()
      return req<Pick<Profile, 'id' | 'full_name' | 'email'>[]>(`/profiles${qs ? `?${qs}` : ''}`)
    },
    me: () => req<Profile>('/profiles/me'),
  },
}
