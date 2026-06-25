'use client'

import { useEffect } from 'react'

interface ErrorProps {
  error: Error & { digest?: string }
  reset: () => void
}

export default function RootError({ error, reset }: ErrorProps) {
  useEffect(() => {
    console.error('[RootError]', error)
  }, [error])

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-6 px-4 text-center">
      <h1 className="text-2xl font-bold text-foreground">Something went wrong</h1>
      <p className="text-muted-foreground max-w-sm">
        Reach Radio is temporarily unavailable. Try refreshing the page.
      </p>
      <button
        onClick={reset}
        className="rounded-md bg-primary px-6 py-2 text-sm font-medium text-primary-foreground cursor-pointer focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
      >
        Try again
      </button>
    </div>
  )
}
