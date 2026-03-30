-- Migration 001: Add attendance column to trainee progress table
-- Run this in the Supabase SQL editor before deploying Phase 3 (Attendance Tracking).

ALTER TABLE class_daily_report_trainee_progress
  ADD COLUMN IF NOT EXISTS attendance boolean NOT NULL DEFAULT true;
