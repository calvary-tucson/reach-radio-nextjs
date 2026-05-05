'use client'

import { useMediaStore } from '@/lib/store/media-store'

export function SleepTimerOverlay() {
  const active = useMediaStore((s) => s.sleepTimerActive)
  const seconds = useMediaStore((s) => s.remainingSleepSeconds)

  if (!active) return null

  const minutes = Math.floor(seconds / 60)
  const secs = seconds % 60

  return (
    <div className="absolute inset-0 z-10 bg-black/80 rounded flex flex-col items-center justify-center gap-4">
      <p className="text-white text-4xl font-mono">
        {String(minutes).padStart(2, '0')}:{String(secs).padStart(2, '0')}
      </p>
    </div>
  )
}
