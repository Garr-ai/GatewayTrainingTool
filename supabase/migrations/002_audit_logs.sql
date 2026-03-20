-- ============================================================
-- Migration 002: Audit log table
-- ============================================================
-- Provides an immutable record of who accessed, created, modified,
-- or deleted sensitive records — required for payroll and background
-- check compliance in most jurisdictions.
--
-- The `audit_logs` table is INSERT-only for the service role.
-- No authenticated user can UPDATE or DELETE audit entries.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.audit_logs (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid        NOT NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  action      text        NOT NULL CHECK (action IN ('CREATE', 'READ', 'UPDATE', 'DELETE')),
  table_name  text        NOT NULL,
  record_id   text        NOT NULL,
  metadata    jsonb,
  ip_address  text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- Index for common lookup patterns
CREATE INDEX IF NOT EXISTS audit_logs_user_id_idx     ON public.audit_logs (user_id);
CREATE INDEX IF NOT EXISTS audit_logs_table_name_idx  ON public.audit_logs (table_name);
CREATE INDEX IF NOT EXISTS audit_logs_created_at_idx  ON public.audit_logs (created_at DESC);

-- ── RLS: INSERT-only from service role; no user can modify or delete ──────────
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Only coordinators and payroll admins can READ audit logs
CREATE POLICY "audit_logs_select_privileged"
  ON public.audit_logs FOR SELECT
  USING (current_user_role() IN ('coordinator', 'payroll_admin'));

-- No authenticated user can INSERT directly — only the service role (backend) can
-- (service role bypasses RLS by default in Supabase)

-- Explicitly deny UPDATE and DELETE for all authenticated users
CREATE POLICY "audit_logs_no_update"
  ON public.audit_logs FOR UPDATE
  USING (false);

CREATE POLICY "audit_logs_no_delete"
  ON public.audit_logs FOR DELETE
  USING (false);

-- ── Comment ───────────────────────────────────────────────────────────────────
COMMENT ON TABLE public.audit_logs IS
  'Immutable audit trail. Written by the Express service role only. '
  'No row may be updated or deleted — create a new corrective entry instead.';
