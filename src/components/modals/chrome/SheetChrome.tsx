'use client'

import { X } from 'lucide-react'
import { useEffect, useRef } from 'react'
import { useModal } from '@/components/modals/ModalContext'
import { useSheetDrag } from '@/lib/hooks/useSheetDrag'
import { DragHandle } from '@/components/global/DragHandle'
import { MODAL_ENTER_ANIMATION, MODAL_EXIT_ANIMATION } from '@/lib/constants/modal'
import { cn } from '@/lib/utils'

interface SheetChromeProps {
  children: React.ReactNode
  title?: string
  /** Wrap children in p-6 padding. Default true. */
  padded?: boolean
  className?: string
}

export function SheetChrome({ children, title, padded = true, className }: SheetChromeProps) {
  const { onDismiss, isClosing } = useModal()
  const contentRef = useRef<HTMLDivElement>(null)
  const drag = useSheetDrag({ onDismiss, contentRef })

  // Focus into panel on mount so VoiceOver enters dialog mode
  useEffect(() => { contentRef.current?.focus() }, [])

  // Focus trap: constrain Tab/Shift+Tab to focusable children
  useEffect(() => {
    const el = contentRef.current
    if (!el) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return
      const focusable = el.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      )
      if (!focusable.length) { e.preventDefault(); return }
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault(); last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault(); first.focus()
      }
    }
    el.addEventListener('keydown', handleKeyDown)
    return () => el.removeEventListener('keydown', handleKeyDown)
  }, [])

  return (
    <div
      role="presentation"
      className="fixed inset-0 flex items-end sm:items-center sm:justify-center"
      onClick={(e) => { if (e.target === e.currentTarget) onDismiss() }}
      onKeyDown={(e) => { if (e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ')) onDismiss() }}
    >
      <div
        ref={contentRef}
        role="dialog"
        aria-modal="true"
        tabIndex={-1}
        {...(title ? { 'aria-labelledby': 'sheet-chrome-title' } : { 'aria-label': 'Sheet' })}
        className={cn(
          'w-full max-h-[90dvh] overflow-hidden flex flex-col border border-white/10 light:border-gray-200 bg-gray-800 light:bg-white p-0',
          'rounded-t-2xl rounded-b-none h-[85dvh]',
          isClosing ? MODAL_EXIT_ANIMATION : MODAL_ENTER_ANIMATION,
          'sm:inset-auto sm:h-auto sm:max-h-[90dvh] sm:max-w-2xl sm:w-[95vw] sm:rounded-2xl',
          className
        )}
        style={{
          paddingTop: 'env(safe-area-inset-top, 0px)',
          paddingBottom: 'env(safe-area-inset-bottom, 0px)',
        }}
      >
        <DragHandle drag={drag} onDismiss={onDismiss} className="w-full pt-3 pb-2 sm:hidden shrink-0" />
        {/* Header */}
        <div className="shrink-0 flex items-center justify-between border-b border-white/10 light:border-gray-200 bg-gray-800 light:bg-white px-6 py-4">
          {title ? (
            <h2 id="sheet-chrome-title" className="text-xl font-bold text-white light:text-gray-900">{title}</h2>
          ) : (
            <span />
          )}
          <button
            type="button"
            onClick={onDismiss}
            className="ml-auto -mr-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-white/60 light:text-gray-500 transition-colors hover:bg-white/10 light:hover:bg-gray-100 hover:text-white light:hover:text-gray-900 cursor-pointer"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto">
          {padded ? <div className="p-6">{children}</div> : children}
        </div>
      </div>
    </div>
  )
}
