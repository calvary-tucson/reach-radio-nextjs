'use client'

import { useRef } from 'react'
import { X } from 'lucide-react'
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
  const paused = useMediaStore((s) => s.sleepTimerPaused)
  const remainingSeconds = useMediaStore((s) => s.remainingSleepSeconds)
  const startSleepTimer = useMediaStore((s) => s.startSleepTimer)
  const pauseSleepTimer = useMediaStore((s) => s.pauseSleepTimer)
  const resumeSleepTimer = useMediaStore((s) => s.resumeSleepTimer)
  const cancelSleepTimer = useMediaStore((s) => s.cancelSleepTimer)

  function start(mins: number) {
    startSleepTimer(mins * 60)
    sheetRef.current?.close()
  }

  function cancel() {
    cancelSleepTimer()
    sheetRef.current?.close()
  }

  const minutes = Math.floor(remainingSeconds / 60)
  const secs = remainingSeconds % 60

  return (
    <BottomSheet ref={sheetRef} open={open} onClose={onClose} ariaLabel="Sleep timer">
      <div className="flex items-center justify-between px-6 pb-4">
        <h2 className="text-white light:text-gray-900 text-xl font-bold select-none">
          Sleep Timer
        </h2>
        <button
          type="button"
          onClick={() => sheetRef.current?.close()}
          className="-mr-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-white/60 light:text-gray-500 motion-safe:transition-colors hover:bg-white/10 light:hover:bg-gray-100 hover:text-white light:hover:text-gray-900 cursor-pointer focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          aria-label="Close sleep timer"
        >
          <X className="h-5 w-5" aria-hidden="true" />
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
            <p className="text-white/70 light:text-gray-500 text-sm mb-8" aria-hidden="true">
              {paused ? 'Timer paused' : `Radio stops in ${minutes}m ${secs}s`}
            </p>
            <div className="flex flex-col gap-3">
              <button
                type="button"
                onClick={paused ? resumeSleepTimer : pauseSleepTimer}
                className="w-full bg-white/5 border border-white/10 text-white light:text-gray-900 py-4 rounded-xl font-semibold text-lg hover:bg-white/10 motion-safe:transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none cursor-pointer"
              >
                {paused ? 'Resume' : 'Pause'}
              </button>
              <button
                type="button"
                onClick={cancel}
                className="w-full bg-white/5 border border-red-500/30 text-red-400 py-4 rounded-xl font-semibold text-lg hover:bg-red-500/10 motion-safe:transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none cursor-pointer"
              >
                Cancel Timer
              </button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-3">
            {TIMER_OPTIONS.map((mins) => (
              <button
                type="button"
                key={mins}
                onClick={() => start(mins)}
                className="bg-white/5 border border-white/10 text-white light:text-gray-900 py-5 rounded-xl font-semibold text-lg hover:bg-white/10 motion-safe:transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none cursor-pointer"
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
