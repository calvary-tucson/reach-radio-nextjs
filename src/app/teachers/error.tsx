'use client'

export default function TeachersError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div role="alert" className="px-4 py-12 text-center">
      <p className="text-white/80 light:text-gray-700 mb-3">Unable to load teachers. Please try again.</p>
      {error.digest && (
        <p className="text-xs text-white/40 light:text-gray-400 mb-3 font-mono">{error.digest}</p>
      )}
      <button onClick={reset} className="text-sm text-white light:text-gray-900 underline cursor-pointer">
        Retry
      </button>
    </div>
  )
}
