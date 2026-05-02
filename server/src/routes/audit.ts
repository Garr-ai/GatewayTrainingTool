import { Router, type Request, type Response, type NextFunction } from 'express'
import { supabase } from '../lib/supabase'
import type { AuditAction } from '../lib/audit'

export const auditRouter = Router()

const ACTIONS = new Set<AuditAction>(['CREATE', 'READ', 'UPDATE', 'DELETE'])
const MAX_LIMIT = 200

interface Cursor {
  createdAt: string
  id: number
}

function encodeCursor(cursor: Cursor): string {
  return Buffer.from(JSON.stringify(cursor), 'utf8').toString('base64url')
}

function decodeCursor(value: string | undefined): Cursor | null {
  if (!value) return null
  const parsed = JSON.parse(Buffer.from(value, 'base64url').toString('utf8')) as Partial<Cursor>
  if (!parsed.createdAt || typeof parsed.id !== 'number') throw new Error('Invalid cursor')
  return { createdAt: parsed.createdAt, id: parsed.id }
}

function parseLimit(raw: string | undefined): number {
  return Math.min(MAX_LIMIT, Math.max(1, Number(raw) || 50))
}

async function attachUserEmails(rows: Array<Record<string, unknown>>) {
  const userIds = [...new Set(rows.map(row => row.user_id as string).filter(Boolean))]
  const emailMap = new Map<string, string>()
  if (userIds.length > 0) {
    const { data } = await supabase.from('profiles').select('id, email').in('id', userIds)
    for (const profile of data ?? []) emailMap.set(profile.id, profile.email)
  }

  return rows.map(row => ({
    id: row.id,
    userId: row.user_id,
    userEmail: emailMap.get(row.user_id as string) ?? null,
    action: row.action,
    tableName: row.table_name,
    recordId: row.record_id,
    before: row.before_row ?? null,
    after: row.after_row ?? null,
    metadata: row.metadata ?? null,
    ipAddress: row.ip_address ?? null,
    createdAt: row.created_at,
  }))
}

// Supabase's fluent query builder type is intentionally opaque across chained
// filters, so this helper keeps cursor application local instead of exporting it.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function applyCursor(query: any, cursor: Cursor | null) {
  if (!cursor) return query
  return query.or(`created_at.lt.${cursor.createdAt},and(created_at.eq.${cursor.createdAt},id.lt.${cursor.id})`)
}

/**
 * GET /audit
 * Coordinator-only global audit feed with filters and keyset pagination.
 */
auditRouter.get('/audit', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const {
      userId,
      tableName,
      action,
      from,
      to,
      cursor: rawCursor,
      limit: rawLimit,
    } = req.query as Record<string, string | undefined>

    if (action && !ACTIONS.has(action as AuditAction)) {
      res.status(400).json({ error: 'Invalid action filter' })
      return
    }

    let cursor: Cursor | null = null
    try {
      cursor = decodeCursor(rawCursor)
    } catch {
      res.status(400).json({ error: 'Invalid cursor' })
      return
    }

    const limit = parseLimit(rawLimit)
    let query = supabase
      .from('audit_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .order('id', { ascending: false })
      .limit(limit + 1)

    if (userId) query = query.eq('user_id', userId)
    if (tableName) query = query.eq('table_name', tableName)
    if (action) query = query.eq('action', action)
    if (from) query = query.gte('created_at', from)
    if (to) query = query.lte('created_at', to)
    query = applyCursor(query, cursor)

    const { data, error } = await query
    if (error) throw error

    const rows = ((data ?? []) as Array<Record<string, unknown>>).slice(0, limit)
    const nextRow = (data ?? [])[limit] as Record<string, unknown> | undefined
    const entries = await attachUserEmails(rows)
    res.json({
      entries,
      nextCursor: nextRow ? encodeCursor({ createdAt: nextRow.created_at as string, id: nextRow.id as number }) : null,
    })
  } catch (err) {
    next(err)
  }
})

/**
 * GET /audit/record/:tableName/:recordId
 * Coordinator-only history for a specific record.
 */
auditRouter.get('/audit/record/:tableName/:recordId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    let cursor: Cursor | null = null
    try {
      cursor = decodeCursor((req.query as Record<string, string | undefined>).cursor)
    } catch {
      res.status(400).json({ error: 'Invalid cursor' })
      return
    }

    const limit = parseLimit((req.query as Record<string, string | undefined>).limit)
    let query = supabase
      .from('audit_logs')
      .select('*')
      .eq('table_name', req.params.tableName as string)
      .eq('record_id', req.params.recordId as string)
      .order('created_at', { ascending: false })
      .order('id', { ascending: false })
      .limit(limit + 1)
    query = applyCursor(query, cursor)

    const { data, error } = await query
    if (error) throw error

    const rows = ((data ?? []) as Array<Record<string, unknown>>).slice(0, limit)
    const nextRow = (data ?? [])[limit] as Record<string, unknown> | undefined
    const entries = await attachUserEmails(rows)
    res.json({
      entries,
      nextCursor: nextRow ? encodeCursor({ createdAt: nextRow.created_at as string, id: nextRow.id as number }) : null,
    })
  } catch (err) {
    next(err)
  }
})
