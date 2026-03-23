/**
 * lib/apiClient.ts — Typed HTTP client for the Express backend API
 *
 * All data fetching (except auth) goes through this file. It provides a
 * structured `api` object whose methods correspond to backend REST endpoints.
 *
 * How it works:
 *   1. `authHeaders()` retrieves the current Supabase session JWT and formats
 *      it as a Bearer token for the Authorization header.
 *   2. `req<T>()` is a thin generic wrapper around `fetch` that automatically
 *      attaches auth headers, sets the base URL, and converts errors to
 *      thrown Error objects that callers can catch.
 *   3. The exported `api` object groups methods by resource (classes, drills,
 *      trainers, enrollments, schedule, reports, hours, profiles).
 *
 * Environment variable:
 *   VITE_API_URL — Set to http://localhost:3001 for local dev. Leave empty
 *                  for production (same-origin relative URLs are used).
 *
 * Example usage:
 *   const classes = await api.classes.list({ archived: false })
 *   const report  = await api.reports.get(reportId)
 */

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

/**
 * Retrieves the current user's JWT from Supabase and formats it as a
 * Bearer token Authorization header. Throws if the user is not signed in,
 * which will propagate as an error in any `req()` call.
 */
async function authHeaders(): Promise<HeadersInit> {
  const {
    data: { session },
  } = await supabase.auth.getSession()
  if (!session?.access_token) throw new Error('Not authenticated')
  return { Authorization: `Bearer ${session.access_token}` }
}

/**
 * Generic fetch wrapper used by all API methods.
 * - Prepends API_BASE + "/api" to the path.
 * - Attaches Content-Type and Authorization headers automatically.
 * - Returns `undefined` (typed as T) for 204 No Content responses (e.g. DELETE).
 * - Throws an Error with the server's `error` field message if the response is not ok.
 */
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
  // 204 has no body; return undefined so callers can type the result as void
  if (res.status === 204) return undefined as T
  const body = await res.json()
  if (!res.ok) throw new Error((body as { error?: string }).error ?? `Request failed: ${res.status}`)
  return body as T
}

// ─── Nested report types ────────────────────────────────────────────────────

/**
 * The full report shape returned by GET /reports/:id.
 * Extends the base ClassDailyReport with the three nested arrays that are
 * stored in separate DB tables and fetched together by the backend.
 */
export interface ReportWithNested extends ClassDailyReport {
  trainer_ids: string[]                          // IDs of trainers present that day
  timeline: ClassDailyReportTimelineItem[]       // Ordered list of training blocks
  progress: ClassDailyReportTraineeProgress[]    // Per-student assessment rows
}

/** Input shape for a single timeline row when creating or updating a report. */
interface TimelineItemInput {
  start_time: string | null
  end_time: string | null
  activity: string | null
  homework_handouts_tests: string | null
  category: string | null
}

/** Input shape for a single trainee progress row when creating or updating a report. */
interface ProgressRowInput {
  enrollment_id: string
  progress_text: string | null
  gk_rating: DailyRating | null
  dex_rating: DailyRating | null
  hom_rating: DailyRating | null
  coming_back_next_day: boolean | null
  homework_completed: boolean
}

/** The full request body sent to POST /classes/:id/reports and PUT /classes/:id/reports/:id. */
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

// ─── Report list (paginated) types ──────────────────────────────────────────

/** The expanded class fields returned by the paginated GET /reports endpoint. */
export type ReportRowClass = {
  id: string
  name: string
  site: string
  province: Province
  game_type: string | null
  archived: boolean
}

/** A single row from the paginated reports list. */
export type ReportRow = ClassDailyReport & { classes: ReportRowClass }

/** Query params accepted by api.reports.listAll(). */
export interface ReportListParams {
  province?: Province | ''
  site?: string
  class_id?: string
  archived?: boolean
  game_type?: string
  date_from?: string
  date_to?: string
  search?: string
  sort_by?: string
  sort_dir?: 'asc' | 'desc'
  page?: number
  limit?: number
}

/** Paginated response envelope from GET /reports. */
export interface PaginatedReports {
  data: ReportRow[]
  total: number
  page: number
  limit: number
}

// ─── Schedule list (paginated) types ────────────────────────────────────────

/** The expanded class fields returned by the paginated GET /schedule endpoint. */
export type ScheduleRowClass = {
  id: string
  name: string
  site: string
  province: Province
  game_type: string | null
  archived: boolean
}

/** Trainer info joined on a schedule slot's trainer_id FK. */
export type ScheduleRowTrainer = {
  id: string
  trainer_name: string
  role: string
} | null

/** A single row from the paginated schedule list. */
export type ScheduleRow = ClassScheduleSlot & { classes: ScheduleRowClass; class_trainers: ScheduleRowTrainer }

/** Query params accepted by api.schedule.listAll(). */
export interface ScheduleListParams {
  province?: Province | ''
  site?: string
  class_id?: string
  archived?: boolean
  game_type?: string
  date_from?: string
  date_to?: string
  group_label?: string
  search?: string
  sort_by?: string
  sort_dir?: 'asc' | 'desc'
  page?: number
  limit?: number
}

/** Paginated response envelope from GET /schedule. */
export interface PaginatedSchedule {
  data: ScheduleRow[]
  total: number
  page: number
  limit: number
}

// ─── API client ─────────────────────────────────────────────────────────────

/**
 * The `api` object is the public interface for all backend communication.
 * Each top-level key groups CRUD methods for one resource type.
 *
 * All methods return Promises and throw on HTTP errors so callers can use
 * try/catch or .catch() for error handling.
 */
export const api = {
  classes: {
    /** Fetch all classes. Pass `{ archived: false }` (default) or `{ archived: true }`. */
    list: (params?: { archived?: boolean }) => {
      const qs = params?.archived !== undefined ? `?archived=${params.archived}` : ''
      return req<Class[]>(`/classes${qs}`)
    },
    /** Look up a class by its display name (used for URL-slug-based navigation). */
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
    update: (classId: string, id: string, body: Partial<ClassDrill>) =>
      req<ClassDrill>(`/classes/${classId}/drills/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
    delete: (classId: string, id: string) => req<void>(`/classes/${classId}/drills/${id}`, { method: 'DELETE' }),
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
    update: (classId: string, id: string, body: Partial<ClassTrainer>) =>
      req<ClassTrainer>(`/classes/${classId}/trainers/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
    delete: (classId: string, id: string) => req<void>(`/classes/${classId}/trainers/${id}`, { method: 'DELETE' }),
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
    update: (classId: string, id: string, body: { status: EnrollmentStatus; group_label?: string | null }) =>
      req<ClassEnrollment>(`/classes/${classId}/enrollments/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
    delete: (classId: string, id: string) => req<void>(`/classes/${classId}/enrollments/${id}`, { method: 'DELETE' }),
  },

  schedule: {
    listAll: (params?: ScheduleListParams) => {
      const entries: Record<string, string> = {}
      if (params) {
        for (const [k, v] of Object.entries(params)) {
          if (v !== undefined && v !== '') entries[k] = String(v)
        }
      }
      const qs = new URLSearchParams(entries).toString()
      return req<PaginatedSchedule>(`/schedule${qs ? `?${qs}` : ''}`)
    },
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
    update: (classId: string, id: string, body: Partial<ClassScheduleSlot>) =>
      req<ClassScheduleSlot>(`/classes/${classId}/schedule/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
    delete: (classId: string, id: string) => req<void>(`/classes/${classId}/schedule/${id}`, { method: 'DELETE' }),
  },

  reports: {
    listAll: (params?: ReportListParams) => {
      const entries: Record<string, string> = {}
      if (params) {
        for (const [k, v] of Object.entries(params)) {
          if (v !== undefined && v !== '') entries[k] = String(v)
        }
      }
      const qs = new URLSearchParams(entries).toString()
      return req<PaginatedReports>(`/reports${qs ? `?${qs}` : ''}`)
    },
    list: (classId: string) => req<ClassDailyReport[]>(`/classes/${classId}/reports`),
    get: (id: string) => req<ReportWithNested>(`/reports/${id}`),
    create: (classId: string, body: ReportBody) =>
      req<ClassDailyReport>(`/classes/${classId}/reports`, {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    update: (classId: string, id: string, body: ReportBody) =>
      req<ClassDailyReport>(`/classes/${classId}/reports/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
    delete: (classId: string, id: string) => req<void>(`/classes/${classId}/reports/${id}`, { method: 'DELETE' }),
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
    update: (classId: string, id: string, body: Partial<ClassLoggedHours>) =>
      req<ClassLoggedHours>(`/classes/${classId}/hours/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
    delete: (classId: string, id: string) => req<void>(`/classes/${classId}/hours/${id}`, { method: 'DELETE' }),
  },

  profiles: {
    /**
     * Search user profiles by role and/or name/email substring.
     * Used by the trainer and student assignment modals to find existing users.
     * Filters out undefined/empty values before building the query string.
     */
    search: (params: { role?: string; search?: string }) => {
      const qs = new URLSearchParams(
        Object.fromEntries(
          Object.entries(params).filter(([, v]) => v !== undefined && v !== ''),
        ) as Record<string, string>,
      ).toString()
      return req<Pick<Profile, 'id' | 'full_name' | 'email'>[]>(`/profiles${qs ? `?${qs}` : ''}`)
    },
    /** Paginated profile search. Returns { data, total, page, limit }. */
    searchPaginated: (params: { role?: string; search?: string; page?: number; limit?: number }) => {
      const entries: Record<string, string> = { page: String(params.page ?? 0), limit: String(params.limit ?? 25) }
      if (params.role) entries.role = params.role
      if (params.search) entries.search = params.search
      const qs = new URLSearchParams(entries).toString()
      return req<{ data: Pick<Profile, 'id' | 'full_name' | 'email'>[]; total: number; page: number; limit: number }>(`/profiles?${qs}`)
    },
    /** Fetch the currently authenticated user's full profile record. */
    me: () => req<Profile>('/profiles/me'),
    /** Update the currently authenticated user's profile (full_name, province). */
    update: (body: { full_name?: string; province?: string }) =>
      req<Profile>('/profiles/me', { method: 'PUT', body: JSON.stringify(body) }),
  },
}
