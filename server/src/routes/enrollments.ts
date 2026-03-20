import { Router, type Request, type Response, type NextFunction } from 'express'
import { supabase } from '../lib/supabase'

export const enrollmentsRouter = Router()

// GET /classes/:classId/enrollments?status=enrolled
enrollmentsRouter.get('/classes/:classId/enrollments', async (req: Request, res: Response, next: NextFunction) => {
  try {
    let query = supabase
      .from('class_enrollments')
      .select('*')
      .eq('class_id', req.params.classId)
      .order('created_at', { ascending: false })

    if (req.query.status) {
      query = query.eq('status', req.query.status as string)
    }

    const { data, error } = await query
    if (error) throw error
    res.json(data)
  } catch (err) {
    next(err)
  }
})

// POST /classes/:classId/enrollments
enrollmentsRouter.post('/classes/:classId/enrollments', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { student_name, student_email, status, group_label } = req.body
    const { data, error } = await supabase
      .from('class_enrollments')
      .insert({
        class_id: req.params.classId,
        student_name,
        student_email,
        status,
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

// PUT /classes/:classId/enrollments/:id  — classId in path prevents cross-class modification (IDOR)
enrollmentsRouter.put('/classes/:classId/enrollments/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { status, group_label } = req.body
    const { data, error } = await supabase
      .from('class_enrollments')
      .update({ status, group_label: group_label ?? null })
      .eq('id', req.params.id)
      .eq('class_id', req.params.classId)
      .select()
      .single()
    if (error) {
      if (error.code === 'PGRST116') {
        res.status(404).json({ error: 'Enrollment not found' })
        return
      }
      throw error
    }
    res.json(data)
  } catch (err) {
    next(err)
  }
})

// DELETE /classes/:classId/enrollments/:id  — classId in path prevents cross-class deletion (IDOR)
enrollmentsRouter.delete('/classes/:classId/enrollments/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { data: existing, error: fetchError } = await supabase
      .from('class_enrollments')
      .select('id')
      .eq('id', req.params.id)
      .eq('class_id', req.params.classId)
      .single()
    if (fetchError || !existing) {
      res.status(404).json({ error: 'Enrollment not found' })
      return
    }
    const { error } = await supabase.from('class_enrollments').delete().eq('id', req.params.id)
    if (error) throw error
    res.status(204).send()
  } catch (err) {
    next(err)
  }
})
