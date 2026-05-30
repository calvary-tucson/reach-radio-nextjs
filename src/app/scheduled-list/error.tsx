'use client'

export default function ScheduleError({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="px-4 py-12 text-center">
      <p className="text-white/80 mb-3">Unable to load schedule. Please try again.</p>
      <button onClick={reset} className="text-sm text-white/60 underline cursor-pointer">
        Retry
      </button>
    </div>
  )
}
