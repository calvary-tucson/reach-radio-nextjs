import { renderHook, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useSheetDrag } from '@/lib/hooks/useSheetDrag'

function touch(clientX: number, clientY: number): React.TouchEvent {
  return { touches: [{ clientX, clientY }] } as unknown as React.TouchEvent
}

describe('useSheetDrag', () => {
  let el: HTMLDivElement
  let contentRef: { current: HTMLDivElement }

  beforeEach(() => {
    el = document.createElement('div')
    contentRef = { current: el }
  })

  describe('y-axis (default)', () => {
    it('translates Y on downward move', () => {
      const { result } = renderHook(() => useSheetDrag({ onDismiss: vi.fn(), contentRef }))
      act(() => { result.current.onTouchStart(touch(0, 100)) })
      act(() => { result.current.onTouchMove(touch(0, 200)) })
      expect(el.style.transform).toBe('translateY(100px)')
    })

    it('dismisses via translateY(100%) when delta > 120', () => {
      vi.useFakeTimers()
      const onDismiss = vi.fn()
      const { result } = renderHook(() => useSheetDrag({ onDismiss, contentRef }))
      act(() => { result.current.onTouchStart(touch(0, 0)) })
      act(() => { result.current.onTouchMove(touch(0, 130)) })
      act(() => { result.current.onTouchEnd() })
      expect(el.style.transform).toBe('translateY(100%)')
      vi.advanceTimersByTime(200)
      expect(onDismiss).toHaveBeenCalledOnce()
      vi.useRealTimers()
    })

    it('snaps back via translateY(0) when delta <= 120', () => {
      const onDismiss = vi.fn()
      const { result } = renderHook(() => useSheetDrag({ onDismiss, contentRef }))
      act(() => { result.current.onTouchStart(touch(0, 0)) })
      act(() => { result.current.onTouchMove(touch(0, 50)) })
      act(() => { result.current.onTouchEnd() })
      expect(onDismiss).not.toHaveBeenCalled()
      expect(el.style.transform).toBe('translateY(0)')
    })

    it('clears inline styles 220ms after snap-back', () => {
      vi.useFakeTimers()
      const { result } = renderHook(() => useSheetDrag({ onDismiss: vi.fn(), contentRef }))
      act(() => { result.current.onTouchStart(touch(0, 0)) })
      act(() => { result.current.onTouchMove(touch(0, 50)) })
      act(() => { result.current.onTouchEnd() })
      expect(el.style.transform).toBe('translateY(0)')
      act(() => { vi.advanceTimersByTime(220) })
      expect(el.style.transform).toBe('')
      expect(el.style.animation).toBe('')
      vi.useRealTimers()
    })

    it('clears styles immediately on pure tap (no movement)', () => {
      const onDismiss = vi.fn()
      const { result } = renderHook(() => useSheetDrag({ onDismiss, contentRef }))
      act(() => { result.current.onTouchStart(touch(0, 100)) })
      act(() => { result.current.onTouchEnd() })
      expect(onDismiss).not.toHaveBeenCalled()
      expect(el.style.transform).toBe('')
      expect(el.style.animation).toBe('')
    })

    it('ignores upward swipe (clamps to 0)', () => {
      const onDismiss = vi.fn()
      const { result } = renderHook(() => useSheetDrag({ onDismiss, contentRef }))
      act(() => { result.current.onTouchStart(touch(0, 200)) })
      act(() => { result.current.onTouchMove(touch(0, 50)) }) // upward — delta negative
      act(() => { result.current.onTouchEnd() })
      expect(onDismiss).not.toHaveBeenCalled()
    })
  })

  describe('x-axis', () => {
    it('translates X on rightward move', () => {
      const { result } = renderHook(() =>
        useSheetDrag({ onDismiss: vi.fn(), contentRef, axis: 'x' })
      )
      act(() => { result.current.onTouchStart(touch(100, 0)) })
      act(() => { result.current.onTouchMove(touch(200, 0)) })
      expect(el.style.transform).toBe('translateX(100px)')
    })

    it('dismisses via translateX(100%) when delta > 120', () => {
      vi.useFakeTimers()
      const onDismiss = vi.fn()
      const { result } = renderHook(() =>
        useSheetDrag({ onDismiss, contentRef, axis: 'x' })
      )
      act(() => { result.current.onTouchStart(touch(0, 0)) })
      act(() => { result.current.onTouchMove(touch(130, 0)) })
      act(() => { result.current.onTouchEnd() })
      expect(el.style.transform).toBe('translateX(100%)')
      vi.advanceTimersByTime(200)
      expect(onDismiss).toHaveBeenCalledOnce()
      vi.useRealTimers()
    })

    it('snaps back via translateX(0) when delta <= 120', () => {
      const onDismiss = vi.fn()
      const { result } = renderHook(() =>
        useSheetDrag({ onDismiss, contentRef, axis: 'x' })
      )
      act(() => { result.current.onTouchStart(touch(0, 0)) })
      act(() => { result.current.onTouchMove(touch(50, 0)) })
      act(() => { result.current.onTouchEnd() })
      expect(onDismiss).not.toHaveBeenCalled()
      expect(el.style.transform).toBe('translateX(0)')
    })

    it('ignores leftward swipe (clamps to 0)', () => {
      const onDismiss = vi.fn()
      const { result } = renderHook(() =>
        useSheetDrag({ onDismiss, contentRef, axis: 'x' })
      )
      act(() => { result.current.onTouchStart(touch(200, 0)) })
      act(() => { result.current.onTouchMove(touch(50, 0)) })
      act(() => { result.current.onTouchEnd() })
      expect(onDismiss).not.toHaveBeenCalled()
    })
  })
})
