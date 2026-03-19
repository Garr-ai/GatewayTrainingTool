import { Router, type Request, type Response, type NextFunction } from 'express'
import { supabase } from '../lib/supabase'

export const scheduleRouter = Router()

// GET /schedule  (all upcoming slots across classes)
scheduleRouter.get('/schedule', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const today = new Date().toISOString().split('T')[0]
    const { data, error } = await supabase
      .from('class_schedule_slots')
      .select('*, classes(id, name, site)')
      .gte('slot_date', today)
      .order('slot_date', { ascending: true })
      .order('start_time', { ascending: true })
      .limit(200)
    if (error) throw error
    res.json(data)
  } catch (err) {
    next(err)
  }
})

// GET /classes/:classId/schedule
scheduleRouter.get('/classes/:classId/schedule', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { data, error } = await supabase
      .from('class_schedule_slots')
      .select('*')
      .eq('class_id', req.params.classId)
      .order('slot_date', { ascending: true })
      .order('start_time', { ascending: true })
    if (error) throw error
    res.json(data)
  } catch (err) {
    next(err)
  }
})

// POST /classes/:classId/schedule
scheduleRouter.post('/classes/:classId/schedule', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { slot_date, start_time, end_time, notes, trainer_id, group_label } = req.body
    const { data, error } = await supabase
      .from('class_schedule_slots')
      .insert({
        class_id: req.params.classId,
        slot_date,
        start_time,
        end_time,
        notes: notes ?? null,
        trainer_id: trainer_id ?? null,
        group_label: group_label ?? null,
      })
      .select()
      .single()
    if (error) throw error
    res.status(201).json(data)
  } catch (err) {
    next(err)
  }
})

// PUT /schedule/:id
scheduleRouter.put('/schedule/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { slot_date, start_time, end_time, notes, trainer_id, group_label } = req.body
    const { data, error } = await supabase
      .from('class_schedule_slots')
      .update({
        slot_date,
        start_time,
        end_time,
        notes: notes ?? null,
        trainer_id: trainer_id ?? null,
        group_label: group_label ?? null,
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

// DELETE /schedule/:id
scheduleRouter.delete('/schedule/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { error } = await supabase.from('class_schedule_slots').delete().eq('id', req.params.id)
    if (error) throw error
    res.status(204).send()
  } catch (err) {
    next(err)
  }
})
