'use client'

import { useEffect, useRef } from 'react'
import { usePathname } from 'next/navigation'

export function RouteAnnouncer() {
  const pathname = usePathname()
  const hasMounted = useRef(false)
  const announcementRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!hasMounted.current) {
      hasMounted.current = true
      return
    }

    const title = document.title
    if (announcementRef.current) {
      announcementRef.current.textContent = title
    }

    const timer = setTimeout(() => {
      document.getElementById('main-content')?.focus()
    }, 100)

    return () => clearTimeout(timer)
  }, [pathname])

  return (
    <div
      ref={announcementRef}
      aria-live="polite"
      aria-atomic="true"
      className="sr-only"
    />
  )
}
