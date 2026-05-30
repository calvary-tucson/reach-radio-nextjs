'use client'

import { useRef } from 'react'
import { X } from 'lucide-react'
import { useModal } from '@/components/modals/ModalContext'
import { useSheetDrag } from '@/lib/hooks/useSheetDrag'
import { cn } from '@/lib/utils'

interface TeacherPanelChromeProps {
  children: React.ReactNode
}

export function TeacherPanelChrome({ children }: TeacherPanelChromeProps) {
  const { onDismiss, isClosing } = useModal()
  const contentRef = useRef<HTMLDivElement>(null)
  const drag = useSheetDrag({ onDismiss, contentRef })

  return (
    <div
      role="presentation"
      className="fixed inset-0 flex items-end md:items-stretch md:justify-end"
      onClick={(e) => { if (e.target === e.currentTarget) onDismiss() }}
      onKeyDown={(e) => { if (e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ')) onDismiss() }}
    >
      <div
        ref={contentRef}
        className={cn(
          'w-full flex flex-col bg-[#0f1a0a] light:bg-white border-white/[0.08] light:border-gray-200 overflow-hidden',
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
        {/* Drag handle + close — mobile only */}
        <div
          className="flex items-center justify-between px-3 pt-3 pb-2 md:hidden shrink-0"
        >
          <div className="w-9" />
          {/* Drag handle is also a button for keyboard dismiss */}
          <button
            type="button"
            aria-label="Drag to dismiss"
            className="cursor-grab active:cursor-grabbing touch-none"
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onDismiss() }}
            onTouchStart={drag.onTouchStart}
            onTouchMove={drag.onTouchMove}
            onTouchEnd={drag.onTouchEnd}
          >
            <div className="h-1 w-10 rounded-full bg-white/30 light:bg-gray-300" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={onDismiss}
            className="flex h-9 w-9 items-center justify-center rounded-full text-white/60 light:text-gray-500 hover:bg-white/10 light:hover:bg-gray-100 hover:text-white light:hover:text-gray-900 transition-colors cursor-pointer"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Close button — desktop only */}
        <div className="hidden md:flex justify-end px-4 pt-4 pb-0 shrink-0">
          <button
            type="button"
            onClick={onDismiss}
            className="flex h-9 w-9 items-center justify-center rounded-full text-white/60 light:text-gray-500 hover:bg-white/10 light:hover:bg-gray-100 hover:text-white light:hover:text-gray-900 transition-colors cursor-pointer"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Scrollable content; pb-20 clears the fixed bottom nav bar on mobile */}
        <div className="flex-1 min-h-0 overflow-y-auto pb-20 md:pb-0">
          {children}
        </div>
      </div>
    </div>
  )
}
