'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'

interface BackButtonProps {
  /** "mobile" = fixed green circle (hidden on md+), "desktop" = inline glass pill (hidden below md) */
  variant: 'mobile' | 'desktop'
  className?: string
}

export function BackButton({ variant, className }: BackButtonProps) {
  const router = useRouter()
  const [isApp, setIsApp] = useState(false)

  useEffect(() => {
    setIsApp(document.documentElement.classList.contains('native-app'))
  }, [])

  function handleBack() {
    router.back()
  }

  if (variant === 'mobile') {
    return (
      <button
        type="button"
        onClick={handleBack}
        aria-label="Go back"
        className={cn(
          'fixed left-3 z-40 flex h-11 w-11 items-center justify-center rounded-full bg-green-700 p-2 pr-2.5 md:hidden cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-400 focus-visible:ring-offset-2 focus-visible:ring-offset-black',
          isApp ? 'top-4' : 'top-[72px]',
          className,
        )}
      >
        <svg className="h-7 w-7 fill-white" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z" />
        </svg>
      </button>
    )
  }

  return (
    <button
      type="button"
      onClick={handleBack}
      aria-label="Go back"
      className={cn(
        'hidden h-11 w-11 items-center justify-center rounded-full bg-white/50 text-gray-900 light:bg-gray-200 light:text-gray-900 transition-all duration-300 hover:bg-white/65 light:hover:bg-gray-300 md:flex cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-400 focus-visible:ring-offset-2 focus-visible:ring-offset-black',
        className,
      )}
    >
      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
      </svg>
    </button>
  )
}
