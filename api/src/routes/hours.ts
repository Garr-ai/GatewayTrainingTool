import { Router, type Request, type Response, type NextFunction } from 'express'
import { supabase } from '../lib/supabase'

export const hoursRouter = Router()

// GET /classes/:classId/hours
hoursRouter.get('/classes/:classId/hours', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { data, error } = await supabase
      .from('class_logged_hours')
      .select('*')
      .eq('class_id', req.params.classId)
      .order('log_date', { ascending: false })
      .order('created_at', { ascending: false })
    if (error) throw error
    res.json(data)
  } catch (err) {
    next(err)
  }
})

// POST /classes/:classId/hours
hoursRouter.post('/classes/:classId/hours', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { log_date, person_type, trainer_id, enrollment_id, hours, paid, live_training, notes } =
      req.body
    const { data, error } = await supabase
      .from('class_logged_hours')
      .insert({
        class_id: req.params.classId,
        log_date,
        person_type,
        trainer_id: trainer_id ?? null,
        enrollment_id: enrollment_id ?? null,
        hours,
        paid: paid ?? false,
        live_training: live_training ?? false,
        notes: notes ?? null,
      })
      .select()
      .single()
    if (error) throw error
    res.status(201).json(data)
  } catch (err) {
    next(err)
  }
})

// PUT /hours/:id
hoursRouter.put('/hours/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { log_date, person_type, trainer_id, enrollment_id, hours, paid, live_training, notes } =
      req.body
    const { data, error } = await supabase
      .from('class_logged_hours')
      .update({
        log_date,
        person_type,
        trainer_id: trainer_id ?? null,
        enrollment_id: enrollment_id ?? null,
        hours,
        paid: paid ?? false,
        live_training: live_training ?? false,
        notes: notes ?? null,
      })
      .eq('id', req.params.id)
      .select()
      .single()
    if (error) throw error
    res.json(data)
  } catch (err) {
    next(err)
  }
})

// DELETE /hours/:id
hoursRouter.delete('/hours/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { error } = await supabase.from('class_logged_hours').delete().eq('id', req.params.id)
    if (error) throw error
    res.status(204).send()
  } catch (err) {
    next(err)
  }
})
