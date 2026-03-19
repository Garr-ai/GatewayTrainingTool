import { Router, type Request, type Response, type NextFunction } from 'express'
import { supabase } from '../lib/supabase'

export const profilesRouter = Router()

// GET /profiles/me
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

// GET /profiles?role=xxx&search=xxx
profilesRouter.get('/profiles', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { role, search } = req.query as { role?: string; search?: string }

    let query = supabase
      .from('profiles')
      .select('id, full_name, email')
      .order('full_name', { ascending: true })

    if (role) {
      query = query.eq('role', role)
    }

    if (search) {
      query = query.or(`full_name.ilike.%${search}%,email.ilike.%${search}%`)
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
