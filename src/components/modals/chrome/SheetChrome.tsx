'use client'

import { X } from 'lucide-react'
import { useRef } from 'react'
import { useModal } from '@/components/modals/ModalContext'
import { useSheetDrag } from '@/lib/hooks/useSheetDrag'
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

  return (
    // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions
    <div
      className="fixed inset-0 flex items-end sm:items-center sm:justify-center"
      onClick={(e) => { if (e.target === e.currentTarget) onDismiss() }}
    >
      <div
        ref={contentRef}
        className={cn(
          'w-full max-h-[90dvh] overflow-hidden flex flex-col border border-white/10 bg-gray-800 p-0',
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
        {/* Drag handle — mobile only */}
        <div
          className="flex justify-center pt-3 pb-2 sm:hidden cursor-grab active:cursor-grabbing touch-none shrink-0"
          onTouchStart={drag.onTouchStart}
          onTouchMove={drag.onTouchMove}
          onTouchEnd={drag.onTouchEnd}
        >
          <div className="h-1 w-10 rounded-full bg-white/30" />
        </div>
        {/* Header */}
        <div className="shrink-0 flex items-center justify-between border-b border-white/10 bg-gray-800 px-6 py-4">
          {title ? (
            <h2 className="text-xl font-bold text-white">{title}</h2>
          ) : (
            <span />
          )}
          <button
            type="button"
            onClick={onDismiss}
            className="ml-auto -mr-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-white/60 transition-colors hover:bg-white/10 hover:text-white cursor-pointer"
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
