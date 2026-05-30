'use client'

export default function TeacherError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div role="alert" className="px-4 py-12 text-center">
      <p className="text-white/80 mb-3">Unable to load teacher. Please try again.</p>
      {error.digest && (
        <p className="text-xs text-white/40 light:text-gray-400 mb-3 font-mono">{error.digest}</p>
      )}
      <button onClick={reset} className="text-sm text-white underline cursor-pointer">
        Retry
      </button>
    </div>
  )
}
