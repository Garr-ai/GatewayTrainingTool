/**
 * server/src/routes/profiles.ts — User profile read routes
 *
 * Authentication: requireAuth only (no requireCoordinator).
 * These routes are mounted BEFORE requireCoordinator in routes/index.ts so that
 * all authenticated users (trainers, trainees, coordinators) can access them.
 *
 * Routes:
 *   GET /profiles/me         — Get the calling user's own full profile record
 *   GET /profiles?role=&search= — Search profiles by role and/or name/email
 *
 * The /profiles route is used by coordinators to find users when assigning trainers
 * or enrolling students. Only id, full_name, and email are returned (not sensitive
 * fields like role or created_at) to limit data exposure in search results.
 *
 * Security notes:
 *   - The `role` query param is whitelisted against VALID_ROLES to prevent
 *     unexpected filter injection into the Supabase query.
 *   - The `search` string is sanitised (strips PostgREST DSL-special characters)
 *     and capped at 100 characters before being used in the .or() filter.
 *   - Without a search term, results are limited to 25 to prevent bulk user enumeration.
 */

import { Router, type Request, type Response, type NextFunction } from 'express'
import { supabase } from '../lib/supabase'
import { logAudit } from '../lib/audit'

export const profilesRouter = Router()

const LEGACY_EMAIL_DOMAIN = 'gatewaytraining.local'

function normalizeName(value: string): string {
  return value.replace(/\s+/g, ' ').trim()
}

function splitName(fullName: string): { first: string; last: string } | null {
  const normalized = normalizeName(fullName)
  const parts = normalized.split(' ').filter(Boolean)
  if (parts.length < 2) return null
  return { first: parts[0], last: parts.slice(1).join(' ') }
}

async function claimLegacyStudentEnrollments(studentName: string, email: string): Promise<void> {
  const normalized = normalizeName(studentName)
  if (!normalized || !email) return

  const { data: legacyEnrollments, error } = await supabase
    .from('class_enrollments')
    .select('id, class_id, student_email, student_name')
    .eq('student_name', normalized)
    .ilike('student_email', `%@${LEGACY_EMAIL_DOMAIN}`)
  if (error) throw error
  if (!legacyEnrollments || legacyEnrollments.length === 0) return

  for (const enrollment of legacyEnrollments) {
    const row = enrollment as { id: string; class_id: string; student_email: string; student_name: string }
    const { data: existing, error: existingError } = await supabase
      .from('class_enrollments')
      .select('id')
      .eq('class_id', row.class_id)
      .eq('student_email', email)
      .maybeSingle()
    if (existingError) throw existingError

    if (existing) {
      const { error: deleteError } = await supabase
        .from('class_enrollments')
        .delete()
        .eq('id', row.id)
      if (deleteError) throw deleteError
      continue
    }

    const { error: updateError } = await supabase
      .from('class_enrollments')
      .update({
        student_email: email,
        student_name: normalized,
      })
      .eq('id', row.id)
    if (updateError) throw updateError
  }
}

/**
 * GET /profiles/me
 * Auth: any authenticated user
 * Returns the full profile record for the currently authenticated user, identified
 * by req.userId (set by requireAuth). Used by AuthContext on login to fetch the
 * user's role and display name. Returns 404 if the profile row doesn't exist yet.
 */
profilesRouter.get('/profiles/me', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', req.userId!)
      .single()
    if (error) {
      if (error.code === 'PGRST116') {
        res.status(404).json({ error: 'Profile not found' })
        return
      }
      throw error
    }
    res.json(data)
  } catch (err) {
    next(err)
  }
})

/**
 * PUT /profiles/me
 * Auth: any authenticated user
 * Updates the current user's profile. Accepts first_name, last_name, phone,
 * full_name, and province. Role changes are not permitted via this endpoint.
 */
const VALID_PROVINCES = new Set(['BC', 'AB', 'ON'])

profilesRouter.put('/profiles/me', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { full_name, first_name, last_name, phone, province } = req.body as {
      full_name?: string; first_name?: string; last_name?: string; phone?: string; province?: string
    }

    const updates: Record<string, unknown> = {}
    if (full_name !== undefined) updates.full_name = full_name.trim() || null
    if (first_name !== undefined) updates.first_name = first_name.trim() || null
    if (last_name !== undefined) updates.last_name = last_name.trim() || null
    if (phone !== undefined) updates.phone = phone.trim() || null
    if (province !== undefined) {
      if (!VALID_PROVINCES.has(province)) {
        res.status(400).json({ error: 'Invalid province value' })
        return
      }
      updates.province = province
    }

    // Keep full_name in sync when first/last are provided
    if (updates.first_name !== undefined || updates.last_name !== undefined) {
      const fn = (updates.first_name ?? '') as string
      const ln = (updates.last_name ?? '') as string
      updates.full_name = [fn, ln].filter(Boolean).join(' ') || null
    }

    if (Object.keys(updates).length === 0) {
      res.status(400).json({ error: 'No valid fields to update' })
      return
    }

    const { data, error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', req.userId!)
      .select()
      .single()

    if (error) throw error

    await logAudit({
      userId: req.userId!,
      action: 'UPDATE',
      tableName: 'profiles',
      recordId: req.userId!,
      metadata: updates,
      ipAddress: req.ip,
    })

    res.json(data)
  } catch (err) {
    next(err)
  }
})

/**
 * PUT /profiles/me/role-selection
 * Auth: any authenticated user
 * Called once after signup to set the user's chosen role and profile data.
 *   - 'trainee' → immediately active (role stays trainee, role_selected set to true)
 *   - 'trainer' or 'coordinator' → creates a pending role_request for coordinator approval
 * Also accepts first_name, last_name, phone to collect profile data during onboarding.
 * Returns { status: 'active' | 'pending' }.
 */
const SELECTABLE_ROLES = new Set(['trainee', 'trainer', 'coordinator'])

profilesRouter.put('/profiles/me/role-selection', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { selected_role, first_name, last_name, phone } = req.body as {
      selected_role?: string; first_name?: string; last_name?: string; phone?: string
    }
    if (!selected_role || !SELECTABLE_ROLES.has(selected_role)) {
      res.status(400).json({ error: 'Invalid selected_role. Must be trainee, trainer, or coordinator.' })
      return
    }

    // Require first and last name
    if (!first_name?.trim() || !last_name?.trim()) {
      res.status(400).json({ error: 'First name and last name are required.' })
      return
    }

    // Build profile updates
    const profileUpdates: Record<string, unknown> = {
      role_selected: true,
      first_name: first_name.trim(),
      last_name: last_name.trim(),
      full_name: [first_name.trim(), last_name.trim()].filter(Boolean).join(' '),
    }
    if (phone !== undefined) profileUpdates.phone = phone.trim() || null

    // Mark role as selected and save profile data
    const { error: updateError } = await supabase
      .from('profiles')
      .update(profileUpdates)
      .eq('id', req.userId!)
    if (updateError) throw updateError

    if (selected_role === 'trainee') {
      await claimLegacyStudentEnrollments(profileUpdates.full_name as string, req.userEmail ?? '')
      // Students proceed immediately — role is already 'trainee' by default
      res.json({ status: 'active' })
      return
    }

    // Trainer or coordinator — create a pending role request
    const { error: insertError } = await supabase
      .from('role_requests')
      .insert({
        user_id: req.userId!,
        requested_role: selected_role,
        status: 'pending',
      })
    if (insertError) {
      // Unique constraint violation = pending request already exists
      if (insertError.code === '23505') {
        res.status(409).json({ error: 'A pending role request already exists.' })
        return
      }
      throw insertError
    }

    await logAudit({
      userId: req.userId!,
      action: 'CREATE',
      tableName: 'role_requests',
      recordId: req.userId!,
      metadata: { requested_role: selected_role },
      ipAddress: req.ip,
    })

    res.json({ status: 'pending' })
  } catch (err) {
    next(err)
  }
})

/**
 * POST /profiles/legacy-students
 * Auth: coordinator
 * Returns legacy student identity mappings for import.
 * - If a real profile exists by first+last name, return that email.
 * - Otherwise return a deterministic placeholder email in LEGACY_EMAIL_DOMAIN.
 *
 * We intentionally do not insert placeholder rows into `profiles` because in
 * production that table is commonly constrained to auth.users IDs.
 */
profilesRouter.post('/profiles/legacy-students', async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (req.userRole !== 'coordinator') {
      res.status(403).json({ error: 'Coordinator access required' })
      return
    }

    const students = ((req.body as { students?: unknown })?.students ?? []) as string[]
    if (!Array.isArray(students) || students.length === 0) {
      res.status(400).json({ error: 'students array is required' })
      return
    }

    const uniqueNames = [...new Set(students.map(normalizeName).filter(Boolean))]
    const results: Array<{ full_name: string; email: string; created: boolean }> = []
    const usedGeneratedEmails = new Set<string>()

    for (const fullName of uniqueNames) {
      const split = splitName(fullName)
      if (!split) continue

      // Prefer existing real profile for this name
      const { data: existingReal } = await supabase
        .from('profiles')
        .select('email, full_name')
        .eq('first_name', split.first)
        .eq('last_name', split.last)
        .not('email', 'ilike', `%@${LEGACY_EMAIL_DOMAIN}`)
        .maybeSingle()
      if (existingReal?.email) {
        results.push({ full_name: fullName, email: existingReal.email, created: false })
        continue
      }

      // Reuse existing placeholder if present
      const { data: existingLegacy } = await supabase
        .from('profiles')
        .select('email, full_name')
        .eq('first_name', split.first)
        .eq('last_name', split.last)
        .ilike('email', `%@${LEGACY_EMAIL_DOMAIN}`)
        .maybeSingle()
      if (existingLegacy?.email) {
        results.push({ full_name: fullName, email: existingLegacy.email, created: false })
        continue
      }

      // Generate a stable placeholder identity for class enrollment import.
      const slug = fullName
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '.')
        .replace(/^\.+|\.+$/g, '')
      const baseEmail = `legacy+${slug}`
      let email = `${baseEmail}@${LEGACY_EMAIL_DOMAIN}`
      let attempt = 0
      while (attempt < 20) {
        const { data: emailExists } = await supabase
          .from('profiles')
          .select('id')
          .eq('email', email)
          .maybeSingle()
        if (!emailExists && !usedGeneratedEmails.has(email)) break
        attempt += 1
        email = `${baseEmail}.${attempt}@${LEGACY_EMAIL_DOMAIN}`
      }
      usedGeneratedEmails.add(email)

      results.push({ full_name: fullName, email, created: true })
    }

    res.status(201).json({ data: results })
  } catch (err) {
    next(err)
  }
})

// Whitelisted role values — only these are valid for the ?role= query param
const VALID_ROLES = new Set(['coordinator', 'trainer', 'trainee'])

/**
 * GET /profiles?role=<role>&search=<term>&page=<n>&limit=<n>
 * Auth: coordinator only — returns the full user directory for assigning trainers/students.
 * Non-coordinator roles (trainer, trainee) receive 403.
 * Returns a filtered list of profiles (id, full_name, email only).
 * Both query params are optional and can be combined:
 *   - `?role=trainer` — returns only profiles with the trainer role
 *   - `?search=john`  — case-insensitive match on full_name or email
 *   - `?role=trainer&search=john` — both filters applied
 *   - `?page=0&limit=25` — paginated response with { data, total, page, limit }
 * Without pagination params, returns a flat array (backward compatible).
 * Without a search term, results are capped at 25 to prevent bulk enumeration.
 * The search string is sanitised before use (strips PostgREST DSL characters).
 * Returns 400 if `role` is not in VALID_ROLES.
 */
profilesRouter.get('/profiles', async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Only coordinators need the user directory (assigning trainers, enrolling students).
    // Trainers and trainees have no legitimate reason to enumerate all users.
    if (req.userRole !== 'coordinator') {
      res.status(403).json({ error: 'Coordinator access required' })
      return
    }

    const { role, search, page: pageStr, limit: limitStr } = req.query as {
      role?: string; search?: string; page?: string; limit?: string
    }

    // Whitelist the role parameter to prevent unexpected filter injection
    if (role !== undefined && !VALID_ROLES.has(role)) {
      res.status(400).json({ error: 'Invalid role value' })
      return
    }

    const paginated = pageStr !== undefined
    const page = Math.max(0, parseInt(pageStr ?? '0', 10) || 0)
    const limit = Math.min(200, Math.max(1, parseInt(limitStr ?? '25', 10) || 25))

    // Build the base query with count for pagination
    let query = supabase
      .from('profiles')
      .select('id, full_name, email', paginated ? { count: 'exact' } : {})
      .order('full_name', { ascending: true })

    if (role) {
      query = query.eq('role', role)
    }

    if (search) {
      // Strip characters that could abuse PostgREST's .or() DSL, then cap length
      const safeSearch = search.replace(/[(),"'\\]/g, '').slice(0, 100)
      query = query.or(`full_name.ilike.%${safeSearch}%,email.ilike.%${safeSearch}%`)
    }

    if (paginated) {
      const from = page * limit
      query = query.range(from, from + limit - 1)
    } else if (!search) {
      query = query.limit(25)
    }

    const { data, error, count } = await query
    if (error) throw error

    if (paginated) {
      res.json({ data, total: count ?? 0, page, limit })
    } else {
      res.json(data)
    }
  } catch (err) {
    next(err)
  }
})
