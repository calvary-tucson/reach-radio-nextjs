// src/lib/hooks/useSheetDrag.ts
import { type RefObject, useCallback, useRef } from 'react'

const DISMISS_THRESHOLD = 120
const VELOCITY_THRESHOLD = 0.5

interface UseSheetDragOptions {
  onDismiss: () => void
  contentRef: RefObject<HTMLDivElement | null>
}

export function useSheetDrag({ onDismiss, contentRef }: UseSheetDragOptions) {
  const startY = useRef(0)
  const startTime = useRef(0)
  const currentY = useRef(0)

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    startY.current = e.touches[0].clientY
    startTime.current = Date.now()
    currentY.current = 0
    if (contentRef.current) {
      contentRef.current.style.transition = 'none'
    }
  }, [contentRef])

  const onTouchMove = useCallback((e: React.TouchEvent) => {
    const deltaY = e.touches[0].clientY - startY.current
    currentY.current = Math.max(0, deltaY)
    if (contentRef.current) {
      contentRef.current.style.transform = `translateY(${currentY.current}px)`
      contentRef.current.style.opacity = String(
        Math.max(0.5, 1 - currentY.current / 400)
      )
    }
  }, [contentRef])

  const onTouchEnd = useCallback(() => {
    const elapsed = Date.now() - startTime.current
    const velocity = currentY.current / elapsed

    if (currentY.current > DISMISS_THRESHOLD || velocity > VELOCITY_THRESHOLD) {
      if (contentRef.current) {
        contentRef.current.style.transition = 'transform 0.2s ease-out, opacity 0.2s ease-out'
        contentRef.current.style.transform = 'translateY(100%)'
        contentRef.current.style.opacity = '0'
      }
      setTimeout(onDismiss, 150)
    } else {
      if (contentRef.current) {
        contentRef.current.style.transition = 'transform 0.2s ease-out, opacity 0.2s ease-out'
        contentRef.current.style.transform = 'translateY(0)'
        contentRef.current.style.opacity = '1'
      }
    }
  }, [contentRef, onDismiss])

  return { onTouchStart, onTouchMove, onTouchEnd }
}
