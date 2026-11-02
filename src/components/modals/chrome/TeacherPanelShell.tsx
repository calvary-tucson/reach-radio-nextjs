'use client'

import { useRef, useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { X, ArrowLeft } from 'lucide-react'
import { PanelContentStage, usePrefersReducedMotion } from '@/components/modals/chrome/PanelContentStage'
import { useModalStore } from '@/lib/stores/modal'
import { useModal } from '@/components/modals/ModalContext'
import { useSheetDrag } from '@/lib/hooks/useSheetDrag'
import { useFocusTrap } from '@/lib/hooks/useFocusTrap'
import { DragHandle } from '@/components/global/DragHandle'
import { cn } from '@/lib/utils'

interface TeacherPanelShellProps {
  children: React.ReactNode
  /** Fires when an in-panel push/pop finishes (or is skipped); releases the Back lock. */
  onNavSettled?: () => void
}

export function TeacherPanelShell({ children, onNavSettled }: TeacherPanelShellProps) {
  const { onDismiss, onBack, isClosing, stackDepth } = useModal()
  const contentRef = useRef<HTMLDivElement>(null)
  const mobileDrag = useSheetDrag({ onDismiss, contentRef, axis: 'y' })
  const tabletDrag = useSheetDrag({ onDismiss, contentRef, axis: 'x' })
  const canGoBack = stackDepth > 0
  const pathname = usePathname()
  const reducedMotion = usePrefersReducedMotion()
  const navDirection = useModalStore((s) => s.navDirection)
  const mobileBackRef = useRef<HTMLButtonElement>(null)
  const desktopBackRef = useRef<HTMLButtonElement>(null)

  // Back hides while it may hold focus (inert drops focus to <body>): hand it
  // to the dialog so keyboard users stay inside the panel.
  useEffect(() => {
    if (canGoBack) return
    const active = document.activeElement
    if (active && (active === mobileBackRef.current || active === desktopBackRef.current)) {
      contentRef.current?.focus()
    }
  }, [canGoBack])

  const handleBackClick = () => {
    const willHide = stackDepth <= 1
    onBack()
    if (willHide) contentRef.current?.focus()
  }

  // Hidden Back: inert (no focus/click) + tabIndex -1 + aria-hidden, never aria-hidden alone.
  const backA11y = canGoBack
    ? {}
    : ({ inert: true, tabIndex: -1, 'aria-hidden': true } as const)

  // Focus on open
  useEffect(() => { contentRef.current?.focus() }, [])

  useFocusTrap(contentRef)

  const backButtonClass =
    'flex h-11 w-11 items-center justify-center rounded-full bg-white/25 light:bg-gray-200 text-white/80 light:text-gray-500 hover:bg-white/40 light:hover:bg-gray-300 hover:text-white light:hover:text-gray-900 motion-safe:transition-[opacity,transform,background-color,color] motion-safe:duration-300 motion-safe:ease-[cubic-bezier(0.32,0.72,0,1)] cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
  const backStateClass = canGoBack
    ? 'opacity-100 translate-x-0 scale-100'
    : 'opacity-0 -translate-x-3 scale-75 pointer-events-none'

  const closeButtonClass =
    'flex h-11 w-11 items-center justify-center rounded-full text-white/80 light:text-gray-500 hover:bg-white/10 light:hover:bg-gray-100 hover:text-white light:hover:text-gray-900 motion-safe:transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'

  return (
    <div
      role="presentation"
      className="fixed inset-0 flex items-end md:items-stretch md:justify-end cursor-pointer"
      onClick={(e) => { if (e.target === e.currentTarget) onDismiss() }}
      onKeyDown={(e) => { if (e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ')) onDismiss() }}
    >
      <div
        ref={contentRef}
        role="dialog"
        aria-modal="true"
        tabIndex={-1}
        aria-label="Teacher profile"
        className={cn(
          'w-full flex flex-col bg-[#0f1a0a] light:bg-white border-white/[0.08] light:border-gray-200 overflow-hidden [will-change:opacity,transform]',
          // Mobile: bottom sheet
          'max-h-[92dvh] rounded-t-2xl border',
          isClosing
            ? 'motion-safe:animate-[modal-slide-down_0.15s_ease-in_forwards]'
            : 'motion-safe:animate-[modal-slide-up_0.2s_cubic-bezier(0.32,0.72,0,1)_both]',
          // Desktop: right panel
          'md:max-h-none md:h-full md:w-[480px] md:rounded-none md:rounded-l-2xl md:border-y-0 md:border-r-0 md:border-l',
          isClosing
            ? 'md:motion-safe:animate-[panel-slide-out_0.15s_ease-in_forwards]'
            : 'md:motion-safe:animate-[panel-slide-in_0.25s_cubic-bezier(0.32,0.72,0,1)_both]',
        )}
      >
        {/* Mobile: drag handle + optional back button + close button */}
        <div className="flex items-center justify-between px-3 pt-3 pb-2 md:hidden shrink-0">
          <button
            ref={mobileBackRef}
            type="button"
            onClick={handleBackClick}
            className={cn(backButtonClass, backStateClass)}
            aria-label="Back"
            {...backA11y}
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <DragHandle drag={mobileDrag} onDismiss={onDismiss} />
          <button
            type="button"
            onClick={onDismiss}
            className={closeButtonClass}
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Desktop: tablet swipe zone + optional back button + close button.
            touch-pan-y: browser owns vertical scroll; our handlers receive horizontal swipes.
            stopPropagation on buttons prevents tap from triggering drag context. */}
        <div
          data-testid="tablet-drag-zone"
          className={cn(
            'hidden md:flex items-center justify-between px-4 pt-4 pb-0 shrink-0 touch-pan-y',
          )}
          onTouchStart={tabletDrag.onTouchStart}
          onTouchMove={tabletDrag.onTouchMove}
          onTouchEnd={tabletDrag.onTouchEnd}
        >
          <button
            ref={desktopBackRef}
            type="button"
            onClick={handleBackClick}
            onTouchStart={(e) => e.stopPropagation()}
            onTouchEnd={(e) => e.stopPropagation()}
            className={cn(backButtonClass, backStateClass)}
            aria-label="Back"
            {...backA11y}
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <button
            data-testid="desktop-close-btn"
            type="button"
            onClick={onDismiss}
            onTouchStart={(e) => e.stopPropagation()}
            onTouchEnd={(e) => e.stopPropagation()}
            className={closeButtonClass}
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Scrollable content (pb-20 clears the fixed bottom nav bar on mobile) lives in the stage */}
        <PanelContentStage
          direction={navDirection}
          reducedMotion={reducedMotion}
          contentKey={pathname}
          onConsume={() => useModalStore.getState().clearNavDirection()}
          onSettled={() => onNavSettled?.()}
        >
          {children}
        </PanelContentStage>
      </div>
    </div>
  )
}
