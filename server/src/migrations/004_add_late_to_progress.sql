-- Migration 004: Add late column to trainee progress table
-- Run this in the Supabase SQL editor.

ALTER TABLE class_daily_report_trainee_progress
  ADD COLUMN IF NOT EXISTS late boolean NOT NULL DEFAULT false;
