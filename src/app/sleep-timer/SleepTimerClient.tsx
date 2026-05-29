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
      <h1 className="text-[22px] font-extrabold text-white light:text-gray-900 tracking-tight mb-6">Sleep Timer</h1>

      {active ? (
        <div>
          <p
            className="text-white light:text-gray-900 text-4xl font-mono mb-4"
            aria-hidden="true"
          >
            {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
          </p>
          <p className="text-white/60 light:text-gray-500 text-sm mb-6">Radio stops in {minutes}m {seconds}s</p>
          <button
            onClick={cancel}
            className="bg-red-700/80 border border-red-500/40 text-white px-6 py-2 rounded-full font-semibold text-sm hover:bg-red-700 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50 cursor-pointer"
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
              className="bg-white/5 light:bg-gray-50 border border-white/10 light:border-gray-200 text-white light:text-gray-900 py-4 rounded-xl font-medium text-sm hover:bg-white/10 light:hover:bg-gray-100 hover:border-white/20 light:hover:border-gray-300 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50 cursor-pointer"
            >
              {mins}m
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
