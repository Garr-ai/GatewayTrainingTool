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

// PUT /drills/:id
drillsRouter.put('/drills/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { name, type, par_time_seconds, target_score, active } = req.body
    const { data, error } = await supabase
      .from('class_drills')
      .update({ name, type, par_time_seconds, target_score, active })
      .eq('id', req.params.id)
      .select()
      .single()
    if (error) throw error
    res.json(data)
  } catch (err) {
    next(err)
  }
})

// DELETE /drills/:id
drillsRouter.delete('/drills/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { error } = await supabase.from('class_drills').delete().eq('id', req.params.id)
    if (error) throw error
    res.status(204).send()
  } catch (err) {
    next(err)
  }
})
