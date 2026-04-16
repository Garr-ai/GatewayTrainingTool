// server/src/lib/autoFail.ts
// Shared helper: auto-fail enrolled students who have coming_back_next_day = false
// in the given report's progress rows.

import { supabase } from './supabase'
import { logAudit } from './audit'

export async function autoFailNotComingBack(
  classId: string,
  reportId: string,
  userId: string,
  ip: string | undefined,
): Promise<void> {
  // Find enrollment_ids where the student is not coming back
  const { data: failedProgress, error: progressError } = await supabase
    .from('class_daily_report_trainee_progress')
    .select('enrollment_id')
    .eq('report_id', reportId)
    .eq('coming_back_next_day', false)
  if (progressError) throw progressError

  const ids = (failedProgress ?? []).map((p: { enrollment_id: string }) => p.enrollment_id)
  if (ids.length === 0) return

  // Only update currently enrolled students (not already dropped/failed)
  const { data: updated, error: updateError } = await supabase
    .from('class_enrollments')
    .update({ status: 'failed' })
    .in('id', ids)
    .eq('class_id', classId)
    .eq('status', 'enrolled')
    .select('id')
  if (updateError) throw updateError

  for (const row of updated ?? []) {
    await logAudit({
      userId,
      action: 'UPDATE',
      tableName: 'class_enrollments',
      recordId: (row as { id: string }).id,
      metadata: { class_id: classId, reason: 'auto_fail_not_coming_back', report_id: reportId },
      ipAddress: ip,
    })
  }
}
