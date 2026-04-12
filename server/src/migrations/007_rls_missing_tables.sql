-- Migration 007: Enable RLS on tables that were missing it
-- Both tables are only accessed via the backend service role (which bypasses RLS).
-- Enabling RLS with no permissive policies blocks any direct anon-key access
-- while leaving all backend operations unaffected.

ALTER TABLE class_daily_report_drill_times ENABLE ROW LEVEL SECURITY;

ALTER TABLE role_requests ENABLE ROW LEVEL SECURITY;
