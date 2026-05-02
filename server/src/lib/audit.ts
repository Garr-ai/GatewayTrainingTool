import { supabase } from './supabase'

export type AuditAction = 'CREATE' | 'READ' | 'UPDATE' | 'DELETE'

export const SENSITIVE_TABLES = [
  'class_daily_reports',
  'class_daily_report_trainee_progress',
  'class_logged_hours',
  'profiles',
] as const

interface AuditEntry {
  userId: string
  action: AuditAction
  tableName: string
  recordId: string
  before?: Record<string, unknown> | null
  after?: Record<string, unknown> | null
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
 *   See server/src/migrations/010_audit_logs.sql
 */
export async function logAudit(entry: AuditEntry): Promise<void> {
  try {
    if (SENSITIVE_TABLES.includes(entry.tableName as typeof SENSITIVE_TABLES[number])) {
      const hasBefore = entry.before !== undefined && entry.before !== null
      const hasAfter = entry.after !== undefined && entry.after !== null
      const missing =
        (entry.action === 'CREATE' && !hasAfter) ||
        (entry.action === 'UPDATE' && (!hasBefore || !hasAfter)) ||
        (entry.action === 'DELETE' && !hasBefore)
      if (missing) {
        console.error('[audit] Missing snapshot for sensitive table:', {
          tableName: entry.tableName,
          action: entry.action,
          recordId: entry.recordId,
        })
      }
    }

    const { error } = await supabase.from('audit_logs').insert({
      user_id: entry.userId,
      action: entry.action,
      table_name: entry.tableName,
      record_id: entry.recordId,
      before_row: entry.before ?? null,
      after_row: entry.after ?? null,
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
