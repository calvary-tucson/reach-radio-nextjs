'use client'

import { useEffect, useRef } from 'react'
import { useMediaStore } from '@/lib/store/media-store'
import { postMessageToNative } from '@/lib/bridge/post-message'

export function SleepTimerProvider() {
  const sleepTimerActive = useMediaStore((s) => s.sleepTimerActive)
  const sleepTimerPaused = useMediaStore((s) => s.sleepTimerPaused)
  const sleepTimerEndsAt = useMediaStore((s) => s.sleepTimerEndsAt)
  const setIsPlaying = useMediaStore((s) => s.setIsPlaying)
  const setSleepTimerActive = useMediaStore((s) => s.setSleepTimerActive)
  const setRemainingSleepSeconds = useMediaStore((s) => s.setRemainingSleepSeconds)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (!sleepTimerActive || sleepTimerPaused) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
      return
    }
    intervalRef.current = setInterval(() => {
      if (!useMediaStore.getState().sleepTimerActive) return
      const { sleepTimerEndsAt: endTime } = useMediaStore.getState()
      if (!endTime) return
      const remainingMs = endTime - Date.now()
      if (remainingMs <= 0) {
        setRemainingSleepSeconds(0)
        setIsPlaying(false)
        setSleepTimerActive(false)
        postMessageToNative({ isPlaying: false })
      } else {
        setRemainingSleepSeconds(Math.ceil(remainingMs / 1000))
      }
    }, 500)
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- Zustand actions (setIsPlaying, setSleepTimerActive, setRemainingSleepSeconds) are stable; adding them would cause unnecessary effect re-runs
  }, [sleepTimerActive, sleepTimerPaused])

  // Push structural state changes to native — not per-tick.
  // remainingSleepSeconds is read via getState() because we only want to push
  // on structural changes (start/pause/resume/cancel), not on every countdown tick.
  useEffect(() => {
    const { remainingSleepSeconds } = useMediaStore.getState()
    postMessageToNative({
      sleepTimer: {
        active: sleepTimerActive,
        paused: sleepTimerPaused,
        remainingSeconds: remainingSleepSeconds,
        endsAt: sleepTimerEndsAt ? new Date(sleepTimerEndsAt).toISOString() : null,
      },
    })
  }, [sleepTimerActive, sleepTimerPaused, sleepTimerEndsAt])

  return null
}
