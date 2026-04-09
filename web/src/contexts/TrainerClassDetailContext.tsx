import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react'
import { api } from '../lib/apiClient'
import type {
  ClassEnrollment,
  ClassScheduleSlot,
  ClassDailyReport,
  ClassLoggedHours,
  ClassDrill,
  ClassTrainer,
  TrainerClassDetailResponse,
} from '../types'

interface TrainerClassDetailContextValue {
  classId: string
  classInfo: TrainerClassDetailResponse | null
  enrollments: ClassEnrollment[]
  schedule: ClassScheduleSlot[]
  reports: ClassDailyReport[]
  trainers: ClassTrainer[]
  trainerHours: ClassLoggedHours[]
  studentHours: ClassLoggedHours[]
  drills: ClassDrill[]
  loading: boolean
  refreshReports: () => Promise<void>
  refreshHours: () => Promise<void>
  refreshDrills: () => Promise<void>
  refreshSchedule: () => Promise<void>
  refreshEnrollments: () => Promise<void>
  // Direct state setters for optimistic UI updates
  setReports: React.Dispatch<React.SetStateAction<ClassDailyReport[]>>
  setTrainerHours: React.Dispatch<React.SetStateAction<ClassLoggedHours[]>>
  setStudentHours: React.Dispatch<React.SetStateAction<ClassLoggedHours[]>>
  setDrills: React.Dispatch<React.SetStateAction<ClassDrill[]>>
}

const TrainerClassDetailContext = createContext<TrainerClassDetailContextValue | null>(null)

export function TrainerClassDetailProvider({ classId, children }: { classId: string; children: ReactNode }) {
  const [classInfo, setClassInfo] = useState<TrainerClassDetailResponse | null>(null)
  const [enrollments, setEnrollments] = useState<ClassEnrollment[]>([])
  const [schedule, setSchedule] = useState<ClassScheduleSlot[]>([])
  const [reports, setReports] = useState<ClassDailyReport[]>([])
  const [trainers, setTrainers] = useState<ClassTrainer[]>([])
  const [trainerHours, setTrainerHours] = useState<ClassLoggedHours[]>([])
  const [studentHours, setStudentHours] = useState<ClassLoggedHours[]>([])
  const [drills, setDrills] = useState<ClassDrill[]>([])
  const [loading, setLoading] = useState(true)

  const refreshReports = useCallback(async () => {
    const data = await api.selfService.classReports(classId)
    setReports(data)
  }, [classId])

  const refreshHours = useCallback(async () => {
    const data = await api.selfService.classHours(classId)
    setTrainerHours(data.trainer_hours)
    setStudentHours(data.student_hours)
  }, [classId])

  const refreshDrills = useCallback(async () => {
    const detail = await api.selfService.classDetail(classId)
    setClassInfo(detail)
    setDrills(detail.drills)
    setEnrollments(detail.enrollments)
    setTrainers(detail.trainers ?? [])
  }, [classId])

  const refreshSchedule = useCallback(async () => {
    const data = await api.selfService.classSchedule(classId)
    setSchedule(data)
  }, [classId])

  const refreshEnrollments = useCallback(async () => {
    const detail = await api.selfService.classDetail(classId)
    setClassInfo(detail)
    setEnrollments(detail.enrollments)
    setDrills(detail.drills)
    setTrainers(detail.trainers ?? [])
  }, [classId])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    Promise.all([
      api.selfService.classDetail(classId),
      api.selfService.classSchedule(classId),
      api.selfService.classReports(classId),
      api.selfService.classHours(classId),
    ])
      .then(([detail, sched, reps, hrs]) => {
        if (cancelled) return
        setClassInfo(detail)
        setEnrollments(detail.enrollments)
        setDrills(detail.drills)
        setTrainers(detail.trainers ?? [])
        setSchedule(sched)
        setReports(reps)
        setTrainerHours(hrs.trainer_hours)
        setStudentHours(hrs.student_hours)
      })
      .catch(err => console.error('TrainerClassDetailContext fetch error:', (err as Error).message))
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [classId])

  return (
    <TrainerClassDetailContext.Provider value={{
      classId, classInfo, enrollments, schedule, reports,
      trainers,
      trainerHours, studentHours, drills, loading,
      refreshReports, refreshHours, refreshDrills, refreshSchedule, refreshEnrollments,
      setReports, setTrainerHours, setStudentHours, setDrills,
    }}>
      {children}
    </TrainerClassDetailContext.Provider>
  )
}

export function useTrainerClassDetail() {
  const ctx = useContext(TrainerClassDetailContext)
  if (!ctx) throw new Error('useTrainerClassDetail must be used within TrainerClassDetailProvider')
  return ctx
}
