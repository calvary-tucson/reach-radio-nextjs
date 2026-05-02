'use client'

import { useState, useEffect, useRef } from 'react'
import { useMediaStore } from '@/lib/store/media-store'

const TIMER_OPTIONS = [15, 30, 45, 60, 90]

export default function SleepTimerPage() {
  const [selectedMinutes, setSelectedMinutes] = useState<number | null>(null)
  const [remainingSeconds, setRemainingSeconds] = useState(0)
  const [active, setActive] = useState(false)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const setIsPlaying = useMediaStore((s) => s.setIsPlaying)

  function start(minutes: number) {
    setSelectedMinutes(minutes)
    setRemainingSeconds(minutes * 60)
    setActive(true)
  }

  function cancel() {
    setActive(false)
    setRemainingSeconds(0)
    setSelectedMinutes(null)
    if (intervalRef.current) clearInterval(intervalRef.current)
  }

  useEffect(() => {
    if (!active) return
    intervalRef.current = setInterval(() => {
      setRemainingSeconds((s) => {
        if (s <= 1) {
          setIsPlaying(false)
          setActive(false)
          return 0
        }
        return s - 1
      })
    }, 1000)
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [active, setIsPlaying])

  const minutes = Math.floor(remainingSeconds / 60)
  const seconds = remainingSeconds % 60

  void selectedMinutes

  return (
    <div className="px-4 py-6 max-w-sm mx-auto text-center">
      <h1 className="text-white text-2xl font-bold mb-6">Sleep Timer</h1>

      {active ? (
        <div>
          <p className="text-white text-4xl font-mono mb-4">
            {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
          </p>
          <p className="text-white/60 text-sm mb-6">Radio will stop in {minutes}m {seconds}s</p>
          <button
            onClick={cancel}
            className="bg-red-600 text-white px-6 py-2 rounded font-medium"
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
              className="bg-gray-700/50 text-white py-4 rounded font-medium hover:bg-gray-700/70 transition-colors"
            >
              {mins}m
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
