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

export const profilesRouter = Router()

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

// Whitelisted role values — only these are valid for the ?role= query param
const VALID_ROLES = new Set(['coordinator', 'trainer', 'trainee'])

/**
 * GET /profiles?role=<role>&search=<term>
 * Auth: any authenticated user
 * Returns a filtered list of profiles (id, full_name, email only).
 * Both query params are optional and can be combined:
 *   - `?role=trainer` — returns only profiles with the trainer role
 *   - `?search=john`  — case-insensitive match on full_name or email
 *   - `?role=trainer&search=john` — both filters applied
 * Without a search term, results are capped at 25 to prevent bulk enumeration.
 * The search string is sanitised before use (strips PostgREST DSL characters).
 * Returns 400 if `role` is not in VALID_ROLES.
 */
profilesRouter.get('/profiles', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { role, search } = req.query as { role?: string; search?: string }

    // Whitelist the role parameter to prevent unexpected filter injection
    if (role !== undefined && !VALID_ROLES.has(role)) {
      res.status(400).json({ error: 'Invalid role value' })
      return
    }

    let query = supabase
      .from('profiles')
      .select('id, full_name, email')
      .order('full_name', { ascending: true })

    if (role) {
      query = query.eq('role', role)
    }

    if (search) {
      // Strip characters that could abuse PostgREST's .or() DSL, then cap length
      const safeSearch = search.replace(/[(),"'\\]/g, '').slice(0, 100)
      query = query.or(`full_name.ilike.%${safeSearch}%,email.ilike.%${safeSearch}%`)
    } else {
      query = query.limit(25)
    }

    const { data, error } = await query
    if (error) throw error
    res.json(data)
  } catch (err) {
    next(err)
  }
})
