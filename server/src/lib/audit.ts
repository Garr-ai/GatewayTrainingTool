import { supabase } from './supabase'

export type AuditAction = 'CREATE' | 'READ' | 'UPDATE' | 'DELETE'

interface AuditEntry {
  userId: string
  action: AuditAction
  tableName: string
  recordId: string
  metadata?: Record<string, unknown>
  ipAddress?: string
}

/**
 * Write an immutable audit log entry to the `audit_logs` table.
 *
 * This function intentionally never throws — a failure to write an audit log
 * must NOT roll back the primary operation, but it IS logged to stderr so
 * infrastructure alerts can catch silent audit failures.
 *
 * Table DDL (run in Supabase SQL editor):
 *   See supabase/migrations/002_audit_logs.sql
 */
export async function logAudit(entry: AuditEntry): Promise<void> {
  try {
    const { error } = await supabase.from('audit_logs').insert({
      user_id: entry.userId,
      action: entry.action,
      table_name: entry.tableName,
      record_id: entry.recordId,
      metadata: entry.metadata ?? null,
      ip_address: entry.ipAddress ?? null,
    })
    if (error) {
      // Log to stderr but don't surface to the caller
      console.error('[audit] Failed to write audit log:', error.message, entry)
    }
  } catch (err) {
    console.error('[audit] Unexpected error writing audit log:', err, entry)
  }
}
