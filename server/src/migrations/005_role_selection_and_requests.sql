-- Migration 005: Role selection flag + role requests approval table
-- Run this in the Supabase SQL editor before deploying the Student View feature.

-- Mark whether the user has gone through role selection after signup
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS role_selected boolean NOT NULL DEFAULT false;

-- Existing users should not see the role selection screen
UPDATE profiles SET role_selected = true WHERE role_selected = false;

-- Role request approval workflow for trainer/coordinator signups
CREATE TABLE IF NOT EXISTS role_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  requested_role text NOT NULL CHECK (requested_role IN ('trainer', 'coordinator')),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  reviewed_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Only one pending request per user at a time
CREATE UNIQUE INDEX IF NOT EXISTS idx_role_requests_user_pending
  ON role_requests (user_id) WHERE status = 'pending';
