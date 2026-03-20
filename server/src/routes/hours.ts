import { Router, type Request, type Response, type NextFunction } from 'express'
import { supabase } from '../lib/supabase'
import { logAudit } from '../lib/audit'

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

    // Validate hours is a non-negative number — important for payroll accuracy
    if (hours === undefined || typeof hours !== 'number' || hours < 0 || hours > 24) {
      res.status(400).json({ error: 'hours must be a number between 0 and 24' })
      return
    }

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

    await logAudit({
      userId: req.userId!,
      action: 'CREATE',
      tableName: 'class_logged_hours',
      recordId: (data as { id: string }).id,
      metadata: { class_id: req.params.classId, hours, paid, person_type },
      ipAddress: req.ip,
    })

    res.status(201).json(data)
  } catch (err) {
    next(err)
  }
})

// PUT /classes/:classId/hours/:id  — classId in path prevents cross-class modification (IDOR)
hoursRouter.put('/classes/:classId/hours/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { log_date, person_type, trainer_id, enrollment_id, hours, paid, live_training, notes } =
      req.body

    // Validate hours is a non-negative number — important for payroll accuracy
    if (hours !== undefined && (typeof hours !== 'number' || hours < 0 || hours > 24)) {
      res.status(400).json({ error: 'hours must be a number between 0 and 24' })
      return
    }

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
      .eq('class_id', req.params.classId)
      .select()
      .single()
    if (error) {
      if (error.code === 'PGRST116') {
        res.status(404).json({ error: 'Hours record not found' })
        return
      }
      throw error
    }

    await logAudit({
      userId: req.userId!,
      action: 'UPDATE',
      tableName: 'class_logged_hours',
      recordId: req.params.id,
      metadata: { class_id: req.params.classId, hours, paid, person_type },
      ipAddress: req.ip,
    })

    res.json(data)
  } catch (err) {
    next(err)
  }
})

// DELETE /classes/:classId/hours/:id  — classId in path prevents cross-class deletion (IDOR)
hoursRouter.delete('/classes/:classId/hours/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { data: existing, error: fetchError } = await supabase
      .from('class_logged_hours')
      .select('id')
      .eq('id', req.params.id)
      .eq('class_id', req.params.classId)
      .single()
    if (fetchError || !existing) {
      res.status(404).json({ error: 'Hours record not found' })
      return
    }

    await logAudit({
      userId: req.userId!,
      action: 'DELETE',
      tableName: 'class_logged_hours',
      recordId: req.params.id,
      metadata: { class_id: req.params.classId },
      ipAddress: req.ip,
    })

    const { error } = await supabase.from('class_logged_hours').delete().eq('id', req.params.id)
    if (error) throw error
    res.status(204).send()
  } catch (err) {
    next(err)
  }
})
