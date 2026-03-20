import { Router, type Request, type Response, type NextFunction } from 'express'
import { supabase } from '../lib/supabase'

export const classesRouter = Router()

// GET /classes?archived=true|false  (defaults to false)
classesRouter.get('/classes', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const archived = req.query.archived === 'true'
    const { data, error } = await supabase
      .from('classes')
      .select('*')
      .eq('archived', archived)
      .order('start_date', { ascending: false })
    if (error) throw error
    res.json(data)
  } catch (err) {
    next(err)
  }
})

// GET /classes/by-name/:name  (must be before /:id)
classesRouter.get('/classes/by-name/:name', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { data, error } = await supabase
      .from('classes')
      .select('*')
      .eq('name', decodeURIComponent(req.params.name))
      .single()
    if (error) {
      if (error.code === 'PGRST116') {
        res.status(404).json({ error: 'Class not found' })
        return
      }
      throw error
    }
    res.json(data)
  } catch (err) {
    next(err)
  }
})

// GET /classes/:id
classesRouter.get('/classes/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { data, error } = await supabase
      .from('classes')
      .select('*')
      .eq('id', req.params.id)
      .single()
    if (error) {
      if (error.code === 'PGRST116') {
        res.status(404).json({ error: 'Class not found' })
        return
      }
      throw error
    }
    res.json(data)
  } catch (err) {
    next(err)
  }
})

// POST /classes
classesRouter.post('/classes', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { name, site, province, game_type, start_date, end_date, description } = req.body

    const { data: existing } = await supabase
      .from('classes')
      .select('id')
      .eq('name', name)
      .limit(1)
    if (existing && existing.length > 0) {
      res.status(409).json({ error: 'A class with this name already exists.' })
      return
    }

    const { data, error } = await supabase
      .from('classes')
      .insert({
        name,
        site,
        province,
        game_type: game_type ?? null,
        start_date,
        end_date,
        description: description ?? null,
      })
      .select()
      .single()
    if (error) throw error
    res.status(201).json(data)
  } catch (err) {
    next(err)
  }
})

// PUT /classes/:id
classesRouter.put('/classes/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { name, site, province, game_type, start_date, end_date, description, archived } = req.body
    const update: Record<string, unknown> = {
      name,
      site,
      province,
      game_type: game_type ?? null,
      start_date,
      end_date,
      description: description ?? null,
    }
    if (archived !== undefined) update.archived = archived
    const { data, error } = await supabase
      .from('classes')
      .update(update)
      .eq('id', req.params.id)
      .select()
      .single()
    if (error) {
      if (error.code === 'PGRST116') {
        res.status(404).json({ error: 'Class not found' })
        return
      }
      throw error
    }
    res.json(data)
  } catch (err) {
    next(err)
  }
})

// DELETE /classes/:id
classesRouter.delete('/classes/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { data: existing, error: fetchError } = await supabase
      .from('classes')
      .select('id')
      .eq('id', req.params.id)
      .single()
    if (fetchError || !existing) {
      res.status(404).json({ error: 'Class not found' })
      return
    }
    const { error } = await supabase.from('classes').delete().eq('id', req.params.id)
    if (error) throw error
    res.status(204).send()
  } catch (err) {
    next(err)
  }
})
