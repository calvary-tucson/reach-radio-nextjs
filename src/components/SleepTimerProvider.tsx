'use client'

import { useEffect, useRef } from 'react'
import { useMediaStore } from '@/lib/store/media-store'

export function SleepTimerProvider() {
  const sleepTimerActive = useMediaStore((s) => s.sleepTimerActive)
  const setIsPlaying = useMediaStore((s) => s.setIsPlaying)
  const setSleepTimerActive = useMediaStore((s) => s.setSleepTimerActive)
  const setRemainingSleepSeconds = useMediaStore((s) => s.setRemainingSleepSeconds)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (!sleepTimerActive) {
      if (intervalRef.current) clearInterval(intervalRef.current)
      return
    }
    intervalRef.current = setInterval(() => {
      const next = useMediaStore.getState().remainingSleepSeconds - 1
      if (next <= 0) {
        setRemainingSleepSeconds(0)
        setIsPlaying(false)
        setSleepTimerActive(false)
      } else {
        setRemainingSleepSeconds(next)
      }
    }, 1000)
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [sleepTimerActive])

  return null
}
