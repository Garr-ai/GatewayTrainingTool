import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react'
import { api } from '../lib/apiClient'
import { useAuth } from './AuthContext'
import type { TrainerMyClassesResponse } from '../types'

interface TrainerContextValue {
  trainerName: string | null
  trainerEmail: string
  classes: TrainerMyClassesResponse['classes']
  loading: boolean
  refresh: () => Promise<void>
}

const TrainerContext = createContext<TrainerContextValue | null>(null)

export function TrainerProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<TrainerMyClassesResponse | null>(null)
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    try {
      const result = await api.selfService.myClasses()
      setData(result)
    } catch (err) {
      console.error('TrainerContext fetch error:', (err as Error).message)
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    api.selfService.myClasses()
      .then(result => { if (!cancelled) setData(result) })
      .catch(err => console.error('TrainerContext fetch error:', (err as Error).message))
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [])

  return (
    <TrainerContext.Provider value={{
      trainerName: data?.trainer_name ?? null,
      trainerEmail: data?.trainer_email ?? '',
      classes: data?.classes ?? [],
      loading,
      refresh,
    }}>
      {children}
    </TrainerContext.Provider>
  )
}

export function useTrainer() {
  const ctx = useContext(TrainerContext)
  if (!ctx) throw new Error('useTrainer must be used within TrainerProvider')
  return ctx
}

/** Mounts TrainerProvider only when the signed-in user is a trainer. */
export function ConditionalTrainerProvider({ children }: { children: ReactNode }) {
  const { role } = useAuth()
  if (role !== 'trainer') return <>{children}</>
  return <TrainerProvider>{children}</TrainerProvider>
}
