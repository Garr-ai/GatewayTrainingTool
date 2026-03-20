-- ============================================================
-- Migration 001: Row-Level Security for existing tables
-- ============================================================
-- Run this in the Supabase SQL editor or via `supabase db push`.
--
-- CONTEXT
-- -------
-- The Express API already enforces auth + role checks via middleware.
-- These RLS policies add a mandatory second layer so that even if the
-- service-role key is ever compromised or a developer bypasses the API
-- and queries Supabase directly, data is still protected.
--
-- STRATEGY
-- --------
-- All tables use a helper function that checks the user's role from
-- the `profiles` table, avoiding infinite recursion on profiles itself.
-- ============================================================

-- ── Helper: return the current user's role ───────────────────────────────────
CREATE OR REPLACE FUNCTION current_user_role()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid()
$$;

-- ── profiles ─────────────────────────────────────────────────────────────────
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Any authenticated user can read their own profile
CREATE POLICY "profiles_select_own"
  ON public.profiles FOR SELECT
  USING (id = auth.uid());

-- Coordinators and payroll admins can read all profiles
CREATE POLICY "profiles_select_coordinator"
  ON public.profiles FOR SELECT
  USING (current_user_role() IN ('coordinator', 'payroll_admin'));

-- Users can update their own profile (name, avatar, etc. — not role)
CREATE POLICY "profiles_update_own"
  ON public.profiles FOR UPDATE
  USING (id = auth.uid())
  WITH CHECK (
    id = auth.uid()
    -- Prevent self-promotion: role must stay the same as what's in the DB
    AND role = (SELECT role FROM public.profiles WHERE id = auth.uid())
  );

-- Only service role (backend) can INSERT/DELETE profiles
-- (handled by Supabase auth triggers; no policy = denied for anon/authenticated)

-- ── classes ──────────────────────────────────────────────────────────────────
ALTER TABLE public.classes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "classes_select_authenticated"
  ON public.classes FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "classes_write_coordinator"
  ON public.classes FOR ALL
  USING (current_user_role() = 'coordinator')
  WITH CHECK (current_user_role() = 'coordinator');

-- ── class_drills ─────────────────────────────────────────────────────────────
ALTER TABLE public.class_drills ENABLE ROW LEVEL SECURITY;

CREATE POLICY "class_drills_select_authenticated"
  ON public.class_drills FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "class_drills_write_coordinator"
  ON public.class_drills FOR ALL
  USING (current_user_role() = 'coordinator')
  WITH CHECK (current_user_role() = 'coordinator');

-- ── class_trainers ───────────────────────────────────────────────────────────
ALTER TABLE public.class_trainers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "class_trainers_select_authenticated"
  ON public.class_trainers FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "class_trainers_write_coordinator"
  ON public.class_trainers FOR ALL
  USING (current_user_role() = 'coordinator')
  WITH CHECK (current_user_role() = 'coordinator');

-- ── class_enrollments ────────────────────────────────────────────────────────
ALTER TABLE public.class_enrollments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "class_enrollments_select_coordinator"
  ON public.class_enrollments FOR SELECT
  USING (current_user_role() IN ('coordinator', 'payroll_admin'));

-- Trainees can read their own enrollment
CREATE POLICY "class_enrollments_select_own"
  ON public.class_enrollments FOR SELECT
  USING (
    student_email = (SELECT email FROM public.profiles WHERE id = auth.uid())
  );

CREATE POLICY "class_enrollments_write_coordinator"
  ON public.class_enrollments FOR ALL
  USING (current_user_role() = 'coordinator')
  WITH CHECK (current_user_role() = 'coordinator');

-- ── class_schedule_slots ─────────────────────────────────────────────────────
ALTER TABLE public.class_schedule_slots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "class_schedule_slots_select_authenticated"
  ON public.class_schedule_slots FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "class_schedule_slots_write_coordinator"
  ON public.class_schedule_slots FOR ALL
  USING (current_user_role() = 'coordinator')
  WITH CHECK (current_user_role() = 'coordinator');

-- ── class_daily_reports ──────────────────────────────────────────────────────
ALTER TABLE public.class_daily_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "class_daily_reports_select_coordinator"
  ON public.class_daily_reports FOR SELECT
  USING (current_user_role() IN ('coordinator', 'payroll_admin'));

CREATE POLICY "class_daily_reports_write_coordinator"
  ON public.class_daily_reports FOR ALL
  USING (current_user_role() = 'coordinator')
  WITH CHECK (current_user_role() = 'coordinator');

-- ── class_daily_report_trainers ──────────────────────────────────────────────
ALTER TABLE public.class_daily_report_trainers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "class_daily_report_trainers_select_coordinator"
  ON public.class_daily_report_trainers FOR SELECT
  USING (current_user_role() IN ('coordinator', 'payroll_admin'));

CREATE POLICY "class_daily_report_trainers_write_coordinator"
  ON public.class_daily_report_trainers FOR ALL
  USING (current_user_role() = 'coordinator')
  WITH CHECK (current_user_role() = 'coordinator');

-- ── class_daily_report_timeline_items ────────────────────────────────────────
ALTER TABLE public.class_daily_report_timeline_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "timeline_items_select_coordinator"
  ON public.class_daily_report_timeline_items FOR SELECT
  USING (current_user_role() = 'coordinator');

CREATE POLICY "timeline_items_write_coordinator"
  ON public.class_daily_report_timeline_items FOR ALL
  USING (current_user_role() = 'coordinator')
  WITH CHECK (current_user_role() = 'coordinator');

-- ── class_daily_report_trainee_progress ──────────────────────────────────────
ALTER TABLE public.class_daily_report_trainee_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY "trainee_progress_select_coordinator"
  ON public.class_daily_report_trainee_progress FOR SELECT
  USING (current_user_role() = 'coordinator');

CREATE POLICY "trainee_progress_write_coordinator"
  ON public.class_daily_report_trainee_progress FOR ALL
  USING (current_user_role() = 'coordinator')
  WITH CHECK (current_user_role() = 'coordinator');

-- ── class_logged_hours ───────────────────────────────────────────────────────
-- Sensitive: used for payroll calculations. Only coordinators and payroll admins.
ALTER TABLE public.class_logged_hours ENABLE ROW LEVEL SECURITY;

CREATE POLICY "class_logged_hours_select_privileged"
  ON public.class_logged_hours FOR SELECT
  USING (current_user_role() IN ('coordinator', 'payroll_admin'));

CREATE POLICY "class_logged_hours_write_coordinator"
  ON public.class_logged_hours FOR ALL
  USING (current_user_role() = 'coordinator')
  WITH CHECK (current_user_role() = 'coordinator');
