'use client'

import { X } from 'lucide-react'
import { useEffect, useId, useRef } from 'react'
import { useModal } from '@/components/modals/ModalContext'
import { useSheetDrag } from '@/lib/hooks/useSheetDrag'
import { useFocusTrap } from '@/lib/hooks/useFocusTrap'
import { DragHandle } from '@/components/global/DragHandle'
import { MODAL_ENTER_ANIMATION, MODAL_EXIT_ANIMATION } from '@/lib/constants/modal'
import { cn } from '@/lib/utils'

interface SheetChromeProps {
  children: React.ReactNode
  title?: string
  /** Wrap children in p-6 padding. Default true. */
  padded?: boolean
  /** Focus the first input inside the sheet instead of the dialog container. */
  autoFocusInput?: boolean
  className?: string
}

export function SheetChrome({ children, title, padded = true, autoFocusInput = false, className }: SheetChromeProps) {
  const { onDismiss, isClosing } = useModal()
  const contentRef = useRef<HTMLDivElement>(null)
  const drag = useSheetDrag({ onDismiss, contentRef })
  const titleId = useId()

  // Focus into panel on mount so VoiceOver enters dialog mode.
  // When autoFocusInput is true, focus the first input instead of the container.
  // Delay 250ms: iOS blocks programmatic focus() outside a user gesture callstack;
  // waiting past the 200ms enter animation gives WKWebView enough slack to allow it.
  useEffect(() => {
    const timer = setTimeout(() => {
      if (autoFocusInput) {
        const input = contentRef.current?.querySelector<HTMLElement>('input, textarea')
        ;(input ?? contentRef.current)?.focus()
      } else {
        contentRef.current?.focus()
      }
    }, 250)
    return () => clearTimeout(timer)
  }, [autoFocusInput])

  useFocusTrap(contentRef)

  return (
    <div
      role="presentation"
      className="fixed inset-0 flex items-end sm:items-center sm:justify-center cursor-pointer"
      onClick={(e) => { if (e.target === e.currentTarget) onDismiss() }}
    >
      <div
        ref={contentRef}
        role="dialog"
        aria-modal="true"
        tabIndex={-1}
        {...(title ? { 'aria-labelledby': titleId } : { 'aria-label': 'Dialog' })}
        className={cn(
          'w-full max-h-[90dvh] overflow-hidden flex flex-col border border-white/10 light:border-gray-200 bg-gray-800 light:bg-white p-0',
          'rounded-t-2xl rounded-b-none h-[85dvh] will-change-transform',
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
            className="ml-auto -mr-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-white/75 light:text-gray-500 motion-safe:transition-colors hover:bg-white/10 light:hover:bg-gray-100 hover:text-white light:hover:text-gray-900 cursor-pointer focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            aria-label="Close"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto">
          {padded ? <div className="p-6">{children}</div> : children}
        </div>
      </div>
    </div>
  )
}
