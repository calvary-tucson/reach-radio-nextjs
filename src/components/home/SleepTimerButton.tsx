import Link from 'next/link'

export function SleepTimerButton() {
  return (
    <Link
      href="/sleep-timer"
      aria-label="Sleep Timer"
      className="bg-gray-500 rounded-full p-1 w-9 h-9 flex items-center justify-center"
    >
      <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="10" />
        <polyline points="12 6 12 12 16 14" />
      </svg>
    </Link>
  )
}
