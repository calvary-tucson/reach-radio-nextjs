'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useSheetDrag } from '@/lib/hooks/useSheetDrag'

interface BottomSheetProps {
  open: boolean
  onClose: () => void
  children: React.ReactNode
  ariaLabel: string
  className?: string
}

export function BottomSheet({ open, onClose, children, ariaLabel, className }: BottomSheetProps) {
  const [visible, setVisible] = useState(false)
  const sheetRef = useRef<HTMLDivElement>(null)
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const handleClose = useCallback(() => {
    setVisible(false)
    closeTimerRef.current = setTimeout(onClose, 280)
  }, [onClose])

  const drag = useSheetDrag({ onDismiss: handleClose, contentRef: sheetRef })

  useEffect(() => () => {
    if (closeTimerRef.current) clearTimeout(closeTimerRef.current)
  }, [])

  useEffect(() => {
    if (!open) return
    const id = requestAnimationFrame(() => setVisible(true))
    return () => cancelAnimationFrame(id)
  }, [open])

  useEffect(() => {
    if (!open) return
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') handleClose()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [open, handleClose])

  useEffect(() => {
    if (!open) return
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = ''
    }
  }, [open])

  if (!open) return null

  return createPortal(
    <>
      <div
        data-testid="bottom-sheet-backdrop"
        className={`fixed inset-0 z-[70] bg-black/60 transition-opacity duration-300 ${
          visible ? 'opacity-100' : 'opacity-0'
        }`}
        onClick={handleClose}
        aria-hidden="true"
      />
      <div role="dialog" aria-modal="true" aria-label={ariaLabel}>
        <div
          ref={sheetRef}
          className={`fixed inset-x-0 bottom-0 z-[70] bg-gray-800 rounded-t-2xl transition-transform duration-[280ms] ease-out ${
            visible ? 'translate-y-0' : 'translate-y-full'
          } ${className ?? ''}`}
        >
          <div
            className="touch-none cursor-grab active:cursor-grabbing"
            onTouchStart={drag.onTouchStart}
            onTouchMove={drag.onTouchMove}
            onTouchEnd={drag.onTouchEnd}
            onMouseDown={drag.onMouseDown}
          >
            <div className="flex justify-center pt-3 pb-2">
              <div className="h-1 w-10 rounded-full bg-white/30" />
            </div>
          </div>
          {children}
        </div>
      </div>
    </>,
    document.body
  )
}
