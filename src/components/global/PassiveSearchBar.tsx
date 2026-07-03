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
  // focuses that real input directly, still inside this trusted pointerdown
  // gesture, which is what lets iOS show the keyboard. router.push after is
  // URL/history sync only (shareable link, back button) -- it doesn't gate
  // the sheet's existence or focus.
  function open() {
    resetNav()
    flushSync(() => {
      useModalStore.getState().openSearchSheet(modalTitle ?? placeholder)
    })
    const realInput = document.querySelector<HTMLInputElement>('[data-search-input]')
    realInput?.focus()
    setTriggerRef(realInput)
    router.push(href)
  }

  return (
    <button
      type="button"
      onPointerDown={open}
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
