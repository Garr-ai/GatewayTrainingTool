export interface FieldDiff {
  field: string
  before: unknown
  after: unknown
  kind: 'added' | 'removed' | 'changed'
}

const IGNORED_FIELDS = new Set(['created_at', 'updated_at'])

function stable(value: unknown): string {
  if (value === null || value === undefined) return ''
  if (typeof value !== 'object') return String(value)
  return JSON.stringify(value)
}

export function diffRows(
  before: Record<string, unknown> | null,
  after: Record<string, unknown> | null,
): FieldDiff[] {
  const keys = new Set([...Object.keys(before ?? {}), ...Object.keys(after ?? {})])
  const diffs: FieldDiff[] = []
  for (const field of [...keys].filter(key => !IGNORED_FIELDS.has(key)).sort()) {
    const beforeValue = before?.[field]
    const afterValue = after?.[field]
    if (stable(beforeValue) === stable(afterValue)) continue
    if (beforeValue === undefined) diffs.push({ field, before: null, after: afterValue, kind: 'added' })
    else if (afterValue === undefined) diffs.push({ field, before: beforeValue, after: null, kind: 'removed' })
    else diffs.push({ field, before: beforeValue, after: afterValue, kind: 'changed' })
  }
  return diffs
}

export function formatAuditValue(value: unknown): string {
  if (value === null || value === undefined || value === '') return '—'
  if (typeof value === 'object') return JSON.stringify(value, null, 2)
  return String(value)
}
