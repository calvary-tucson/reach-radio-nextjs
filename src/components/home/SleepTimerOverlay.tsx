'use client'

import { useEffect, useRef } from 'react'
import { useMediaStore } from '@/lib/store/media-store'

export function SleepTimerOverlay() {
  const active = useMediaStore((s) => s.sleepTimerActive)
  const seconds = useMediaStore((s) => s.remainingSleepSeconds)
  const setSleepTimerActive = useMediaStore((s) => s.setSleepTimerActive)
  const setRemainingSleepSeconds = useMediaStore((s) => s.setRemainingSleepSeconds)
  const cancelBtnRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (active) cancelBtnRef.current?.focus()
  }, [active])

  useEffect(() => {
    if (!active) return
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setSleepTimerActive(false)
        setRemainingSleepSeconds(0)
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [active, setSleepTimerActive, setRemainingSleepSeconds])

  if (!active) return null

  const minutes = Math.floor(seconds / 60)
  const secs = seconds % 60

  function cancel() {
    setSleepTimerActive(false)
    setRemainingSleepSeconds(0)
  }

  return (
    <div
      role="dialog"
      aria-label="Sleep timer active"
      className="absolute inset-0 z-10 bg-black/80 rounded flex flex-col items-center justify-center gap-4"
    >
      <p
        className="text-white text-4xl font-mono"
        aria-live="polite"
        aria-atomic="true"
      >
        {String(minutes).padStart(2, '0')}:{String(secs).padStart(2, '0')}
      </p>
      <button
        ref={cancelBtnRef}
        onClick={cancel}
        aria-label="Cancel sleep timer"
        className="bg-white/20 text-white px-4 py-2 rounded text-sm hover:bg-white/30 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white cursor-pointer"
      >
        Cancel
      </button>
    </div>
  )
}
