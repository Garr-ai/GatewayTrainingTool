-- Migration 011: Coordinator feedback inbox metadata and persistent legacy import batches.
-- Run this in the Supabase SQL editor.

ALTER TABLE app_feedback
  ADD COLUMN IF NOT EXISTS reviewed_by uuid REFERENCES profiles(id),
  ADD COLUMN IF NOT EXISTS reviewed_at timestamptz,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_app_feedback_category ON app_feedback (category);
CREATE INDEX IF NOT EXISTS idx_app_feedback_updated_at ON app_feedback (updated_at DESC);

CREATE TABLE IF NOT EXISTS legacy_import_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  import_id text NOT NULL UNIQUE,
  class_id uuid NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  file_name text,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'rolled_back', 'partial_rollback')),
  report_count integer NOT NULL DEFAULT 0,
  payroll_count integer NOT NULL DEFAULT 0,
  enrollment_count integer NOT NULL DEFAULT 0,
  progress_unmatched integer NOT NULL DEFAULT 0,
  created_report_ids uuid[] NOT NULL DEFAULT '{}',
  created_hour_ids uuid[] NOT NULL DEFAULT '{}',
  created_enrollment_ids uuid[] NOT NULL DEFAULT '{}',
  skipped_reports integer NOT NULL DEFAULT 0,
  skipped_payroll integer NOT NULL DEFAULT 0,
  excluded_sheets jsonb NOT NULL DEFAULT '[]'::jsonb,
  warnings jsonb NOT NULL DEFAULT '[]'::jsonb,
  summary jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid NOT NULL REFERENCES profiles(id),
  rolled_back_by uuid REFERENCES profiles(id),
  rolled_back_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_legacy_import_batches_class ON legacy_import_batches (class_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_legacy_import_batches_status ON legacy_import_batches (status);
CREATE INDEX IF NOT EXISTS idx_legacy_import_batches_created_by ON legacy_import_batches (created_by);

ALTER TABLE legacy_import_batches ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS legacy_import_batches_select_coordinator ON legacy_import_batches;
CREATE POLICY legacy_import_batches_select_coordinator ON legacy_import_batches
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid() AND p.role = 'coordinator'
    )
  );
