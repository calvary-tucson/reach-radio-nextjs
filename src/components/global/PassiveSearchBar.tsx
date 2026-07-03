'use client'

import { useEffect } from 'react'
import { flushSync } from 'react-dom'
import { useRouter } from 'next/navigation'
import { useModalStore } from '@/lib/stores/modal'
import { useNavigationStore } from '@/lib/stores/navigation-store'
import { cn } from '@/lib/utils'

interface PassiveSearchBarProps {
  href: string
  placeholder?: string
  ariaLabel?: string
  modalTitle?: string
  className?: string
}

export function PassiveSearchBar({
  href,
  placeholder = 'Search...',
  ariaLabel,
  modalTitle,
  className,
}: PassiveSearchBarProps) {
  const router = useRouter()
  const setTriggerRef = useModalStore((s) => s.setTriggerRef)
  const resetNav = useNavigationStore((s) => s.reset)

  // Prefetch for a snappier router.push -- no longer load-bearing for focus
  // (see open() below), but avoids an avoidable network wait before the URL
  // updates.
  useEffect(() => {
    router.prefetch(href)
  }, [router, href])

  // There is exactly one real search input: the one inside the sheet
  // (TeacherSearchBar, marked with data-search-input). This button doesn't
  // proxy a second, throwaway input -- it mounts the sheet SYNCHRONOUSLY via
  // flushSync (forcing React to commit before this handler returns), then
  // focuses that real input directly, still inside this trusted click
  // gesture, which is what lets iOS show the keyboard. router.push after is
  // URL/history sync only (shareable link, back button) -- it doesn't gate
  // the sheet's existence or focus.
  //
  // Uses onClick, not onPointerDown/onTouchStart: those fire the instant a
  // finger touches the button, before the browser knows whether it's a tap
  // or the start of a scroll/swipe -- so swiping past this button (e.g.
  // scrolling the teachers page) would open the sheet. click only fires
  // after a touch ends without an intervening scroll, which is exactly the
  // tap-vs-swipe distinction we want, and it's still a trusted gesture that
  // can synchronously open the iOS keyboard.
  function open() {
    if (process.env.NODE_ENV !== 'production') {
      console.log('[modal-debug][v2-routeannouncer-guard] PassiveSearchBar.open() called')
    }
    resetNav()
    try {
      flushSync(() => {
        useModalStore.getState().openSearchSheet(modalTitle ?? placeholder)
      })
    } catch (err) {
      if (process.env.NODE_ENV !== 'production') {
        console.log('[modal-debug] flushSync(openSearchSheet) threw', err)
      }
      throw err
    }
    const realInput = document.querySelector<HTMLInputElement>('[data-search-input]')
    if (process.env.NODE_ENV !== 'production') {
      console.log('[modal-debug] post-flushSync focus attempt', { found: !!realInput })
    }
    realInput?.focus()
    setTriggerRef(realInput)
    // scroll: false suppresses Next's default post-navigation scroll (and,
    // on older layout-router internals, a domNode.focus() on the newly
    // rendered segment) -- not needed for the search-sheet focus bug itself
    // (that was our own RouteAnnouncer stealing focus, fixed at its source
    // in src/components/bridge/RouteAnnouncer.tsx), but still correct: we
    // don't want any of Next's default scroll/focus management for this
    // soft, modal-driven navigation.
    router.push(href, { scroll: false })

    // TEMP: search-sheet-focus-ios diagnostic logging. Remove once root-caused.
    // Checking activeElement over a few ticks to see if something (e.g. Radix
    // FocusScope's StrictMode-cleanup setTimeout) steals focus back off the
    // input shortly after this synchronous gesture handler returns.
    if (process.env.NODE_ENV !== 'production') {
      const describe = () => {
        const el = document.activeElement
        return {
          tag: el?.tagName,
          isRealInput: el === realInput,
          id: el?.id || undefined,
          windowScrollY: window.scrollY,
          bodyPosition: document.body.style.position,
          htmlPosition: document.documentElement.style.position,
        }
      }
      console.log('[modal-debug] activeElement sync', describe())
      requestAnimationFrame(() => console.log('[modal-debug] activeElement +rAF', describe()))
      setTimeout(() => console.log('[modal-debug] activeElement +0ms', describe()), 0)
      setTimeout(() => console.log('[modal-debug] activeElement +50ms', describe()), 50)
      setTimeout(() => console.log('[modal-debug] activeElement +300ms', describe()), 300)

      // Ground-truth rects: which box is actually the wrong size when the
      // keyboard is open, rather than trusting computed style values.
      // Log plain numbers, not DOMRect objects -- Safari's console prints a
      // bare "DOMRect" placeholder with no values when the log is copied as
      // text, so the actual numbers never survive a paste.
      const flattenRect = (el: Element | null) => {
        if (!el) return null
        const r = el.getBoundingClientRect()
        return { top: r.top, bottom: r.bottom, height: r.height, left: r.left, width: r.width }
      }
      setTimeout(() => {
        console.log('[modal-debug][v2-routeannouncer-guard] rendered rects +500ms', {
          wrapperRect: flattenRect(document.querySelector('[data-sheet-wrapper]')),
          dialogRect: flattenRect(document.querySelector('[role="dialog"]')),
          scrollBoxRect: flattenRect(document.querySelector('[data-sheet-scroll]')),
          docScrollTop: document.documentElement.scrollTop,
          vvHeight: window.visualViewport?.height,
          vvOffsetTop: window.visualViewport?.offsetTop,
          innerHeight: window.innerHeight,
        })
      }, 500)
    }
  }

  return (
    <button
      type="button"
      onClick={open}
      aria-label={ariaLabel ?? placeholder}
      className={cn(
        'flex min-h-[44px] w-full items-center gap-3 rounded-xl border border-white/10 light:border-gray-300 bg-white/5 light:bg-gray-50 px-4 py-3 motion-safe:transition-colors hover:bg-white/10 light:hover:bg-gray-100 cursor-pointer focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
        className
      )}
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="text-white/40 light:text-gray-500 shrink-0"
        aria-hidden="true"
      >
        <circle cx="11" cy="11" r="8" />
        <path d="m21 21-4.35-4.35" />
      </svg>
      <span className="text-white/40 light:text-gray-500">{placeholder}</span>
    </button>
  )
}
