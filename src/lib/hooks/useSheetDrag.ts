import { type RefObject, useCallback, useEffect, useRef } from 'react'

const DISMISS_THRESHOLD = 120
const VELOCITY_THRESHOLD = 0.5
const OPACITY_SCALE_DISTANCE = 400
const OPACITY_MIN = 0.5

interface UseSheetDragOptions {
  onDismiss: () => void
  contentRef: RefObject<HTMLDivElement | null>
}

function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

export function useSheetDrag({ onDismiss, contentRef }: UseSheetDragOptions) {
  const startY = useRef(0)
  const startTime = useRef(0)
  const currentY = useRef(0)
  const dismissTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const mouseCleanupRef = useRef<(() => void) | null>(null)

  useEffect(() => () => {
    if (dismissTimer.current) clearTimeout(dismissTimer.current)
    if (mouseCleanupRef.current) mouseCleanupRef.current()
  }, [])

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    startY.current = e.touches[0].clientY
    startTime.current = Date.now()
    currentY.current = 0
    if (contentRef.current) {
      contentRef.current.style.animation = 'none'
      contentRef.current.style.transition = 'none'
    }
  }, [contentRef])

  const onTouchMove = useCallback((e: React.TouchEvent) => {
    const deltaY = e.touches[0].clientY - startY.current
    currentY.current = Math.max(0, deltaY)
    if (contentRef.current && !prefersReducedMotion()) {
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

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    startY.current = e.clientY
    startTime.current = Date.now()
    currentY.current = 0
    if (contentRef.current) {
      contentRef.current.style.animation = 'none'
      contentRef.current.style.transition = 'none'
    }

    function handleMouseMove(ev: MouseEvent) {
      const deltaY = ev.clientY - startY.current
      currentY.current = Math.max(0, deltaY)
      if (contentRef.current && !prefersReducedMotion()) {
        contentRef.current.style.transform = `translateY(${currentY.current}px)`
        contentRef.current.style.opacity = String(
          Math.max(OPACITY_MIN, 1 - currentY.current / OPACITY_SCALE_DISTANCE)
        )
      }
    }

    function handleMouseUp() {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
      mouseCleanupRef.current = null

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
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
    mouseCleanupRef.current = () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [contentRef, onDismiss])

  return { onTouchStart, onTouchMove, onTouchEnd, onMouseDown }
}
