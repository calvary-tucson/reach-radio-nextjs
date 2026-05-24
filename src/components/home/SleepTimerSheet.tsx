'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useMediaStore } from '@/lib/store/media-store'
import { useSheetDrag } from '@/lib/hooks/useSheetDrag'

const TIMER_OPTIONS = [5, 10, 15, 30, 45, 60]

interface SleepTimerSheetProps {
  open: boolean
  onClose: () => void
}

export function SleepTimerSheet({ open, onClose }: SleepTimerSheetProps) {
  const [visible, setVisible] = useState(false)
  const sheetRef = useRef<HTMLDivElement>(null)
  const firstBtnRef = useRef<HTMLButtonElement>(null)

  const active = useMediaStore((s) => s.sleepTimerActive)
  const remainingSeconds = useMediaStore((s) => s.remainingSleepSeconds)
  const startSleepTimer = useMediaStore((s) => s.startSleepTimer)
  const setSleepTimerActive = useMediaStore((s) => s.setSleepTimerActive)
  const setRemainingSleepSeconds = useMediaStore((s) => s.setRemainingSleepSeconds)

  const handleClose = useCallback(() => {
    setVisible(false)
    setTimeout(onClose, 280)
  }, [onClose])

  const drag = useSheetDrag({ onDismiss: handleClose, contentRef: sheetRef })

  useEffect(() => {
    if (!open) return
    const id = requestAnimationFrame(() => {
      setVisible(true)
      firstBtnRef.current?.focus()
    })
    return () => cancelAnimationFrame(id)
  }, [open])

  useEffect(() => {
    if (!open) return
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') handleClose()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [open, handleClose])

  if (!open) return null

  const minutes = Math.floor(remainingSeconds / 60)
  const secs = remainingSeconds % 60

  function start(mins: number) {
    startSleepTimer(mins * 60)
    handleClose()
  }

  function cancel() {
    setSleepTimerActive(false)
    setRemainingSleepSeconds(0)
    handleClose()
  }

  return createPortal(
    <div role="dialog" aria-modal="true" aria-label="Sleep timer">
      <div
        data-testid="sheet-backdrop"
        className={`fixed inset-0 z-50 bg-black/60 transition-opacity duration-300 ${visible ? 'opacity-100' : 'opacity-0'}`}
        onClick={handleClose}
        aria-hidden="true"
      />
      <div
        ref={sheetRef}
        className={`fixed inset-x-0 bottom-0 z-50 bg-gray-800 rounded-t-2xl transition-transform duration-[280ms] ease-out ${visible ? 'translate-y-0' : 'translate-y-full'}`}
      >
        <div
          className="flex justify-center pt-3 pb-2 cursor-grab active:cursor-grabbing touch-none"
          onTouchStart={drag.onTouchStart}
          onTouchMove={drag.onTouchMove}
          onTouchEnd={drag.onTouchEnd}
        >
          <div className="h-1 w-10 rounded-full bg-white/30" />
        </div>
        <div className="px-6 pb-10 pt-2">
          <h2 className="text-white text-xl font-bold text-center mb-6">Sleep Timer</h2>
          {active ? (
            <div className="text-center">
              <p
                className="text-white text-5xl font-mono mb-2"
                aria-live="polite"
                aria-atomic="true"
              >
                {String(minutes).padStart(2, '0')}:{String(secs).padStart(2, '0')}
              </p>
              <p className="text-white/60 text-sm mb-8">
                Radio stops in {minutes}m {secs}s
              </p>
              <button
                ref={firstBtnRef}
                onClick={cancel}
                className="w-full bg-red-600 text-white py-4 rounded-xl font-semibold text-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-white"
              >
                Cancel Timer
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-3">
              {TIMER_OPTIONS.map((mins, i) => (
                <button
                  key={mins}
                  ref={i === 0 ? firstBtnRef : undefined}
                  onClick={() => start(mins)}
                  className="bg-gray-700 text-white py-5 rounded-xl font-semibold text-lg hover:bg-gray-600 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-white"
                >
                  {mins}m
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  )
}
