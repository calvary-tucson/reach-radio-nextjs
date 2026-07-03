'use client'

import { useEffect, useRef } from 'react'
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
  const inputRef = useRef<HTMLInputElement>(null)
  const router = useRouter()
  const openModal = useModalStore((s) => s.openModal)
  const setTriggerRef = useModalStore((s) => s.setTriggerRef)
  const resetNav = useNavigationStore((s) => s.reset)

  // Prefetch the search-sheet route so its RSC payload is cached before tap —
  // without this, tapping incurs a network round-trip before the real input
  // mounts, well outside iOS's synchronous-focus window for showing the keyboard.
  useEffect(() => {
    router.prefetch(href)
  }, [router, href])

  // Navigating on the anchor's own click (bubbled from the input) is unreliable on iOS:
  // focusing the input from pointerdown to open the keyboard can suppress the
  // follow-up click entirely. Navigate imperatively from the same pointerdown instead.
  function navigate() {
    inputRef.current?.focus()
    console.log('[focus-debug] proxy focus() called, activeElement:', document.activeElement, 'is proxy:', document.activeElement === inputRef.current)
    setTriggerRef(inputRef.current)
    resetNav()
    const store = useModalStore.getState()
    if (store.isOpen) {
      store.pushModal(modalTitle ?? placeholder)
    } else {
      openModal(modalTitle ?? placeholder)
    }
    console.log('[focus-debug] calling router.push', href)
    router.push(href)
  }

  return (
    <a
      href={href}
      tabIndex={-1}
      onClick={(e) => e.preventDefault()}
      className={cn(
        'flex min-h-[44px] w-full items-center gap-3 rounded-xl border border-white/10 light:border-gray-300 bg-white/5 light:bg-gray-50 px-4 py-3 motion-safe:transition-colors hover:bg-white/10 light:hover:bg-gray-100 cursor-pointer',
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
      {/*
        Real input, not decorative text: focusing it on pointerdown (inside the
        gesture that also navigates) is what lets iOS open the keyboard here and
        keep it open when SheetChrome hands focus to the real search input once
        the sheet mounts. A readOnly or non-input proxy won't trigger the keyboard.
      */}
      <input
        ref={inputRef}
        type="search"
        inputMode="search"
        placeholder={placeholder}
        aria-label={ariaLabel ?? placeholder}
        onPointerDown={navigate}
        onChange={(e) => { e.target.value = '' }}
        className="flex-1 min-w-0 bg-transparent text-white/40 light:text-gray-500 placeholder:text-white/40 light:placeholder:text-gray-500 outline-none cursor-pointer rounded focus-visible:ring-2 focus-visible:ring-ring"
      />
    </a>
  )
}
