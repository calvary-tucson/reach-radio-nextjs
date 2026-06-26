'use client'

import { useEffect, useRef } from 'react'
import { useMediaStore } from '@/lib/store/media-store'
import { postMessageToNative } from '@/lib/bridge/post-message'

export function SleepTimerProvider() {
  const sleepTimerActive = useMediaStore((s) => s.sleepTimerActive)
  const sleepTimerPaused = useMediaStore((s) => s.sleepTimerPaused)
  const sleepTimerEndsAt = useMediaStore((s) => s.sleepTimerEndsAt)
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
        useMediaStore.getState().cancelSleepTimer()
        useMediaStore.getState().setIsPlaying(false)
        postMessageToNative({ isPlaying: false })
      } else {
        useMediaStore.getState().setRemainingSleepSeconds(Math.ceil(remainingMs / 1000))
      }
    }, 500)
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }
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
