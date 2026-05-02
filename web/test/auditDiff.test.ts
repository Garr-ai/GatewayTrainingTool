import assert from 'node:assert/strict'
import test from 'node:test'
import { diffRows } from '../src/lib/auditDiff'

test('diffRows reports added, removed, and changed fields', () => {
  const diffs = diffRows(
    { name: 'Old', archived: false, removed: 'x', updated_at: 'ignored' },
    { name: 'New', archived: false, added: 'y', updated_at: 'ignored again' },
  )

  assert.deepEqual(diffs.map(diff => [diff.field, diff.kind]), [
    ['added', 'added'],
    ['name', 'changed'],
    ['removed', 'removed'],
  ])
})
