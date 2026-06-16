import { type RefObject, useCallback, useEffect, useRef } from 'react'

const DISMISS_THRESHOLD = 120
const VELOCITY_THRESHOLD = 0.5
// 60px floor prevents ghost-touch dismissal at near-zero displacement
const MIN_VELOCITY_DELTA = 60
const OPACITY_SCALE_DISTANCE = 400
const OPACITY_MIN = 0.5
const SNAP_BACK_DURATION = 220

interface UseSheetDragOptions {
  onDismiss: () => void
  contentRef: RefObject<HTMLDivElement | null>
  axis?: 'y' | 'x'
}

function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

export function useSheetDrag({ onDismiss, contentRef, axis = 'y' }: UseSheetDragOptions) {
  const startPos = useRef(0)
  const startTime = useRef(0)
  const currentDelta = useRef(0)
  const reducedMotionRef = useRef(false)
  const dismissTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const mouseCleanupRef = useRef<(() => void) | null>(null)

  useEffect(() => () => {
    if (dismissTimer.current) clearTimeout(dismissTimer.current)
    if (mouseCleanupRef.current) mouseCleanupRef.current()
  }, [])

  const clearInlineStyles = useCallback(() => {
    if (contentRef.current) {
      contentRef.current.style.transform = ''
      contentRef.current.style.opacity = ''
      contentRef.current.style.transition = ''
      contentRef.current.style.animation = ''
    }
  }, [contentRef])

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    startPos.current = axis === 'x' ? e.touches[0].clientX : e.touches[0].clientY
    startTime.current = Date.now()
    currentDelta.current = 0
    reducedMotionRef.current = prefersReducedMotion()
    if (contentRef.current) {
      contentRef.current.style.animation = 'none'
      contentRef.current.style.transition = 'none'
    }
  }, [contentRef, axis])

  const onTouchMove = useCallback((e: React.TouchEvent) => {
    const pos = axis === 'x' ? e.touches[0].clientX : e.touches[0].clientY
    currentDelta.current = Math.max(0, pos - startPos.current)
    if (contentRef.current && !reducedMotionRef.current) {
      contentRef.current.style.transform = axis === 'x'
        ? `translateX(${currentDelta.current}px)`
        : `translateY(${currentDelta.current}px)`
      contentRef.current.style.opacity = String(
        Math.max(OPACITY_MIN, 1 - currentDelta.current / OPACITY_SCALE_DISTANCE)
      )
    }
  }, [contentRef, axis])

  const onTouchEnd = useCallback(() => {
    if (currentDelta.current === 0) {
      clearInlineStyles()
      return
    }

    const elapsed = Math.max(1, Date.now() - startTime.current)
    const velocity = currentDelta.current / elapsed

    if (currentDelta.current > DISMISS_THRESHOLD || (currentDelta.current >= MIN_VELOCITY_DELTA && velocity > VELOCITY_THRESHOLD)) {
      if (contentRef.current) {
        contentRef.current.style.transition = 'transform 0.2s ease-out, opacity 0.2s ease-out'
        contentRef.current.style.transform = axis === 'x' ? 'translateX(100%)' : 'translateY(100%)'
        contentRef.current.style.opacity = '0'
      }
      if (dismissTimer.current) clearTimeout(dismissTimer.current)
      dismissTimer.current = setTimeout(onDismiss, 150)
    } else {
      if (contentRef.current) {
        contentRef.current.style.transition = 'transform 0.2s ease-out, opacity 0.2s ease-out'
        contentRef.current.style.transform = axis === 'x' ? 'translateX(0)' : 'translateY(0)'
        contentRef.current.style.opacity = '1'
      }
      if (dismissTimer.current) clearTimeout(dismissTimer.current)
      dismissTimer.current = setTimeout(clearInlineStyles, SNAP_BACK_DURATION)
    }
  }, [contentRef, onDismiss, axis, clearInlineStyles])

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    startPos.current = axis === 'x' ? e.clientX : e.clientY
    startTime.current = Date.now()
    currentDelta.current = 0
    const reducedMotion = prefersReducedMotion()
    if (contentRef.current) {
      contentRef.current.style.animation = 'none'
      contentRef.current.style.transition = 'none'
    }

    function handleMouseMove(ev: MouseEvent) {
      const pos = axis === 'x' ? ev.clientX : ev.clientY
      currentDelta.current = Math.max(0, pos - startPos.current)
      if (contentRef.current && !reducedMotion) {
        contentRef.current.style.transform = axis === 'x'
          ? `translateX(${currentDelta.current}px)`
          : `translateY(${currentDelta.current}px)`
        contentRef.current.style.opacity = String(
          Math.max(OPACITY_MIN, 1 - currentDelta.current / OPACITY_SCALE_DISTANCE)
        )
      }
    }

    function handleMouseUp() {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
      mouseCleanupRef.current = null

      if (currentDelta.current === 0) {
        clearInlineStyles()
        return
      }

      const elapsed = Math.max(1, Date.now() - startTime.current)
      const velocity = currentDelta.current / elapsed

      if (currentDelta.current > DISMISS_THRESHOLD || (currentDelta.current >= MIN_VELOCITY_DELTA && velocity > VELOCITY_THRESHOLD)) {
        if (contentRef.current) {
          contentRef.current.style.transition = 'transform 0.2s ease-out, opacity 0.2s ease-out'
          contentRef.current.style.transform = axis === 'x' ? 'translateX(100%)' : 'translateY(100%)'
          contentRef.current.style.opacity = '0'
        }
        if (dismissTimer.current) clearTimeout(dismissTimer.current)
        dismissTimer.current = setTimeout(onDismiss, 150)
      } else {
        if (contentRef.current) {
          contentRef.current.style.transition = 'transform 0.2s ease-out, opacity 0.2s ease-out'
          contentRef.current.style.transform = axis === 'x' ? 'translateX(0)' : 'translateY(0)'
          contentRef.current.style.opacity = '1'
        }
        if (dismissTimer.current) clearTimeout(dismissTimer.current)
        dismissTimer.current = setTimeout(clearInlineStyles, SNAP_BACK_DURATION)
      }
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
    mouseCleanupRef.current = () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [contentRef, onDismiss, axis, clearInlineStyles])

  return { onTouchStart, onTouchMove, onTouchEnd, onMouseDown }
}
