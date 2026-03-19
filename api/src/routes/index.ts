import { Router } from 'express'
import { requireAuth } from '../middleware/auth'
import { classesRouter } from './classes'
import { drillsRouter } from './drills'
import { trainersRouter } from './trainers'
import { enrollmentsRouter } from './enrollments'
import { scheduleRouter } from './schedule'
import { reportsRouter } from './reports'
import { hoursRouter } from './hours'
import { profilesRouter } from './profiles'

export const router = Router()

router.use(requireAuth as Router)
router.use(classesRouter)
router.use(drillsRouter)
router.use(trainersRouter)
router.use(enrollmentsRouter)
router.use(scheduleRouter)
router.use(reportsRouter)
router.use(hoursRouter)
router.use(profilesRouter)
