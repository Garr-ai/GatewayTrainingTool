-- ============================================================
-- Migration 003: Payroll and background check tables (future)
-- ============================================================
-- Run this when you are ready to implement payroll and BGC features.
--
-- IMPORTANT NOTES:
-- 1. Columns marked `_encrypted` store AES-256-GCM ciphertext produced
--    by server/src/lib/encryption.ts. Never store plaintext SSNs/SINs.
-- 2. Only `payroll_admin` role can access these tables via RLS.
-- 3. All access is logged via the audit_log middleware in the API layer.
-- ============================================================

-- ── Payroll records ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.payroll_records (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id          uuid        NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  -- SIN/SSN stored encrypted — use server/src/lib/encryption.ts to encrypt before insert
  sin_encrypted       text,
  -- Salary/rate stored encrypted
  hourly_rate_encrypted text,
  pay_period_start    date        NOT NULL,
  pay_period_end      date        NOT NULL,
  total_hours         numeric(8,2) NOT NULL CHECK (total_hours >= 0),
  paid_hours          numeric(8,2) NOT NULL CHECK (paid_hours >= 0),
  gross_pay_cents     integer     NOT NULL CHECK (gross_pay_cents >= 0),
  currency            char(3)     NOT NULL DEFAULT 'CAD',
  status              text        NOT NULL DEFAULT 'draft'
                        CHECK (status IN ('draft', 'approved', 'paid')),
  approved_by         uuid        REFERENCES public.profiles(id) ON DELETE SET NULL,
  approved_at         timestamptz,
  notes               text,
  created_by          uuid        NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS payroll_records_profile_id_idx ON public.payroll_records (profile_id);
CREATE INDEX IF NOT EXISTS payroll_records_status_idx     ON public.payroll_records (status);
CREATE INDEX IF NOT EXISTS payroll_records_period_idx     ON public.payroll_records (pay_period_start, pay_period_end);

-- ── Background check records ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.background_checks (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id          uuid        NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  check_type          text        NOT NULL CHECK (check_type IN ('criminal', 'credit', 'employment', 'education', 'other')),
  provider            text,
  reference_number    text,
  status              text        NOT NULL DEFAULT 'pending'
                        CHECK (status IN ('pending', 'in_progress', 'passed', 'failed', 'expired')),
  result_summary      text,
  -- Detailed result stored encrypted if it contains PII
  result_detail_encrypted text,
  initiated_date      date        NOT NULL DEFAULT CURRENT_DATE,
  completed_date      date,
  expiry_date         date,
  initiated_by        uuid        NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS bgc_profile_id_idx ON public.background_checks (profile_id);
CREATE INDEX IF NOT EXISTS bgc_status_idx     ON public.background_checks (status);

-- ── RLS: payroll_admin only ───────────────────────────────────────────────────
ALTER TABLE public.payroll_records    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.background_checks  ENABLE ROW LEVEL SECURITY;

CREATE POLICY "payroll_records_payroll_admin_only"
  ON public.payroll_records FOR ALL
  USING (current_user_role() = 'payroll_admin')
  WITH CHECK (current_user_role() = 'payroll_admin');

CREATE POLICY "background_checks_payroll_admin_only"
  ON public.background_checks FOR ALL
  USING (current_user_role() = 'payroll_admin')
  WITH CHECK (current_user_role() = 'payroll_admin');

-- ── Enforce updated_at ───────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER payroll_records_updated_at
  BEFORE UPDATE ON public.payroll_records
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER background_checks_updated_at
  BEFORE UPDATE ON public.background_checks
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
