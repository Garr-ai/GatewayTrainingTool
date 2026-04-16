-- Migration 008: Add 'failed' enrollment status and coordinator_notes on reports
-- Run this in the Supabase SQL editor.

-- 1. Update enrollment status check constraint to include 'failed', remove 'waitlist'.
--    Supabase creates the constraint named <table>_<column>_check by default.
--    Use DROP CONSTRAINT IF EXISTS with the likely name, then add the new one.
ALTER TABLE class_enrollments
  DROP CONSTRAINT IF EXISTS class_enrollments_status_check;

ALTER TABLE class_enrollments
  ADD CONSTRAINT class_enrollments_status_check
    CHECK (status IN ('enrolled', 'dropped', 'failed'));

-- 2. Add coordinator_notes column to class_daily_reports.
ALTER TABLE class_daily_reports
  ADD COLUMN IF NOT EXISTS coordinator_notes text;
