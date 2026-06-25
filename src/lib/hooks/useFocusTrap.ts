import { type RefObject, useEffect } from 'react'

const FOCUSABLE_SELECTOR = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'

export function useFocusTrap(containerRef: RefObject<HTMLElement | null>): void {
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== 'Tab') return
      const focusable = el!.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)
      if (!focusable.length) { e.preventDefault(); return }
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (e.shiftKey && (document.activeElement === first || document.activeElement === el)) {
        e.preventDefault(); last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault(); first.focus()
      }
    }
    el.addEventListener('keydown', onKeyDown)
    return () => el.removeEventListener('keydown', onKeyDown)
  }, [containerRef])
}
