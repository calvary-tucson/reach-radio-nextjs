'use client'

import { useEffect, useRef } from 'react'
import { useMediaStore } from '@/lib/store/media-store'

export function SleepTimerOverlay() {
  const active = useMediaStore((s) => s.sleepTimerActive)
  const seconds = useMediaStore((s) => s.remainingSleepSeconds)
  const cancelSleepTimer = useMediaStore((s) => s.cancelSleepTimer)
  const cancelBtnRef = useRef<HTMLButtonElement>(null)
  const prevFocusRef = useRef<HTMLElement | null>(null)

  // Save previously focused element, move focus in, restore on close
  useEffect(() => {
    if (active) {
      prevFocusRef.current = document.activeElement as HTMLElement
      cancelBtnRef.current?.focus()
    } else if (prevFocusRef.current) {
      prevFocusRef.current.focus()
      prevFocusRef.current = null
    }
  }, [active])

  useEffect(() => {
    if (!active) return
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        cancelSleepTimer()
      }
      // Focus trap: only one focusable element, keep Tab inside the dialog
      if (e.key === 'Tab') {
        e.preventDefault()
        cancelBtnRef.current?.focus()
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [active, cancelSleepTimer])

  if (!active) return null

  const minutes = Math.floor(seconds / 60)
  const secs = seconds % 60

  function cancel() {
    cancelSleepTimer()
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Sleep timer active"
      className="absolute inset-0 z-20 bg-black/80 rounded flex flex-col items-center justify-center gap-4 motion-safe:animate-in motion-safe:fade-in-0 motion-safe:duration-200"
    >
      <div className="flex flex-col items-center gap-1">
        <p aria-hidden="true" className="text-amber-400 text-xs font-semibold uppercase tracking-wide">
          Sleep Timer
        </p>
        <p
          className="text-white text-4xl font-mono"
          aria-live="polite"
          aria-atomic="true"
          aria-label={`${minutes} minute${minutes !== 1 ? 's' : ''} ${secs} seconds remaining`}
        >
          {String(minutes).padStart(2, '0')}:{String(secs).padStart(2, '0')}
        </p>
      </div>
      <button
        ref={cancelBtnRef}
        onClick={cancel}
        aria-label="Cancel sleep timer"
        className="bg-white/20 text-white px-4 py-3 min-h-[44px] min-w-[88px] rounded text-sm hover:bg-white/30 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white focus-visible:outline-offset-2 cursor-pointer"
      >
        Cancel
      </button>
    </div>
  )
}
