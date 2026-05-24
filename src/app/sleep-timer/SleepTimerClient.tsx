'use client'

import { useMediaStore } from '@/lib/store/media-store'

const TIMER_OPTIONS = [5, 10, 15, 30, 45, 60]

export default function SleepTimerPage() {
  const active = useMediaStore((s) => s.sleepTimerActive)
  const remainingSeconds = useMediaStore((s) => s.remainingSleepSeconds)
  const startSleepTimer = useMediaStore((s) => s.startSleepTimer)
  const setSleepTimerActive = useMediaStore((s) => s.setSleepTimerActive)
  const setRemainingSleepSeconds = useMediaStore((s) => s.setRemainingSleepSeconds)

  function start(minutes: number) {
    startSleepTimer(minutes * 60)
  }

  function cancel() {
    setSleepTimerActive(false)
    setRemainingSleepSeconds(0)
  }

  const minutes = Math.floor(remainingSeconds / 60)
  const seconds = remainingSeconds % 60

  return (
    <div className="px-4 py-6 max-w-sm mx-auto text-center">
      <h1 className="text-white text-2xl font-bold mb-6">Sleep Timer</h1>

      {active ? (
        <div>
          <p
            className="text-white text-4xl font-mono mb-4"
            aria-live="polite"
            aria-atomic="true"
          >
            {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
          </p>
          <p className="text-white/60 text-sm mb-6">Radio will stop in {minutes}m {seconds}s</p>
          <button
            onClick={cancel}
            className="bg-red-600 text-white px-6 py-2 rounded font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-white cursor-pointer"
          >
            Cancel Timer
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-3">
          {TIMER_OPTIONS.map((mins) => (
            <button
              key={mins}
              onClick={() => start(mins)}
              className="bg-gray-700/50 text-white py-4 rounded font-medium hover:bg-gray-700/70 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-white cursor-pointer"
            >
              {mins}m
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
