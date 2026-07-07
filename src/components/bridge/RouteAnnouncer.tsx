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

    const raf = requestAnimationFrame(() => {
      if (announcementRef.current) {
        announcementRef.current.textContent = document.title
      }
    })

    const timer = setTimeout(() => {
      // Don't steal focus from an open dialog/sheet -- it owns its own focus
      // per WAI-ARIA APG, and on iOS Safari a focus() call this far outside
      // the original user gesture can't reopen the soft keyboard once this
      // steal blurs an autofocused input, even after refocusing it back.
      // Also skip if something other than <body> already holds focus -- e.g.
      // a modal close deliberately restoring focus to its trigger element --
      // since this timer only exists to give screen readers *some* landmark
      // when a route change would otherwise leave focus on nothing (body).
      const active = document.activeElement
      const insideDialog = !!active?.closest('[role="dialog"]')
      if (insideDialog || (active && active !== document.body)) return
      document.getElementById('main-content')?.focus()
    }, 100)

    return () => {
      cancelAnimationFrame(raf)
      clearTimeout(timer)
    }
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
