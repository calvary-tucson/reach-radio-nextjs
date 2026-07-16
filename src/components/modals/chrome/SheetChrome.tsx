'use client'

import { X } from 'lucide-react'
import { useEffect, useId, useRef } from 'react'
import { useModal } from '@/components/modals/ModalContext'
import { useSheetDrag } from '@/lib/hooks/useSheetDrag'
import { useFocusTrap } from '@/lib/hooks/useFocusTrap'
import { useVisualViewportOffset } from '@/lib/hooks/useVisualViewportOffset'
import { DragHandle } from '@/components/global/DragHandle'
import { ENTER_DURATION, MODAL_ENTER_ANIMATION, MODAL_EXIT_ANIMATION } from '@/lib/constants/modal'
import { cn, focusWithoutScroll } from '@/lib/utils'

// Dev-only defense in depth: React StrictMode's mount/cleanup/remount
// double-invoke races Radix FocusScope's cleanup, which can restore focus to
// whatever was focused before the sheet opened (the trigger element). Radix's
// own FocusScope has focus-trap-restore logic for exactly this, but it never
// captures our input as lastFocusedElementRef: its 'focusin' listener (a
// parent effect) attaches AFTER our synchronous focus call (a child effect
// fires first), so it misses the one event it needed to record.
// (Our own RouteAnnouncer component used to be a second, production-hitting
// focus thief here -- fixed at the source in
// src/components/bridge/RouteAnnouncer.tsx instead of reacting to it, since
// reclaiming focus after an iOS blur can't reopen the soft keyboard even
// when it successfully restores document.activeElement.)
function guardFocus(input: HTMLElement, container: HTMLElement | null) {
  function onFocusIn() {
    const active = document.activeElement
    if (active === input) return
    if (!container || !container.contains(active)) {
      focusWithoutScroll(input)
    }
  }
  document.addEventListener('focusin', onFocusIn)
  const stopTimer = setTimeout(() => {
    document.removeEventListener('focusin', onFocusIn)
  }, 3000)
  return () => {
    document.removeEventListener('focusin', onFocusIn)
    clearTimeout(stopTimer)
  }
}

// Excludes honeypot inputs (tabindex="-1", aria-hidden="true") and hidden
// fields (type="hidden") so autofocus lands on the first real, visible field
// instead of an off-screen spam trap or a hidden metadata input.
const FOCUSABLE_INPUT_SELECTOR = 'input:not([type="hidden"]):not([tabindex="-1"]):not([aria-hidden="true"]), textarea:not([tabindex="-1"]):not([aria-hidden="true"])'

interface SheetChromeProps {
  children: React.ReactNode
  title?: string
  /** Accessible label when no visible title is rendered. */
  ariaLabel?: string
  /** Wrap children in p-6 padding. Default true. */
  padded?: boolean
  /** Focus the first input inside the sheet instead of the dialog container. */
  autoFocusInput?: boolean
  className?: string
}

export function SheetChrome({ children, title, ariaLabel, padded = true, autoFocusInput = false, className }: SheetChromeProps) {
  const { onDismiss, isClosing } = useModal()
  const contentRef = useRef<HTMLDivElement>(null)
  const drag = useSheetDrag({ onDismiss, contentRef })
  const titleId = useId()
  const viewport = useVisualViewportOffset()
  const unguardRef = useRef<(() => void) | null>(null)

  // iOS Safari fires a trailing synthetic click from the gesture that opened
  // this sheet, at the original tap's screen coordinates -- which can still
  // land on the backdrop while the enter animation hasn't yet covered that
  // position. Ignore backdrop dismissal until the entrance animation finishes.
  const justMountedRef = useRef(true)

  useEffect(() => {
    const timer = setTimeout(() => { justMountedRef.current = false }, ENTER_DURATION + 50)
    return () => clearTimeout(timer)
  }, [])

  // Focus into panel on mount so VoiceOver enters dialog mode.
  // When autoFocusInput is true, focus the first input/textarea via MutationObserver
  // so focus fires as soon as the element enters the DOM (handles Suspense boundaries).
  // Otherwise focus the dialog container directly after the 250ms enter animation.
  useEffect(() => {
    if (!autoFocusInput) {
      const timer = setTimeout(() => {
        focusWithoutScroll(contentRef.current)
      }, 250)
      return () => clearTimeout(timer)
    }

    let observer: MutationObserver | null = null
    let fallbackTimer: ReturnType<typeof setTimeout> | undefined
    let debounceFrame: number | undefined

    function tryFocus() {
      const input = contentRef.current?.querySelector<HTMLElement>(FOCUSABLE_INPUT_SELECTOR)
      if (input) {
        observer?.disconnect()
        clearTimeout(fallbackTimer)
        focusWithoutScroll(input)
        unguardRef.current = guardFocus(input, contentRef.current)
      }
    }

    // Batch bursts of mutation records (e.g. a Suspense boundary rendering a
    // whole subtree at once) into a single querySelector per frame.
    function scheduleFocusCheck() {
      if (debounceFrame !== undefined) return
      debounceFrame = requestAnimationFrame(() => {
        debounceFrame = undefined
        tryFocus()
      })
    }

    // Input may already be in the DOM (e.g., no Suspense delay)
    const immediate = contentRef.current?.querySelector<HTMLElement>(FOCUSABLE_INPUT_SELECTOR)
    if (immediate) {
      focusWithoutScroll(immediate)
      unguardRef.current = guardFocus(immediate, contentRef.current)
    } else {
      // Watch for input to be inserted by a Suspense boundary resolving
      observer = new MutationObserver(scheduleFocusCheck)
      if (contentRef.current) {
        observer.observe(contentRef.current, { childList: true, subtree: true })
      }
      // Fallback: focus dialog container if no input appears within 2s
      fallbackTimer = setTimeout(() => {
        observer?.disconnect()
        focusWithoutScroll(contentRef.current)
      }, 2000)
    }

    return () => {
      observer?.disconnect()
      clearTimeout(fallbackTimer)
      if (debounceFrame !== undefined) cancelAnimationFrame(debounceFrame)
      unguardRef.current?.()
      unguardRef.current = null
    }
  }, [autoFocusInput])

  // Tear down the focusin guard the instant the sheet starts closing (not
  // when it eventually unmounts) -- otherwise a caller restoring focus to
  // its trigger element during the exit animation (see ModalLayout's
  // handleClose) races this guard's still-attached listener, which sees
  // focus land outside the sheet and forces it back onto the (about to be
  // removed) input, which then drops focus to <body> when the sheet unmounts.
  useEffect(() => {
    if (isClosing) {
      unguardRef.current?.()
      unguardRef.current = null
    }
  }, [isClosing])

  useFocusTrap(contentRef)

  // Scrolling/swiping the sheet's content should dismiss the keyboard,
  // matching native search UX (e.g. Mail, Messages search).
  function handleScrollDismissKeyboard() {
    const active = document.activeElement as HTMLElement | null
    if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA') && contentRef.current?.contains(active)) {
      active.blur()
    }
  }

  return (
    <div
      role="presentation"
      data-sheet-wrapper
      className="fixed inset-x-0 top-0 h-[100dvh] flex items-end sm:items-center sm:justify-center cursor-pointer"
      style={viewport !== null ? { top: viewport } : undefined}
      onClick={(e) => {
        if (justMountedRef.current) return
        if (e.target === e.currentTarget) onDismiss()
      }}
    >
      <div
        ref={contentRef}
        role="dialog"
        aria-modal="true"
        tabIndex={-1}
        {...(title ? { 'aria-labelledby': titleId } : { 'aria-label': ariaLabel ?? 'Dialog' })}
        className={cn(
          'w-full overflow-hidden flex flex-col border border-white/10 light:border-gray-200 bg-gray-800 light:bg-white p-0',
          'rounded-t-2xl rounded-b-none h-[100dvh]',
          isClosing ? MODAL_EXIT_ANIMATION : MODAL_ENTER_ANIMATION,
          'sm:inset-auto sm:h-auto sm:max-h-[90dvh] sm:max-w-2xl sm:w-[95vw] sm:rounded-2xl',
          className
        )}
        style={{
          paddingTop: 'var(--safe-top)',
          paddingBottom: 'var(--safe-bottom)',
        }}
      >
        <DragHandle drag={drag} onDismiss={onDismiss} className="w-full pt-3 pb-2 sm:hidden shrink-0" />
        {/* Header */}
        <div className="shrink-0 flex items-center justify-between border-b border-white/10 light:border-gray-200 bg-gray-800 light:bg-white px-6 py-4">
          {title ? (
            <h2 id={titleId} className="text-xl font-bold text-white light:text-gray-900">{title}</h2>
          ) : (
            <span />
          )}
          <button
            type="button"
            onClick={onDismiss}
            className="ml-auto -mr-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-white/90 light:text-gray-500 motion-safe:transition-colors hover:bg-white/10 light:hover:bg-gray-100 hover:text-white light:hover:text-gray-900 cursor-pointer focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            aria-label="Close"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>
        <div
          data-sheet-scroll
          className="flex-1 overflow-y-auto pb-[env(keyboard-inset-height,0px)]"
          onScroll={handleScrollDismissKeyboard}
        >
          {padded ? <div className="p-6">{children}</div> : children}
        </div>
      </div>
    </div>
  )
}
