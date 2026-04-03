-- Migration 003: Remove status column from class_daily_reports
-- Reports are always editable; the draft/finalized workflow has been removed.

ALTER TABLE class_daily_reports DROP COLUMN IF EXISTS status;
