import { Router, type Request, type Response, type NextFunction } from 'express'
import { supabase } from '../lib/supabase'

export const drillsRouter = Router()

// GET /classes/:classId/drills
drillsRouter.get('/classes/:classId/drills', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { data, error } = await supabase
      .from('class_drills')
      .select('*')
      .eq('class_id', req.params.classId)
      .order('created_at', { ascending: false })
    if (error) throw error
    res.json(data)
  } catch (err) {
    next(err)
  }
})

// POST /classes/:classId/drills
drillsRouter.post('/classes/:classId/drills', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { name, type, par_time_seconds, target_score } = req.body
    const { data, error } = await supabase
      .from('class_drills')
      .insert({
        class_id: req.params.classId,
        name,
        type,
        par_time_seconds: par_time_seconds ?? null,
        target_score: target_score ?? null,
        active: true,
      })
      .select()
      .single()
    if (error) throw error
    res.status(201).json(data)
  } catch (err) {
    next(err)
  }
})

// PUT /classes/:classId/drills/:id  — classId in path prevents cross-class modification (IDOR)
drillsRouter.put('/classes/:classId/drills/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { name, type, par_time_seconds, target_score, active } = req.body
    const { data, error } = await supabase
      .from('class_drills')
      .update({ name, type, par_time_seconds, target_score, active })
      .eq('id', req.params.id)
      .eq('class_id', req.params.classId)
      .select()
      .single()
    if (error) {
      if (error.code === 'PGRST116') {
        res.status(404).json({ error: 'Drill not found' })
        return
      }
      throw error
    }
    res.json(data)
  } catch (err) {
    next(err)
  }
})

// DELETE /classes/:classId/drills/:id  — classId in path prevents cross-class deletion (IDOR)
drillsRouter.delete('/classes/:classId/drills/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { data: existing, error: fetchError } = await supabase
      .from('class_drills')
      .select('id')
      .eq('id', req.params.id)
      .eq('class_id', req.params.classId)
      .single()
    if (fetchError || !existing) {
      res.status(404).json({ error: 'Drill not found' })
      return
    }
    const { error } = await supabase.from('class_drills').delete().eq('id', req.params.id)
    if (error) throw error
    res.status(204).send()
  } catch (err) {
    next(err)
  }
})
