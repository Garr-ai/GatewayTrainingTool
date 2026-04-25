-- Migration 009: Add app feedback capture table for Settings submissions
-- Run this in the Supabase SQL editor.

CREATE TABLE IF NOT EXISTS app_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  user_email text NOT NULL,
  user_role text,
  category text NOT NULL CHECK (category IN ('bug', 'feature', 'general')),
  message text NOT NULL,
  page text,
  user_agent text,
  status text NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'reviewing', 'resolved', 'archived')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_app_feedback_created_at ON app_feedback (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_app_feedback_status ON app_feedback (status);
CREATE INDEX IF NOT EXISTS idx_app_feedback_user_id ON app_feedback (user_id);
