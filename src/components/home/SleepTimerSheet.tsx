'use client'

import { useRef } from 'react'
import { BottomSheet, type BottomSheetHandle } from '@/components/global/BottomSheet'
import { useMediaStore } from '@/lib/store/media-store'

const TIMER_OPTIONS = [5, 10, 15, 30, 45, 60]

interface SleepTimerSheetProps {
  open: boolean
  onClose: () => void
}

export function SleepTimerSheet({ open, onClose }: SleepTimerSheetProps) {
  const sheetRef = useRef<BottomSheetHandle>(null)
  const active = useMediaStore((s) => s.sleepTimerActive)
  const remainingSeconds = useMediaStore((s) => s.remainingSleepSeconds)
  const startSleepTimer = useMediaStore((s) => s.startSleepTimer)
  const setSleepTimerActive = useMediaStore((s) => s.setSleepTimerActive)
  const setRemainingSleepSeconds = useMediaStore((s) => s.setRemainingSleepSeconds)

  function start(mins: number) {
    startSleepTimer(mins * 60)
    sheetRef.current?.close()
  }

  function cancel() {
    setSleepTimerActive(false)
    setRemainingSleepSeconds(0)
    sheetRef.current?.close()
  }

  const minutes = Math.floor(remainingSeconds / 60)
  const secs = remainingSeconds % 60

  return (
    <BottomSheet ref={sheetRef} open={open} onClose={onClose} ariaLabel="Sleep timer">
      <div className="flex items-center justify-between px-6 pb-4">
        <h2 id="sleep-timer-heading" className="text-white light:text-gray-900 text-xl font-bold select-none">
          Sleep Timer
        </h2>
        <button
          type="button"
          onClick={() => sheetRef.current?.close()}
          className="-mr-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-white/60 light:text-gray-500 transition-colors hover:bg-white/10 light:hover:bg-gray-100 hover:text-white light:hover:text-gray-900 cursor-pointer"
          aria-label="Close sleep timer"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>
      <div className="px-6 pb-10">
        <p
          className="sr-only"
          aria-live="polite"
          aria-atomic="true"
        >
          {active ? `Radio stops in ${minutes}m ${secs}s` : ''}
        </p>
        {active ? (
          <div className="text-center">
            <p className="text-white light:text-gray-900 text-5xl font-mono mb-2" aria-hidden="true">
              {String(minutes).padStart(2, '0')}:{String(secs).padStart(2, '0')}
            </p>
            <p className="text-white/60 light:text-gray-500 text-sm mb-8" aria-hidden="true">
              Radio stops in {minutes}m {secs}s
            </p>
            <button
              type="button"
              onClick={cancel}
              className="w-full bg-red-600 text-white py-4 rounded-xl font-semibold text-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-white cursor-pointer"
            >
              Cancel Timer
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-3">
            {TIMER_OPTIONS.map((mins) => (
              <button
                type="button"
                key={mins}
                onClick={() => start(mins)}
                className="bg-gray-700 light:bg-gray-200 text-white light:text-gray-900 py-5 rounded-xl font-semibold text-lg hover:bg-gray-600 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-white cursor-pointer"
              >
                {mins}m
              </button>
            ))}
          </div>
        )}
      </div>
    </BottomSheet>
  )
}
