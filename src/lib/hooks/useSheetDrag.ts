import { type RefObject, useCallback, useEffect, useRef } from 'react'

const DISMISS_THRESHOLD = 120
const VELOCITY_THRESHOLD = 0.5
const OPACITY_SCALE_DISTANCE = 400
const OPACITY_MIN = 0.5

interface UseSheetDragOptions {
  onDismiss: () => void
  contentRef: RefObject<HTMLDivElement | null>
}

export function useSheetDrag({ onDismiss, contentRef }: UseSheetDragOptions) {
  const startY = useRef(0)
  const startTime = useRef(0)
  const currentY = useRef(0)
  const dismissTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => () => {
    if (dismissTimer.current) clearTimeout(dismissTimer.current)
  }, [])

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
        Math.max(OPACITY_MIN, 1 - currentY.current / OPACITY_SCALE_DISTANCE)
      )
    }
  }, [contentRef])

  const onTouchEnd = useCallback(() => {
    const elapsed = Math.max(1, Date.now() - startTime.current)
    const velocity = currentY.current / elapsed

    if (currentY.current > DISMISS_THRESHOLD || velocity > VELOCITY_THRESHOLD) {
      if (contentRef.current) {
        contentRef.current.style.transition = 'transform 0.2s ease-out, opacity 0.2s ease-out'
        contentRef.current.style.transform = 'translateY(100%)'
        contentRef.current.style.opacity = '0'
      }
      dismissTimer.current = setTimeout(onDismiss, 150)
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
