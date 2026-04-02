-- Migration 002: Add status column to class_daily_reports
-- Supports draft/finalized workflow for reports

ALTER TABLE class_daily_reports
  ADD COLUMN IF NOT EXISTS status TEXT
    CHECK (status IN ('draft', 'finalized'))
    DEFAULT 'draft';

-- Mark all existing reports as finalized (they were implicitly final before this feature)
UPDATE class_daily_reports SET status = 'finalized' WHERE status IS NULL;
