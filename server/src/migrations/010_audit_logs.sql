-- Migration 010: Formalize audit logs for compliance and coordinator review.

CREATE TABLE IF NOT EXISTS audit_logs (
  id bigserial PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id),
  action text NOT NULL CHECK (action IN ('CREATE', 'READ', 'UPDATE', 'DELETE')),
  table_name text NOT NULL,
  record_id text NOT NULL,
  before_row jsonb,
  after_row jsonb,
  metadata jsonb,
  ip_address text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS before_row jsonb;
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS after_row jsonb;

CREATE INDEX IF NOT EXISTS audit_logs_record_idx ON audit_logs(table_name, record_id, created_at DESC);
CREATE INDEX IF NOT EXISTS audit_logs_user_idx ON audit_logs(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS audit_logs_created_idx ON audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS audit_logs_table_action_idx ON audit_logs(table_name, action, created_at DESC);

ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS audit_logs_select_coordinator ON audit_logs;
CREATE POLICY audit_logs_select_coordinator ON audit_logs
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid() AND p.role = 'coordinator'
    )
  );

-- Keep the table append-only from app-facing roles. The backend service role
-- inserts through Supabase service credentials and does not need update/delete.
REVOKE UPDATE, DELETE ON audit_logs FROM authenticated, anon;
