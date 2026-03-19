import { Router, type Request, type Response, type NextFunction } from 'express'
import { supabase } from '../lib/supabase'

export const trainersRouter = Router()

// GET /classes/:classId/trainers
trainersRouter.get('/classes/:classId/trainers', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { data, error } = await supabase
      .from('class_trainers')
      .select('*')
      .eq('class_id', req.params.classId)
      .order('created_at', { ascending: false })
    if (error) throw error
    res.json(data)
  } catch (err) {
    next(err)
  }
})

// POST /classes/:classId/trainers
trainersRouter.post('/classes/:classId/trainers', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { trainer_name, trainer_email, role } = req.body
    const { data, error } = await supabase
      .from('class_trainers')
      .insert({
        class_id: req.params.classId,
        trainer_name,
        trainer_email,
        role,
      })
      .select()
      .single()
    if (error) throw error
    res.status(201).json(data)
  } catch (err) {
    next(err)
  }
})

// PUT /trainers/:id
trainersRouter.put('/trainers/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { trainer_name, trainer_email, role } = req.body
    const { data, error } = await supabase
      .from('class_trainers')
      .update({ trainer_name, trainer_email, role })
      .eq('id', req.params.id)
      .select()
      .single()
    if (error) throw error
    res.json(data)
  } catch (err) {
    next(err)
  }
})

// DELETE /trainers/:id
trainersRouter.delete('/trainers/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { error } = await supabase.from('class_trainers').delete().eq('id', req.params.id)
    if (error) throw error
    res.status(204).send()
  } catch (err) {
    next(err)
  }
})
